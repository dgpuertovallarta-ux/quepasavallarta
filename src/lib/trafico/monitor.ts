/**
 * QPV al Volante — monitor de tráfico (cada 20 min, ver netlify/functions/monitor-trafico.ts).
 *  - Mide 7 corredores (tiempo con tráfico vs. normal) e incidentes de TomTom.
 *  - Accidentes, cierres e inundaciones: borrador en la cola de aprobación del
 *    panel (no se publican solos: el dato automático puede estar desfasado).
 *  - Tráfico pesado en un corredor: postal amarilla "Reporte vial" a la cola de redes.
 *  - 8:00, 14:00 y 18:00: postal azul "Así va el tráfico" con el semáforo de
 *    las vialidades y los avisos oficiales de Tránsito de las últimas horas.
 *  - Guarda la última medición para la página pública /trafico.
 * Sin TOMTOM_API_KEY no hace nada.
 */
import { getStore } from "../storage/blobs";
import { usaWordPress } from "../wp/cliente";
import { CORREDORES } from "./corredores";
import { incidentes, medirCorredor, type EstadoCorredor, type Incidente } from "./tomtom";
import { encolarRedes } from "../qpv/colaRedes";
import { crearTarjetaMapa, crearResumenVial, horaLocal as horaTexto } from "../qpv/tarjetas";
import { agruparIncidentes, lineaIncidente, renglonIncidente, type IncidenteResumen } from "./resumen";
import { getPool } from "../db/client";
import type { Semaforo } from "@/components/social/TarjetaVial";
import { publishArticle, getRecentArticleTitles, findDuplicateTitle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { siteUrl } from "../storage/imageBlobs";

export type Instantanea = { actualizado: string; corredores: EstadoCorredor[]; incidentes: Incidente[]; resumen?: { tipo: string; t: string; d: string }[] };

const store = () => getStore({ name: "qpv-trafico", consistency: "strong" });
const HORAS_ENTRE_AVISOS = 2;

export async function ultimaInstantanea(): Promise<Instantanea | null> {
  try {
    return (await store().get("instantanea", { type: "json" })) as Instantanea | null;
  } catch {
    return null;
  }
}

function horaLocal() {
  return Number(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hour12: false }));
}

export function esNoticia(i: Incidente): boolean {
  if (i.tipo === "accidente" || i.tipo === "cierre" || i.tipo === "inundacion") return true;
  if (i.tipo === "congestion" || i.tipo === "obra" || i.tipo === "carril") return i.retrasoMin >= 10 || i.magnitud >= 3;
  return false;
}

export function tituloIncidente(i: Incidente): string {
  const donde = i.de ? ` en ${i.de}${i.a && i.a !== i.de ? ` hacia ${i.a}` : ""}` : " en Puerto Vallarta";
  const que: Record<Incidente["tipo"], string> = {
    accidente: "Reportan accidente", cierre: "Cierre de circulación", obra: "Obras afectan la circulación",
    congestion: "Tráfico pesado", inundacion: "Reportan calle inundada", carril: "Cierre de carril",
    vehiculo: "Vehículo descompuesto", otro: "Incidente vial",
  };
  return `${que[i.tipo]}${donde}`;
}

