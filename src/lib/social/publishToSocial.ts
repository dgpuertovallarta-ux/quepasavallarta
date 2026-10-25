/**
 * Publicación automática en Facebook/Instagram después de publicar una nota
 * automáticamente o de que un administrador apruebe una nota en revisión.
 * Requiere variables de entorno — sin ellas, esta
 * función no hace nada (no rompe el flujo de publicación del artículo).
 *
 *   FB_PAGE_ID              — ID numérico de la página de Facebook
 *   FB_PAGE_ACCESS_TOKEN    — Token de acceso de PÁGINA (no de usuario),
 *                             de larga duración — ver /docs de este repo
 *                             (o el mensaje de Claude) para cómo obtenerlo.
 *   IG_BUSINESS_ACCOUNT_ID  — ID de la cuenta profesional de Instagram
 *                             vinculada a esa misma página de Facebook.
 *
 * Facebook e Instagram se intentan de forma independiente: si uno falla
 * (token vencido, límite de la API, etc.) no bloquea al otro ni afecta la
 * publicación del artículo en el sitio, que ya ocurrió antes de llamar
 * esta función.
 */

import { postEnIngles } from "../qpv/traducir";

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isSocialConfigured(): { facebook: boolean; instagram: boolean } {
  const hasPageToken = !!process.env.FB_PAGE_ACCESS_TOKEN;
  return {
    facebook: hasPageToken && !!process.env.FB_PAGE_ID,
    instagram: hasPageToken && !!process.env.IG_BUSINESS_ACCOUNT_ID,
  };
}

export type SocialPublishInput = {
  title: string;
  excerpt: string;
  /** URL absoluta de la noticia en el sitio (para el enlace del post). */
  articleUrl: string;
  /** URL pública de la imagen (ver generateImage.ts) — obligatoria para Instagram. */
  imageUrl?: string;
  /** Patrocinador de la sección ("Presentado por …"). */
  patrocinador?: string;
};

export type SocialPublishResult = {
  facebook: { attempted: boolean; ok: boolean; error?: string; postId?: string };
  instagram: { attempted: boolean; ok: boolean; error?: string; mediaId?: string };
};

/**
 * Instagram solo acepta fotos JPEG y las imágenes generadas se guardan en
 * PNG. El servicio de imágenes de Netlify (/.netlify/images) convierte al
 * vuelo cualquier imagen de nuestro propio dominio, así que para las
 * imágenes propias se le pide la versión JPEG; cualquier otra URL se
 * deja igual.
 */
function instagramImageUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    if (!url.pathname.startsWith("/api/image/")) return imageUrl;
    return `${url.origin}/.netlify/images?url=${encodeURIComponent(url.pathname)}&fm=jpg&q=88&w=1440`;
  } catch {
    return imageUrl;
  }
}

/**
 * Texto para Instagram: ahí los enlaces del texto no se pueden abrir, así
 * que en vez de la dirección completa se menciona el sitio, y se agregan
 * las etiquetas con las que la gente busca noticias de Vallarta.
 */
function buildInstagramCaption(input: SocialPublishInput): string {
  const parts = [input.title.trim()];
  if (input.excerpt.trim()) parts.push(input.excerpt.trim());
  parts.push("Nota completa en quepasavta.com");
  parts.push("#PuertoVallarta #BahíaDeBanderas #QuéPasaVallarta");
  return parts.join("\n\n").slice(0, 2100);
}

/** Facebook: una frase con el dato clave + el enlace (línea editorial 2026-10: sin párrafos ni hashtags). */
/**
 * Texto del post al estilo N+ (2026-10): el hecho contado en una o dos
 * oraciones completas —qué pasó, dónde y el dato clave—, sin emojis ni
 * frases de gancho, y al final la liga a la nota.
 */
export function buildCaption(input: SocialPublishInput, ingles?: string | null): string {
  const titulo = input.title.trim().replace(/[.\s]+$/, "");
  let lede = (input.excerpt || "").trim().replace(/\s+/g, " ");
  if (lede.length < 40 || titulo.toLowerCase().includes(lede.toLowerCase().slice(0, 30))) lede = "";
  if (lede && !/[.!?…]$/.test(lede)) lede += ".";
  const cuerpo = lede ? `${titulo}. ${lede}` : `${titulo}.`;
  const enlace = input.articleUrl.includes("/trafico")
    ? `Tráfico en vivo: ${input.articleUrl}`
    : input.articleUrl.endsWith("/reporte")
      ? `Manda tu reporte aquí: ${input.articleUrl}`
      : `Lee la nota completa: ${input.articleUrl}`;
  // 2026-10-24: debajo, la versión en inglés (Vallarta tiene mucho público extranjero).
  const pat = input.patrocinador ? `\n\nPresentado por ${input.patrocinador}.` : "";
  return ingles ? `${cuerpo}\n\nEN: ${ingles}${pat}\n\n${enlace}` : `${cuerpo}${pat}\n\n${enlace}`;
}

