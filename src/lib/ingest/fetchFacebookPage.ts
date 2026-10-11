import type { Source } from "./sources";
import type { IngestedItem } from "./types";
import { guessCategory, computeNewsScore, decideStatus } from "./classify";

/**
 * Lector de páginas públicas de Facebook (API Graph de Meta) para las
 * fuentes que solo publican ahí: Protección Civil, SEAPAL, Meteoromex.
 *
 * ESTADO: listo pero apagado. Leer una página que NO administras exige
 * que la app de Meta tenga aprobada la función "Page Public Content
 * Access" (revisión de la app + verificación del negocio). Mientras Meta
 * no la apruebe, la API solo deja leer páginas cuyo administrador tenga
 * un rol en la app — sirve para probar con la página propia, nada más.
 *
 * Para encenderlo cuando llegue la aprobación:
 *   1. Poner en Netlify FB_READ_ACCESS_TOKEN (de preferencia un token de
 *      usuario del sistema; Meta lo recomienda para no toparse con los
 *      límites de uso). Si no existe, se usa FB_PAGE_ACCESS_TOKEN.
 *   2. Cambiar `verified: true` en la fuente (sources.ts).
 *
 * Igual que con los RSS: el texto de la publicación NUNCA se copia; solo
 * es la señal con la que la redacción escribe su propia nota, y el nivel
 * de la fuente (B oficial / C solo detección) decide si puede publicarse.
 */

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function readToken(): string | undefined {
  return process.env.FB_READ_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || undefined;
}

export function isFacebookReadConfigured(): boolean {
  return !!readToken();
}

export type FacebookPost = {
  id: string;
  message: string;
  createdAt: string | null;
  permalink: string;
};

type GraphPostsResponse = {
  data?: { id?: string; message?: string; created_time?: string; permalink_url?: string }[];
  error?: { message?: string; code?: number };
};

/** Últimas publicaciones con texto de una página (las que publica la propia página, no las de visitantes). */
export async function readFacebookPagePosts(page: string, limit = 15): Promise<FacebookPost[]> {
  const token = readToken();
  if (!token) {
    throw new Error("Falta FB_READ_ACCESS_TOKEN (o FB_PAGE_ACCESS_TOKEN) — el lector de Facebook está listo pero sin credenciales.");
  }

  const url = `${GRAPH_BASE}/${encodeURIComponent(page)}/posts?fields=id,message,created_time,permalink_url&limit=${limit}`;
  // El token va en el encabezado, no en la URL, para que no quede en registros.
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  const json = (await res.json().catch(() => null)) as GraphPostsResponse | null;

  if (!res.ok || json?.error) {
    // El mensaje de Meta dice exactamente qué falta (p. ej. que la app no
    // tiene Page Public Content Access): se deja tal cual para diagnosticar.
    throw new Error(`Facebook no permitió leer la página "${page}": ${json?.error?.message || `HTTP ${res.status}`}`);
  }

  return (json?.data || [])
    .filter((p) => !!p.id && !!p.message?.trim())
    .map((p) => ({
      id: p.id as string,
      message: (p.message as string).trim(),
      createdAt: p.created_time || null,
      permalink: p.permalink_url || `https://www.facebook.com/${p.id}`,
    }));
}

/** Una publicación no trae titular: se usa su primera línea, recortada en una palabra completa. */
export function titleFromMessage(message: string, max = 140): string {
  const firstLine = (message.split(/\n+/).find((l) => l.trim()) || "").replace(/\s+/g, " ").trim();
  if (firstLine.length <= max) return firstLine;
  const cut = firstLine.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max).trim()}…`;
}

/** Convierte las publicaciones de una fuente de Facebook al mismo formato que los ítems de RSS. */
export async function fetchFacebookPage(source: Source): Promise<IngestedItem[]> {
  if (!source.facebookPage) {
    throw new Error(`La fuente "${source.id}" no tiene facebookPage configurada.`);
  }

  const posts = await readFacebookPagePosts(source.facebookPage);
  const now = new Date().toISOString();
  const maxExcerpt = source.maxExcerpt || 600;

  return posts
    .filter((post) => {
      const title = titleFromMessage(post.message);
      if (source.titleInclude && !source.titleInclude.test(title)) return false;
      if (source.mustMention && !source.mustMention.test(post.message)) return false;
      return true;
    })
    .map((post) => {
      const title = titleFromMessage(post.message);
      const excerpt = post.message.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").slice(0, maxExcerpt);
      const score = computeNewsScore({ source, publishedAt: post.createdAt, title });
      const { status, reason } = decideStatus({ source, score, title, excerpt });

      return {
        sourceId: source.id,
        sourceName: source.name,
        trustLevel: source.trustLevel,
        title,
        link: post.permalink,
        publishedAt: post.createdAt,
        excerpt,
        categoryGuess: guessCategory(`${title} ${excerpt.slice(0, 400)}`),
        newsScore: score,
        status,
        statusReason: reason,
        discoveredAt: now,
      };
    });
}
