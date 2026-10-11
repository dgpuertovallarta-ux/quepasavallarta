import { getStore } from "@netlify/blobs";

/**
 * Memoria de historias descartadas por la auto-publicación.
 *
 * Bug real (2026-10-10): una historia que la redacción descartaba (ya
 * había una nota parecida, o no traía material suficiente) no quedaba
 * anotada en ningún lado, así que la corrida siguiente la volvía a
 * intentar — otra llamada a la IA para llegar al mismo descarte. Como
 * cada corrida solo hace un par de intentos, dos historias así al
 * frente de la lista dejaban la fila atorada: horas sin publicar nada
 * aunque hubiera noticias nuevas esperando detrás.
 *
 * Aquí se anota cada descarte con una fecha de vencimiento; mientras no
 * venza, la historia se salta sin gastar un intento. Se guarda en
 * Netlify Blobs (igual que las imágenes, sin configuración). Si el
 * almacén no está disponible (p. ej. en local), todo sigue funcionando
 * como antes, solo sin memoria entre corridas.
 */
const STORE_NAME = "ingest-state";
const KEY = "autopublish-skips";

export type SkipMap = Record<string, { until: number; reason: string }>;

export async function loadSkips(): Promise<SkipMap> {
  try {
    const data = (await getStore(STORE_NAME).get(KEY, { type: "json" })) as SkipMap | null;
    if (!data || typeof data !== "object") return {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(data).filter(([, v]) => v && typeof v.until === "number" && v.until > now));
  } catch {
    return {};
  }
}

export async function saveSkips(skips: SkipMap): Promise<void> {
  try {
    await getStore(STORE_NAME).setJSON(KEY, skips);
  } catch {
    // Sin almacén disponible: se pierde la memoria de esta corrida, nada más.
  }
}
