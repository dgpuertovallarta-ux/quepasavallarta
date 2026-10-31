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
import { clasificar } from "../qpv/clasificar";

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
  /** Crédito de la foto cuando se publica la foto real sola (sin tarjeta). */
  creditoFoto?: string;
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

/**
 * Texto del post de Facebook (2026-10-31, para más interacción):
 *   - Arranca con un marcador corto de la sección (⚠️ Alerta, 💧 Servicios…).
 *   - El hecho en una o dos oraciones (qué pasó, dónde y el dato clave).
 *   - Cierra con una pregunta o invitación a comentar/compartir según el tema
 *     (nunca en nota roja, víctimas o menores).
 *   - El inglés solo en notas que le importan al turista (playa, clima, eventos…).
 *   - La liga va en el primer comentario cuando el token lo permite
 *     ("Liga en comentarios 👇"); si no, al final del texto como antes.
 */
const MARCADOR: Record<string, string> = {
  alerta: "⚠️ ALERTA", accidente: "🚨 ÚLTIMA HORA", seguridad: "🚨 SEGURIDAD", servicios: "💧 SERVICIOS",
  gobierno: "🏛️ GOBIERNO", comunidad: "📍 COMUNIDAD", trafico: "🚗 VIALIDAD", general: "📍 VALLARTA",
};
const CIERRE: Partial<Record<string, string>> = {
  alerta: "Comparte para que más gente se entere.",
  servicios: "¿Te afecta en tu colonia? Cuéntanos en comentarios.",
  gobierno: "¿Tú qué opinas?",
  comunidad: "¿Ya lo sabías? Etiqueta a quien le interese.",
  general: "¿Qué opinas? Te leemos en comentarios.",
};
const TURISTA = /\b(playa|playas|malec[oó]n|turis|visitante|hotel|crucero|aeropuerto|vuelo|clima|lluvia|calor|tormenta|hurac|oleaje|marea|evento|festival|concierto|restaurante|zona rom[aá]ntica|sayulita|punta mita|bucer[ií]as|nuevo vallarta)/i;
const SENSIBLE_POST = /\b(menor|niñ|adolescente|v[ií]ctima|abuso|violaci|feminicid|suicid|sin vida|cad[aá]ver|homicid|asesin)/i;

function textoEnlace(url: string): string {
  return url.includes("/trafico") ? `Tráfico en vivo: ${url}` : url.endsWith("/reporte") ? `Manda tu reporte aquí: ${url}` : `Lee la nota completa: ${url}`;
}

/** ¿Va el inglés en este post? Solo temas que le sirven al turista. */
export function llevaIngles(input: SocialPublishInput): boolean {
  return TURISTA.test(`${input.title} ${input.excerpt}`);
}

export function buildCaption(input: SocialPublishInput, ingles?: string | null, opts: { ligaEnComentario?: boolean } = {}): string {
  const titulo = input.title.trim().replace(/[.\s]+$/, "");
  let lede = (input.excerpt || "").trim().replace(/\s+/g, " ");
  if (lede.length < 40 || titulo.toLowerCase().includes(lede.toLowerCase().slice(0, 30))) lede = "";
  if (lede && !/[.!?…]$/.test(lede)) lede += ".";
  const cuerpo = lede ? `${titulo}. ${lede}` : `${titulo}.`;
  const c = clasificar(input.title, input.excerpt);
  const especial = input.articleUrl.endsWith("/reporte") || input.articleUrl.includes("/trafico");
  const sensible = c.tipo === "seguridad" || c.tipo === "accidente" || SENSIBLE_POST.test(`${input.title} ${input.excerpt}`);
  const marcador = especial ? "" : `${MARCADOR[c.tipo] ?? MARCADOR.general}\n\n`;
  const cierre = !especial && !sensible && CIERRE[c.tipo] ? `\n\n${CIERRE[c.tipo]}` : "";
  const pat = input.patrocinador ? `\n\nPresentado por ${input.patrocinador}.` : "";
  const credito = input.creditoFoto ? `\n\n📷 ${input.creditoFoto.replace(/^foto:?\s*/i, "Foto: ").replace(/^(?!Foto:)/, "Foto: ")}` : "";
  const en = ingles ? `\n\nEN: ${ingles}` : "";
  const enlace = opts.ligaEnComentario ? "Liga de la nota en comentarios 👇" : textoEnlace(input.articleUrl);
  return `${marcador}${cuerpo}${cierre}${en}${pat}${credito}\n\n${enlace}`;
}

/** El cuerpo del post (sin marcador, pregunta ni liga) para traducirlo. */
function cuerpoPost(input: SocialPublishInput): string {
  const titulo = input.title.trim().replace(/[.\s]+$/, "");
  const lede = (input.excerpt || "").trim().replace(/\s+/g, " ");
  return lede.length >= 40 && !titulo.toLowerCase().includes(lede.toLowerCase().slice(0, 30)) ? `${titulo}. ${lede}` : `${titulo}.`;
}

/**
 * ¿El token puede comentar como la página? Requiere el permiso
 * pages_manage_engagement. Se revisa una vez por proceso.
 */
let puedeComentarCache: Promise<boolean> | null = null;
function puedeComentar(token: string): Promise<boolean> {
  if (process.env.QPV_LIGA_EN_COMENTARIO === "0") return Promise.resolve(false);
  puedeComentarCache ??= fetch(`${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`)
    .then((r) => r.json())
    .then((j: { data?: { scopes?: string[] } }) => !!j.data?.scopes?.includes("pages_manage_engagement"))
    .catch(() => false);
  return puedeComentarCache;
}

async function comentarLiga(postId: string, url: string, token: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({ access_token: token, message: textoEnlace(url) });
    const r = await fetch(`${GRAPH_BASE}/${postId}/comments`, { method: "POST", body });
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!r.ok || j.error) console.error("[social] no se pudo comentar la liga:", j.error?.message || r.status);
    return r.ok && !j.error;
  } catch (err) {
    console.error("[social] no se pudo comentar la liga:", err);
    return false;
  }
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
    const ingles = llevaIngles(input) ? await postEnIngles(cuerpoPost(input)) : null;
    const ligaEnComentario = !!input.imageUrl && (await puedeComentar(token));
    const caption = buildCaption(input, ingles, { ligaEnComentario });
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
    const postId = json.post_id || json.id;
    // La liga va en el primer comentario; si no se pudo comentar, se agrega al texto.
    if (ligaEnComentario && postId && !(await comentarLiga(postId, input.articleUrl, token)) && json.id) {
      const upd = new URLSearchParams({ access_token: token, caption: buildCaption(input, ingles) });
      await fetch(`${GRAPH_BASE}/${json.id}`, { method: "POST", body: upd }).catch(() => undefined);
    }
    return { attempted: true, ok: true, postId };
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