/** El cuerpo del post (sin la liga) para traducirlo. */
function cuerpoPost(input: SocialPublishInput): string {
  return buildCaption({ ...input, patrocinador: undefined }).split("\n\n")[0];
}

async function postToFacebook(input: SocialPublishInput): Promise<SocialPublishResult["facebook"]> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return { attempted: false, ok: false };

  try {
    // Con imagen: /photos publica una foto con el texto como caption.
    // Sin imagen (no debería pasar en el flujo normal, pero por si
    // falla la generación): /feed publica un post de solo texto+enlace.
    const endpoint = input.imageUrl ? `${GRAPH_BASE}/${pageId}/photos` : `${GRAPH_BASE}/${pageId}/feed`;
    const body = new URLSearchParams({ access_token: token });
    const caption = buildCaption(input, await postEnIngles(cuerpoPost(input)));
    if (input.imageUrl) {
      body.set("url", input.imageUrl);
      body.set("caption", caption);
    } else {
      body.set("message", caption);
      body.set("link", input.articleUrl);
    }

    const res = await fetch(endpoint, { method: "POST", body });
    const json = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
    if (!res.ok || json.error) {
      return { attempted: true, ok: false, error: json.error?.message || `HTTP ${res.status}` };
    }
    return { attempted: true, ok: true, postId: json.post_id || json.id };
  } catch (err) {
    return { attempted: true, ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

async function postToInstagram(input: SocialPublishInput): Promise<SocialPublishResult["instagram"]> {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!igUserId || !token) return { attempted: false, ok: false };

  // Instagram exige imagen — sin eso no hay nada que publicar (a
  // diferencia de Facebook, que puede hacer un post de solo texto).
  if (!input.imageUrl) {
    return { attempted: true, ok: false, error: "Sin imagen — Instagram no admite publicaciones de solo texto." };
  }

  try {
    // Paso 1: crear el contenedor de medios.
    const createBody = new URLSearchParams({
      access_token: token,
      image_url: instagramImageUrl(input.imageUrl),
      caption: buildInstagramCaption(input),
    });
    const createRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, { method: "POST", body: createBody });
    const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || createJson.error || !createJson.id) {
      return { attempted: true, ok: false, error: createJson.error?.message || `HTTP ${createRes.status} al crear el contenedor` };
    }

    // Instagram procesa la foto antes de dejarla publicar; casi siempre
    // está lista al instante, pero si se publica antes de tiempo falla.
    // Se consulta el estado unas pocas veces (máximo ~6 s).
    for (let attempt = 0; attempt < 4; attempt++) {
      const statusRes = await fetch(`${GRAPH_BASE}/${createJson.id}?fields=status_code`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const statusJson = (await statusRes.json().catch(() => null)) as { status_code?: string } | null;
      if (!statusJson?.status_code || statusJson.status_code === "FINISHED") break;
      if (statusJson.status_code === "ERROR" || statusJson.status_code === "EXPIRED") {
        return { attempted: true, ok: false, error: `Instagram no pudo procesar la imagen (${statusJson.status_code}).` };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Paso 2: publicar el contenedor ya creado.
    const publishBody = new URLSearchParams({ access_token: token, creation_id: createJson.id });
    const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, { method: "POST", body: publishBody });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message?: string } };
    if (!publishRes.ok || publishJson.error) {
      return { attempted: true, ok: false, error: publishJson.error?.message || `HTTP ${publishRes.status} al publicar` };
    }
    return { attempted: true, ok: true, mediaId: publishJson.id };
  } catch (err) {
    return { attempted: true, ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Publica en Facebook e Instagram en paralelo. Nunca lanza — cada red
 * social reporta su propio resultado, y esta función se llama DESPUÉS de
 * que el artículo ya se publicó en el sitio (ver autoPublish.ts), así que
 * un fallo aquí nunca revierte ni bloquea la publicación real.
 */
export async function publishToSocial(input: SocialPublishInput): Promise<SocialPublishResult> {
  const [facebook, instagram] = await Promise.all([postToFacebook(input), postToInstagram(input)]);
  return { facebook, instagram };
}