export async function correrMonitor(): Promise<string> {
  if (!process.env.TOMTOM_API_KEY) return "Falta TOMTOM_API_KEY: el monitor de tráfico está apagado.";
  const s = store();
  const h = horaLocal();
  const [incs, corr] = await Promise.all([
    incidentes(),
    h >= 5 && h < 23 ? Promise.all(CORREDORES.map((c) => medirCorredor(c).catch(() => null))) : Promise.resolve([]),
  ]);
  const corredores = (corr as (EstadoCorredor | null)[]).filter(Boolean) as EstadoCorredor[];
  // "resumen": la lista ya agrupada y legible que muestra /trafico (también en WordPress).
  const lista = agruparIncidentes(incs).map((r) => ({ tipo: r.tipo, ...renglonIncidente(r) }));
  await s.setJSON("instantanea", { actualizado: new Date().toISOString(), corredores, incidentes: incs, resumen: lista } satisfies Instantanea);

  const avisados = ((await s.get("avisados", { type: "json" })) ?? {}) as Record<string, string>;
  const reciente = (k: string) => {
    if (!avisados[k]) return false;
    const horas = k.startsWith("inc:") ? 7 * 24 : HORAS_ENTRE_AVISOS; // un cierre por obra dura semanas: un solo borrador
    return Date.now() - new Date(avisados[k]).getTime() < horas * 3_600_000;
  };
  // limpieza de registros viejos
  for (const k of Object.keys(avisados)) if (Date.now() - new Date(avisados[k]).getTime() > 8 * 24 * 3_600_000) delete avisados[k];
  let borradores = 0;
  let avisos = 0;

  // 1) Incidentes → borrador para aprobación (con su tarjeta de mapa lista para redes al aprobar)
  if (isDatabaseConfigured()) {
    const recientes: { slug: string; title: string }[] = await getRecentArticleTitles({ sinceDays: 1 }).catch(() => []);
    for (const i of incs.filter(esNoticia).slice(0, 3)) {
      if (reciente("inc:" + i.id)) continue;
      const titulo = tituloIncidente(i);
      avisados["inc:" + i.id] = new Date().toISOString();
      if (findDuplicateTitle(titulo, recientes)) continue;
      const cuerpo = [
        `${i.descripcion || titulo}.${i.retrasoMin ? ` El retraso estimado es de ${i.retrasoMin} minutos.` : ""}`,
        "Dato preliminar del monitor de tráfico QPV al Volante (TomTom Traffic). Confirmar con Protección Civil, Tránsito o un reporte en el lugar antes de aprobar.",
        `Consulta el tráfico en vivo en ${siteUrl()}/trafico`,
      ].join("\n\n");
      await publishArticle({
        title: titulo, excerpt: i.descripcion || titulo, body: cuerpo, categorySlug: "transito",
        newsScore: i.tipo === "accidente" || i.tipo === "cierre" ? 80 : 60, aiModel: null, storyExternalKey: null,
        status: "pending_review",
      });
      recientes.push({ slug: "-", title: titulo });
      borradores++;
    }
  }

  // 2) Corredores con retraso fuerte → postal amarilla de QPV al Volante a la cola de redes.
  // 2026-10-24: el propietario pidió tráfico en Facebook solo a las 8, 14 y 18 h
  // (los resúmenes de abajo); los avisos sueltos por corredor quedan apagados
  // salvo que se active QPV_AVISOS_CORREDOR=1.
  for (const c of process.env.QPV_AVISOS_CORREDOR === "1" ? corredores.filter((x) => x.nivel === "pesado") : []) {
    if (reciente("corr:" + c.id)) continue;
    const def = CORREDORES.find((x) => x.id === c.id)!;
    const def2 = def;
    const imageUrl = await crearTarjetaMapa({
      titulo: def2.gancho,
      lugar: c.nombre.replace(/\s*→\s*/g, " hacia "),
      detalle: `${c.minutos} min (normal: ${c.minutosLibre}) · +${c.retrasoMin} min de retraso`,
      lat: (def2.origen[0] + def2.destino[0]) / 2,
      lon: (def2.origen[1] + def2.destino[1]) / 2,
      zoom: 14,
    });
    if (!imageUrl) continue; // sin imagen no sale
    await encolarRedes({
      title: `${c.nombre.replace(/\s*→\s*/g, " hacia ")}: el trayecto toma ${c.minutos} minutos, ${c.retrasoMin} más de lo normal. Medición de QPV al Volante a las ${horaTexto()}`,
      excerpt: "Tráfico en vivo",
      articleUrl: `${siteUrl()}/trafico`,
      imageUrl,
    });
    avisados["corr:" + c.id] = new Date().toISOString();
    avisos++;
  }

  // 3) Resumen vial a las 8:00, 14:00 y 18:00 (postal azul con el semáforo)
  let resumen = "";
  const slot = [8, 14, 18].find((x) => x === h);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  if (slot !== undefined && corredores.length && !avisados[`resumen:${hoy}:${slot}`]) {
    resumen = await publicarResumen(corredores, incs, slot);
    avisados[`resumen:${hoy}:${slot}`] = new Date().toISOString();
  }

  await s.setJSON("avisados", avisados);
  return `Incidentes: ${incs.length} · corredores: ${corredores.length} · borradores para aprobar: ${borradores} · avisos a redes: ${avisos}${resumen ? ` · ${resumen}` : ""}`;
}

