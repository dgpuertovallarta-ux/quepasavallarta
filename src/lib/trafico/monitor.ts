/**
 * QPV al Volante — monitor de tráfico (cada 20 min, ver netlify/functions/monitor-trafico.ts).
 *  - Mide 7 corredores (tiempo con tráfico vs. normal) e incidentes de TomTom.
 *  - Accidentes, cierres e inundaciones: borrador en la cola de aprobación del
 *    panel (no se publican solos: el dato automático puede estar desfasado).
 *  - Tráfico pesado en un corredor: aviso a la cola de redes con tarjeta de mapa.
 *  - Guarda la última medición para la página pública /trafico.
 * Sin TOMTOM_API_KEY no hace nada.
 */
import { getStore } from "@netlify/blobs";
import { CORREDORES } from "./corredores";
import { incidentes, medirCorredor, type EstadoCorredor, type Incidente } from "./tomtom";
import { encolarRedes } from "../qpv/colaRedes";
import { crearTarjetaMapa } from "../qpv/tarjetas";
import { publishArticle, getRecentArticleTitles, findDuplicateTitle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { siteUrl } from "../storage/imageBlobs";

export type Instantanea = { actualizado: string; corredores: EstadoCorredor[]; incidentes: Incidente[] };

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
  await s.setJSON("instantanea", { actualizado: new Date().toISOString(), corredores, incidentes: incs } satisfies Instantanea);

  const avisados = ((await s.get("avisados", { type: "json" })) ?? {}) as Record<string, string>;
  const reciente = (k: string) => !!avisados[k] && Date.now() - new Date(avisados[k]).getTime() < HORAS_ENTRE_AVISOS * 3_600_000;
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

  // 2) Corredores con retraso fuerte → aviso a redes con mapa ("Si vas para…")
  for (const c of corredores.filter((x) => x.nivel === "pesado")) {
    if (reciente("corr:" + c.id)) continue;
    const def = CORREDORES.find((x) => x.id === c.id)!;
    const lat = (def.origen[0] + def.destino[0]) / 2;
    const lon = (def.origen[1] + def.destino[1]) / 2;
    const titulo = def.gancho;
    const detalle = `${c.minutos} min (normal: ${c.minutosLibre}) · +${c.retrasoMin} min de retraso`;
    const imageUrl = await crearTarjetaMapa({ titulo, lugar: c.nombre.split("(")[0].trim(), detalle, lat, lon });
    await encolarRedes({ title: titulo, excerpt: detalle, articleUrl: `${siteUrl()}/trafico`, imageUrl });
    avisados["corr:" + c.id] = new Date().toISOString();
    avisos++;
  }

  await s.setJSON("avisados", avisados);
  return `Incidentes: ${incs.length} · corredores: ${corredores.length} · borradores para aprobar: ${borradores} · avisos a redes: ${avisos}`;
}
