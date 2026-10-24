/**
 * Cola de publicación a Facebook/Instagram.
 *
 * Línea pedida por el propietario (2026-10-24):
 *   - Las notas más importantes, revueltas (de distintas secciones): al menos
 *     ~6 al día y como máximo QPV_MAX_POR_DIA (10 por omisión), separadas
 *     QPV_MINUTOS_ENTRE_POSTS (40 por omisión), de 7 a. m. a 11 p. m.
 *   - Tráfico solo con el resumen de las 8 a. m., 2 p. m. y 6 p. m. (va aparte
 *     del límite de notas y sale a su hora).
 *   - Urgentes (alertas, Protección Civil, en curso) primero, sin esperar.
 *   - Huracanes: los videos por boletín van por otro camino (hurricane-video).
 *   - Una nota que lleva más de 8 h esperando ya no sale (dejó de ser noticia).
 * Se procesa al final de cada corrida de /api/ingest (cada 10 min).
 */
import { getStore } from "@netlify/blobs";
import { publishToSocial } from "../social/publishToSocial";
import { clasificar } from "./clasificar";

const MAX_POR_DIA = Number(process.env.QPV_MAX_POR_DIA || 10);
const MINUTOS_ENTRE_POSTS = Number(process.env.QPV_MINUTOS_ENTRE_POSTS || 40);
const VIGENCIA_MS = 8 * 3_600_000;
const HORA_INICIO = 7;
const HORA_FIN = 23;

export type ItemRedes = {
  id: string;
  title: string;
  excerpt: string;
  articleUrl: string;
  imageUrl?: string;
  urgente: boolean;
  /** "trafico" = resumen vial de las 8, 14 y 18 h (fuera del límite de notas). */
  tipo?: "nota" | "trafico";
  /** Importancia de la nota (newsScore de la ingesta, 0–100). */
  score?: number;
  /** Sección (etiqueta de clasificar) para revolver las notas. */
  seccion?: string;
  creada: string;
  estado: "pendiente" | "publicando" | "publicada" | "vencida" | "fallida";
  publicadaEn?: string;
  resultado?: string;
};

const store = () => getStore({ name: "qpv-cola-redes", consistency: "strong" });

async function leerTodos(): Promise<ItemRedes[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: "item/" });
  const xs = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }) as Promise<ItemRedes | null>));
  return xs.filter(Boolean) as ItemRedes[];
}

export async function encolarRedes(
  n: { title: string; excerpt: string; articleUrl: string; imageUrl?: string | null },
  opts: { tipo?: "nota" | "trafico"; score?: number } = {}
): Promise<void> {
  if (!n.imageUrl) return; // siempre con imagen (foto propia o tarjeta QPV)
  const c = clasificar(n.title, n.excerpt);
  const tipo = opts.tipo ?? (n.articleUrl.includes("/trafico") ? "trafico" : "nota");
  const item: ItemRedes = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: n.title,
    excerpt: n.excerpt,
    articleUrl: n.articleUrl,
    imageUrl: n.imageUrl ?? undefined,
    urgente: tipo === "nota" && (c.tipo === "alerta" || c.ultimaHora),
    tipo,
    score: opts.score,
    seccion: c.etiqueta,
    creada: new Date().toISOString(),
    estado: "pendiente",
  };
  await store().setJSON("item/" + item.id, item);
}

function diaLocal(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
}

