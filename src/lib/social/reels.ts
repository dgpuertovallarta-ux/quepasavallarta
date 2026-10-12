/**
 * Reels publicados en la página de Facebook del sitio, para el carrusel
 * de la portada. Usa la misma conexión que la publicación automática
 * (FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN, ver publishToSocial.ts). Sin esas
 * variables, o si Facebook no responde, devuelve una lista vacía y la
 * portada simplemente no muestra el apartado.
 */

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type PageReel = {
  id: string;
  /** Texto del reel (puede venir vacío). */
  description: string;
  createdAt: string | null;
  /** Dirección pública del reel en Facebook. */
  url: string;
  /** Imagen de portada del reel (servida por Facebook; caduca, por eso se refresca seguido). */
  thumbnail: string | null;
};

type GraphVideo = {
  id: string;
  description?: string;
  created_time?: string;
  updated_time?: string;
  permalink_url?: string;
  picture?: string;
  thumbnails?: { data?: { uri?: string; is_preferred?: boolean; width?: number; height?: number }[] };
};

function absoluteFacebookUrl(permalink: string | undefined, id: string): string {
  if (!permalink) return `https://www.facebook.com/reel/${id}`;
  if (permalink.startsWith("http")) return permalink;
  return `https://www.facebook.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;
}

function bestThumbnail(v: GraphVideo): string | null {
  const thumbs = v.thumbnails?.data || [];
  const preferred = thumbs.find((t) => t.is_preferred && t.uri);
  if (preferred?.uri) return preferred.uri;
  const largest = [...thumbs].filter((t) => t.uri).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  return largest?.uri || v.picture || null;
}

async function requestReels(fields: string, limit: number): Promise<GraphVideo[]> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return [];
  const res = await fetch(`${GRAPH_BASE}/${pageId}/video_reels?fields=${encodeURIComponent(fields)}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Las portadas de los reels que entrega Facebook caducan: se piden de
    // nuevo cada 15 minutos como máximo.
    next: { revalidate: 900 },
  });
  const json = (await res.json().catch(() => null)) as { data?: GraphVideo[]; error?: { message?: string } } | null;
  if (!res.ok || !json || json.error) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`);
  }
  return json.data || [];
}

/** Reels más recientes de la página (los más nuevos primero). Nunca lanza. */
export async function getPageReels(limit = 20): Promise<PageReel[]> {
  let videos: GraphVideo[] = [];
  try {
    videos = await requestReels("id,description,created_time,updated_time,permalink_url,picture,thumbnails{uri,is_preferred,width,height}", limit);
  } catch (err) {
    // Si algún campo no está disponible para esta cuenta, se intenta con lo mínimo.
    console.warn("[reels] consulta completa falló:", err instanceof Error ? err.message : err);
    try {
      videos = await requestReels("id,description,created_time,permalink_url,picture", limit);
    } catch (err2) {
      console.warn("[reels] consulta mínima falló:", err2 instanceof Error ? err2.message : err2);
      return [];
    }
  }

  return videos
    .map((v) => ({
      id: v.id,
      description: (v.description || "").trim(),
      createdAt: v.created_time || v.updated_time || null,
      url: absoluteFacebookUrl(v.permalink_url, v.id),
      thumbnail: bestThumbnail(v),
    }))
    .filter((r) => !!r.thumbnail);
}
