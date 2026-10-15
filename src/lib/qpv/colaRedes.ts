/**
 * Cola de publicación a Facebook/Instagram.
 *
 * Antes cada nota se mandaba a redes en cuanto se publicaba (hasta una cada
 * 10 minutos). Ahora las notas automáticas entran a esta cola y salen:
 *   - máximo QPV_MAX_POR_DIA al día (12 por omisión),
 *   - separadas al menos QPV_MINUTOS_ENTRE_POSTS (45 por omisión),
 *   - las urgentes (alertas, Protección Civil) primero y sin esperar separación,
 *   - una nota que lleva más de 6 h esperando ya no sale (dejó de ser noticia).
 * Se procesa al final de cada corrida de /api/ingest (cada 10 min).
 */
import { getStore } from "@netlify/blobs";
import { publishToSocial } from "../social/publishToSocial";
import { clasificar } from "./clasificar";

const MAX_POR_DIA = Number(process.env.QPV_MAX_POR_DIA || 12);
const MINUTOS_ENTRE_POSTS = Number(process.env.QPV_MINUTOS_ENTRE_POSTS || 45);
const VIGENCIA_MS = 6 * 3_600_000;

export type ItemRedes = {
  id: string;
  title: string;
  excerpt: string;
  articleUrl: string;
  imageUrl?: string;
  urgente: boolean;
  creada: string;
  estado: "pendiente" | "publicada" | "vencida" | "fallida";
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

export async function encolarRedes(n: { title: string; excerpt: string; articleUrl: string; imageUrl?: string | null }): Promise<void> {
  if (!n.imageUrl) return; // nada sale a redes sin imagen (2026-10)
  const c = clasificar(n.title, n.excerpt);
  const item: ItemRedes = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: n.title,
    excerpt: n.excerpt,
    articleUrl: n.articleUrl,
    imageUrl: n.imageUrl ?? undefined,
    urgente: c.tipo === "alerta" || c.ultimaHora,
    creada: new Date().toISOString(),
    estado: "pendiente",
  };
  await store().setJSON("item/" + item.id, item);
}

function diaLocal(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
}

/** Publica como máximo una nota de la cola si los límites lo permiten. Nunca lanza. */
export async function procesarColaRedes(): Promise<string> {
  try {
    const s = store();
    const xs = await leerTodos();
    const hoy = diaLocal(new Date().toISOString());
    const publicadasHoy = xs.filter((x) => x.estado === "publicada" && x.publicadaEn && diaLocal(x.publicadaEn) === hoy);

    // Limpieza: vencidas y registros de más de 3 días
    for (const x of xs) {
      const edad = Date.now() - new Date(x.creada).getTime();
      if (x.estado === "pendiente" && edad > VIGENCIA_MS) await s.setJSON("item/" + x.id, { ...x, estado: "vencida" });
      else if (x.estado !== "pendiente" && edad > 3 * 86_400_000) await s.delete("item/" + x.id);
    }

    if (publicadasHoy.length >= MAX_POR_DIA) return `Límite diario alcanzado (${MAX_POR_DIA}).`;
    const ultima = publicadasHoy.map((x) => x.publicadaEn!).sort().pop();
    const minutos = ultima ? (Date.now() - new Date(ultima).getTime()) / 60_000 : Infinity;

    const pendientes = xs
      .filter((x) => x.estado === "pendiente" && Date.now() - new Date(x.creada).getTime() <= VIGENCIA_MS)
      .sort((a, b) => Number(b.urgente) - Number(a.urgente) || a.creada.localeCompare(b.creada));
    const sig = pendientes.find((x) => x.urgente || minutos >= MINUTOS_ENTRE_POSTS);
    if (!sig) return pendientes.length ? `En espera: faltan ${Math.ceil(MINUTOS_ENTRE_POSTS - minutos)} min para la siguiente.` : "Cola vacía.";

    const r = await publishToSocial({ title: sig.title, excerpt: sig.excerpt, articleUrl: sig.articleUrl, imageUrl: sig.imageUrl });
    const ok = r.facebook.ok || r.instagram.ok;
    await s.setJSON("item/" + sig.id, {
      ...sig,
      estado: ok ? "publicada" : "fallida",
      publicadaEn: new Date().toISOString(),
      resultado: `FB: ${r.facebook.ok ? "ok" : r.facebook.error ?? "no"} · IG: ${r.instagram.ok ? "ok" : r.instagram.error ?? "no"}`,
    } satisfies ItemRedes);
    return `Publicada en redes: ${sig.title}`;
  } catch (err) {
    console.error("[procesarColaRedes]", err);
    return `Error en la cola de redes: ${err instanceof Error ? err.message : "desconocido"}`;
  }
}

/** Para el panel: lo que está en cola y lo publicado hoy. */
export async function estadoColaRedes() {
  const xs = await leerTodos();
  return xs.sort((a, b) => b.creada.localeCompare(a.creada));
}