function horaLocalNum(d = new Date()) {
  return Number(d.toLocaleString("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hour12: false })) % 24;
}

/**
 * Candado sencillo para que dos corridas al mismo tiempo (Netlify a veces
 * repite la llamada programada) no publiquen dos veces lo mismo.
 */
async function tomarCandado(): Promise<string | null> {
  const s = store();
  const actual = (await s.get("candado", { type: "json" })) as { token: string; en: number } | null;
  if (actual && Date.now() - actual.en < 90_000) return null;
  const token = Math.random().toString(36).slice(2);
  await s.setJSON("candado", { token, en: Date.now() });
  await new Promise((r) => setTimeout(r, 1200));
  const leido = (await s.get("candado", { type: "json" })) as { token: string } | null;
  return leido?.token === token ? token : null;
}

async function soltarCandado(token: string) {
  const s = store();
  const leido = (await s.get("candado", { type: "json" })) as { token: string } | null;
  if (leido?.token === token) await s.delete("candado");
}

async function publicar(sig: ItemRedes): Promise<string> {
  const s = store();
  await s.setJSON("item/" + sig.id, { ...sig, estado: "publicando" } satisfies ItemRedes);
  const r = await publishToSocial({ title: sig.title, excerpt: sig.excerpt, articleUrl: sig.articleUrl, imageUrl: sig.imageUrl });
  const ok = r.facebook.ok || r.instagram.ok;
  await s.setJSON("item/" + sig.id, {
    ...sig,
    estado: ok ? "publicada" : "fallida",
    publicadaEn: new Date().toISOString(),
    resultado: `FB: ${r.facebook.ok ? "ok" : r.facebook.error ?? "no"} · IG: ${r.instagram.ok ? "ok" : r.instagram.error ?? "no"}`,
  } satisfies ItemRedes);
  if (!r.facebook.ok) console.error("[colaRedes] Facebook falló:", r.facebook.error);
  return `${ok ? "Publicada en redes" : "Falló en redes"}: ${sig.title}`;
}

/** Publica como máximo una nota de la cola si los límites lo permiten. Nunca lanza. */
export async function procesarColaRedes(): Promise<string> {
  let token: string | null = null;
  try {
    token = await tomarCandado();
    if (!token) return "Otra corrida está publicando.";
    const s = store();
    const xs = await leerTodos();
    const ahora = Date.now();
    const hoy = diaLocal(new Date().toISOString());

    // Limpieza: vencidas y registros de más de 3 días
    for (const x of xs) {
      const edad = ahora - new Date(x.creada).getTime();
      if (x.estado === "pendiente" && edad > VIGENCIA_MS) await s.setJSON("item/" + x.id, { ...x, estado: "vencida" });
      else if (x.estado !== "pendiente" && edad > 3 * 86_400_000) await s.delete("item/" + x.id);
    }
    const vigentes = xs.filter((x) => x.estado === "pendiente" && ahora - new Date(x.creada).getTime() <= VIGENCIA_MS);

    // 1) Tráfico: el resumen de su hora sale enseguida (máx. 2 h de espera).
    const trafico = vigentes
      .filter((x) => (x.tipo ?? (x.articleUrl.includes("/trafico") ? "trafico" : "nota")) === "trafico")
      .sort((a, b) => b.creada.localeCompare(a.creada));
    for (const t of trafico.slice(1)) await s.setJSON("item/" + t.id, { ...t, estado: "vencida" });
    if (trafico[0]) {
      if (ahora - new Date(trafico[0].creada).getTime() < 2 * 3_600_000) return await publicar(trafico[0]);
      await s.setJSON("item/" + trafico[0].id, { ...trafico[0], estado: "vencida" });
    }

    // 2) Notas: las más importantes, revueltas.
    const notas = vigentes.filter((x) => (x.tipo ?? (x.articleUrl.includes("/trafico") ? "trafico" : "nota")) === "nota");
    if (!notas.length) return "Cola vacía.";
    const publicadasHoy = xs.filter(
      (x) => x.estado === "publicada" && x.publicadaEn && diaLocal(x.publicadaEn) === hoy && (x.tipo ?? (x.articleUrl.includes("/trafico") ? "trafico" : "nota")) === "nota"
    );
    const ultimaPub = xs
      .filter((x) => x.estado === "publicada" && x.publicadaEn)
      .sort((a, b) => b.publicadaEn!.localeCompare(a.publicadaEn!))[0];
    const minutos = ultimaPub ? (ahora - new Date(ultimaPub.publicadaEn!).getTime()) / 60_000 : Infinity;
    const h = horaLocalNum();
    const deDia = h >= HORA_INICIO && h < HORA_FIN;

    const urgente = notas.filter((x) => x.urgente).sort((a, b) => a.creada.localeCompare(b.creada))[0];
    if (urgente && minutos >= 10) return await publicar(urgente);
    if (!deDia) return `De noche solo salen urgentes (${notas.length} en espera para la mañana).`;
    if (publicadasHoy.length >= MAX_POR_DIA) return `Límite diario alcanzado (${MAX_POR_DIA}).`;
    if (minutos < MINUTOS_ENTRE_POSTS) return `En espera: faltan ${Math.ceil(MINUTOS_ENTRE_POSTS - minutos)} min para la siguiente.`;

    // Importancia + frescura, y castigo si es de la misma sección que la última publicada.
    const ultimaSeccion = ultimaPub?.seccion;
    const puntaje = (x: ItemRedes) => {
      const horas = (ahora - new Date(x.creada).getTime()) / 3_600_000;
      return (x.score ?? 50) - horas * 4 - (x.seccion && x.seccion === ultimaSeccion ? 15 : 0);
    };
    const sig = notas.sort((a, b) => puntaje(b) - puntaje(a))[0];
    return await publicar(sig);
  } catch (err) {
    console.error("[procesarColaRedes]", err);
    return `Error en la cola de redes: ${err instanceof Error ? err.message : "desconocido"}`;
  } finally {
    if (token) await soltarCandado(token).catch(() => undefined);
  }
}

/** Para el panel: lo que está en cola y lo publicado hoy. */
export async function estadoColaRedes() {
  const xs = await leerTodos();
  return xs.sort((a, b) => b.creada.localeCompare(a.creada));
}