const SEM: Record<EstadoCorredor["nivel"], Semaforo> = { pesado: "rojo", lento: "ambar", fluido: "verde" };
const NOMBRE_CORTO: Record<string, string> = {
  "ameca-sur": "Puente del Ameca → Vallarta",
  "ameca-norte": "Vallarta → Puente del Ameca",
  "medina-ascencio": "Medina Ascencio → Centro",
  "medina-norte": "Medina Ascencio → Aeropuerto",
  bucerias: "Bucerías → Aeropuerto",
  pitillal: "El Pitillal → Zona Hotelera",
  mojoneras: "Av. Mojoneras",
  sur: "Centro → Mismaloya",
};

/** Avisos viales oficiales publicados en el sitio en las últimas horas (categoría Tránsito). */
async function avisosOficialesRecientes(horas: number): Promise<{ hora: string; titulo: string }[]> {
  if (usaWordPress()) {
    const { avisosTransito } = await import("../wp/articulos");
    return (await avisosTransito(horas).catch(() => [])).map((a) => ({ hora: horaTexto(new Date(a.fecha)), titulo: a.titulo }));
  }
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<{ title: string; published_at: string }>(
      `select a.title, a.published_at from articles a join categories c on c.id = a.category_id
        where a.status = 'published' and c.slug = 'transito' and a.published_at > now() - interval '1 hour' * $1
        order by a.published_at desc limit 3`,
      [horas]
    );
    return rows.map((r) => ({ hora: horaTexto(new Date(r.published_at)), titulo: r.title }));
  } catch {
    return [];
  }
}

async function publicarResumen(corredores: EstadoCorredor[], incs: Incidente[], slot: number): Promise<string> {
  // 2026-10-26: el resumen sale con lo que de verdad está pasando (cierres,
  // accidentes, tráfico pesado por calle y zona) y un titular que cambia según
  // la situación, en lugar del mismo mapa con las mismas 3 vialidades.
  const items: { sem: Semaforo; t: string; d?: string }[] = [];
  const orden = [...corredores].sort((a, b) => b.retrasoMin - a.retrasoMin);
  const oficiales = await avisosOficialesRecientes(6);
  const todos = agruparIncidentes(incs).filter((r) => r.tipo !== "vehiculo");
  // Lo nuevo primero; de lo que ya lleva días (obras, cierres largos) solo 2.
  const nuevos = todos.filter((r) => r.nuevo);
  const viejos = todos.filter((r) => !r.nuevo).slice(0, 2);
  const elegidos = [...nuevos, ...viejos].slice(0, 5);
  const semDe = (r: IncidenteResumen): Semaforo =>
    r.tipo === "accidente" || r.tipo === "cierre" || r.tipo === "inundacion" || (r.tipo === "congestion" && r.retrasoMin >= 10) ? "rojo" : "ambar";

  for (const a of oficiales.slice(0, 1)) {
    items.push({ sem: "ambar", t: a.titulo.length > 60 ? a.titulo.slice(0, 57) + "…" : a.titulo, d: `Aviso oficial · ${a.hora}` });
  }
  for (const r of elegidos) items.push({ sem: semDe(r), ...renglonIncidente(r) });
  const conRetraso = orden.filter((c) => c.retrasoMin > 0);
  for (const c of conRetraso.slice(0, Math.max(1, 6 - items.length))) {
    items.push({ sem: SEM[c.nivel], t: NOMBRE_CORTO[c.id] ?? c.nombre, d: `${c.minutos} min · +${c.retrasoMin} min de retraso` });
  }
  if (!conRetraso.length && orden.length) {
    items.push({ sem: "verde", t: "Ameca, Medina Ascencio y Carretera 200", d: "Fluyen sin retrasos" });
  }

  // Titular según lo más importante del momento.
  const accidente = elegidos.find((r) => r.tipo === "accidente");
  const inundacion = elegidos.find((r) => r.tipo === "inundacion");
  const pesados = orden.filter((c) => c.nivel === "pesado");
  const cierreNuevo = elegidos.find((r) => r.tipo === "cierre" && r.nuevo);
  const cierres = todos.filter((r) => r.tipo === "cierre").length;
  const corto = (s: string) => (s.length > 34 ? s.slice(0, 33) + "…" : s);
  const titular = accidente
    ? `Accidente en ${corto(accidente.calle)}`
    : inundacion
      ? `Calle inundada en ${corto(inundacion.calle)}`
      : pesados.length
        ? `Cargado: ${NOMBRE_CORTO[pesados[0].id] ?? pesados[0].nombre}`
        : cierreNuevo
          ? `Cierre en ${corto(cierreNuevo.calle)}`
          : cierres
            ? `${cierres} ${cierres === 1 ? "cierre vial activo" : "cierres viales activos"}`
            : conRetraso.length
              ? "Tráfico lento en algunos puntos"
              : "Las vialidades fluyen";
  const momento = slot === 8 ? "de la mañana" : slot === 14 ? "del mediodía" : "de la tarde";
  const fecha = new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" });

  // Patrocinador de QPV al Volante ("Presentado por"), si hay uno vigente.
  const { getPatrocinio } = await import("../business/patrocinios");
  const pat = await getPatrocinio("trafico");
  const imageUrl = await crearResumenVial(
    {
      hora: horaTexto(),
      titulo: titular,
      sub: `Resumen ${momento} · ${fecha}`,
      items: items.slice(0, 6),
      fuente: "TomTom Traffic, Tránsito y redacción QPV",
    },
    pat ? { nombre: pat.nombre, logo: pat.logo } : null
  );
  if (!imageUrl) return "resumen sin imagen: no se publicó";

  const lineas = [
    ...elegidos.map(lineaIncidente),
    ...conRetraso.slice(0, 3).map((c) => `${NOMBRE_CORTO[c.id] ?? c.nombre}: ${c.minutos} min, +${c.retrasoMin} de retraso`),
  ];
  const titulo = `Así va el tráfico en Vallarta a las ${horaTexto()}: ${titular.charAt(0).toLowerCase() + titular.slice(1)}`;
  const excerpt = lineas.length
    ? lineas.join(". ")
    : "Las vialidades principales fluyen sin retrasos importantes y no hay cierres reportados";
  await encolarRedes({ title: titulo, excerpt, articleUrl: `${siteUrl()}/trafico`, imageUrl }, { tipo: "trafico", patrocinio: pat ? { id: pat.id, nombre: pat.nombre } : null });
  return `resumen vial ${slot}:00 enviado a la cola`;
}

/** Para la página /trafico: últimos avisos de tránsito publicados en el sitio (oficiales y redacción). */
export async function avisosTransito(limite = 8): Promise<{ slug: string; titulo: string; hora: string; fecha: string }[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<{ slug: string; title: string; published_at: string }>(
      `select a.slug, a.title, a.published_at from articles a join categories c on c.id = a.category_id
        where a.status = 'published' and c.slug = 'transito' and a.published_at > now() - interval '3 days'
        order by a.published_at desc limit $1`,
      [limite]
    );
    return rows.map((r) => ({
      slug: r.slug,
      titulo: r.title,
      hora: horaTexto(new Date(r.published_at)),
      fecha: new Date(r.published_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short" }),
    }));
  } catch {
    return [];
  }
}
