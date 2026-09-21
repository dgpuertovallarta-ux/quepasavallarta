import { GoogleGenAI } from "@google/genai";
import { saveImageBlob } from "../storage/imageBlobs";
import { extractOgImage } from "./extractImage";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

export function isImageAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export type GeneratedImage = {
  /** URL pública real (Netlify Blobs, servida vía /api/image/[key]) — no un data URL. Publicable en Instagram/Facebook. */
  url: string;
  model: string;
};

// Vocabulario visual por categoría — varias variantes por categoría (no
// una sola frase fija) para que, cuando no haya foto de referencia real,
// no se repita siempre la misma composición. Se elige una variante de
// forma determinística según el título del artículo (ver pickVariant).
const CATEGORY_VISUAL_HINTS: Record<string, string[]> = {
  "ultima-hora": [
    "el malecón de Puerto Vallarta al atardecer, luces difusas de fondo, tono urgente pero sobrio",
    "una esquina del centro de Puerto Vallarta de noche, luces de la calle, ambiente de alerta",
    "una vista aérea baja del centro de Puerto Vallarta al anochecer, tono informativo",
  ],
  seguridad: [
    "una calle de Puerto Vallarta con presencia de autoridad a distancia, luz de tarde, estilo fotoperiodístico sobrio",
    "una patrulla estacionada en una avenida de Puerto Vallarta de noche, luces intermitentes difusas",
    "una zona residencial tranquila de Puerto Vallarta con una caseta de vigilancia, luz de atardecer",
  ],
  gobierno: [
    "el palacio municipal de Puerto Vallarta, fachada institucional de día",
    "una sala de juntas o auditorio institucional sobrio, sin personas identificables",
    "una plaza pública frente a un edificio de gobierno de Puerto Vallarta",
  ],
  comunidad: [
    "una calle empedrada de un barrio de Puerto Vallarta, vecinos caminando de espaldas",
    "un mercado de barrio en Puerto Vallarta, puestos y gente comprando de espaldas",
    "una banqueta con casas de colores en la Zona Romántica, plantas y macetas",
    "una plaza de barrio con una fuente pequeña y árboles, gente sentada a distancia",
  ],
  turismo: [
    "la bahía de Banderas con veleros y el malecón, luz cálida de atardecer",
    "una playa turística de Puerto Vallarta con palapas y camastros, mañana soleada",
    "un mirador con vista al pueblo y al mar desde las colinas de Puerto Vallarta",
  ],
  economia: [
    "un mercado o zona comercial de Puerto Vallarta, ambiente cotidiano de día",
    "una fila de comercios pequeños en una calle del centro, movimiento de gente de espaldas",
    "una oficina bancaria o cajero automático en una calle de Puerto Vallarta",
  ],
  negocios: [
    "una fachada de negocio local en el centro de Puerto Vallarta, letrero genérico sin marca real",
    "el interior de un pequeño restaurante o tienda local, luz cálida, sin personas identificables",
    "una terraza de café en la Zona Romántica al atardecer",
  ],
  transito: [
    "una avenida de Puerto Vallarta con tráfico y semáforos, vista de calle de día",
    "un cruce peatonal concurrido en el centro de Puerto Vallarta",
    "una vialidad costera con autos y camiones al atardecer",
  ],
  playas: [
    "una playa de Puerto Vallarta con palmeras, arena y mar turquesa, mañana soleada",
    "una playa rocosa con oleaje en Puerto Vallarta, cielo parcialmente nublado",
    "una palapa vacía en la orilla del mar al atardecer",
  ],
  clima: [
    "cielo dramático con nubes de tormenta sobre la bahía de Banderas",
    "un cielo despejado e intenso sol de mediodía sobre el malecón",
    "lluvia cayendo sobre una calle de Puerto Vallarta, reflejos en el pavimento",
  ],
  cultura: [
    "una plaza con un evento cultural en el malecón de Puerto Vallarta, luces de noche",
    "un mural o fachada colorida típica del centro de Puerto Vallarta",
    "un grupo de danza folclórica genérico en una plaza pública, de espaldas o a distancia",
  ],
  gastronomia: [
    "un puesto de comida callejera en Puerto Vallarta, humo y luces cálidas de noche",
    "una mesa de mariscos frescos en un restaurante costero, luz de día",
    "un mercado de comida local con puestos coloridos",
  ],
  eventos: [
    "una multitud genérica en un evento público en el malecón de Puerto Vallarta, de noche",
    "un escenario iluminado en una plaza pública, público de espaldas",
    "puestos y luces de una feria o festival callejero",
  ],
  entretenimiento: [
    "una escena nocturna de entretenimiento en el malecón de Puerto Vallarta, luces de neón difusas",
    "una terraza con música en vivo genérica, luces cálidas de noche",
    "un bar o antro en la Zona Romántica, ambiente nocturno sin rostros reconocibles",
  ],
  deportes: [
    "una cancha o actividad deportiva al aire libre en Puerto Vallarta, día soleado",
    "corredores en el malecón al amanecer, de espaldas",
    "una cancha de voleibol de playa con jugadores genéricos a distancia",
  ],
  "medio-ambiente": [
    "la selva costera de Bahía de Banderas, vegetación densa y neblina",
    "el mar de Puerto Vallarta con manglares en primer plano",
    "una playa con voluntarios recogiendo basura, de espaldas y a distancia",
  ],
  servicios: [
    "trabajadores de servicios públicos en una calle de Puerto Vallarta, de espaldas",
    "una cuadrilla reparando una tubería o cableado en la vía pública",
    "un camión de servicios municipales estacionado en una calle residencial",
  ],
  politica: [
    "el palacio municipal de Puerto Vallarta de día",
    "una plaza pública con un templete o tarima genérica, sin personas identificables",
    "un salón de sesiones institucional sobrio",
  ],
  jalisco: [
    "un paisaje representativo del estado de Jalisco, montañas y campo",
    "una plaza colonial típica de un pueblo de Jalisco",
  ],
  mexico: [
    "un paisaje representativo de México, arquitectura colonial genérica",
    "una plaza pública mexicana típica, bandera al fondo",
  ],
  mundo: [
    "una imagen editorial genérica de noticias internacionales, mapa o globo terráqueo desenfocado",
    "un aeropuerto o terminal internacional genérica",
  ],
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Elige una variante de forma determinística según el título — mismo artículo siempre da la misma variante, pero artículos distintos varían. */
function pickVariant(categorySlug: string, title: string): string {
  const variants = CATEGORY_VISUAL_HINTS[categorySlug] || CATEGORY_VISUAL_HINTS["comunidad"];
  return variants[hashString(title) % variants.length];
}

function buildPrompt(title: string, excerpt: string, categorySlug: string, hasReference: boolean): string {
  const hint = pickVariant(categorySlug, title);
  const context = `Tema de la noticia: "${title}". ${excerpt || ""}`.slice(0, 600);
  const lines = [
    "Genera UNA fotografía editorial realista (no ilustración, no dibujo, no render 3D evidente) para acompañar una noticia local de un sitio de noticias.",
    context,
  ];
  if (hasReference) {
    lines.push(
      "Se adjunta una fotografía de referencia tomada de la cobertura original del hecho. Es la fuente principal de la escena: usa su lugar específico, tipo de edificio o entorno, clima, hora del día, colores y composición general como base real de tu imagen — PRIORIZA lo que muestra la referencia por encima de cualquier escena típica o genérica del tema. Si la referencia muestra un interior, una oficina, un vehículo, un objeto concreto, etc., tu imagen debe reflejar ESO específicamente, no una vista genérica de calle o malecón.",
      "Estilo: fotoperiodismo, luz natural, composición horizontal 16:9 — mantén la paleta de color y el ambiente de la referencia en vez de forzar tonos dorados/azules genéricos si no corresponden a la escena real."
    );
  } else {
    lines.push(
      `Escena sugerida: ${hint}.`,
      "Estilo: fotoperiodismo, luz natural, composición horizontal 16:9, colores cálidos consistentes con Puerto Vallarta (dorados, azules del mar).",
      "Varía la composición, el ángulo, la hora del día y los elementos concretos de la escena respecto a otras imágenes que hayas generado antes para este mismo tema — evita repetir siempre la misma toma tipo postal (p. ej. la misma calle empedrada bajando hacia el mar con dos personas caminando de espaldas cargando bolsas)."
    );
  }
  lines.push(
    "IMPORTANTE — restricciones estrictas:",
    "- NO incluyas texto, letras, números, logotipos ni marcas de agua en la imagen.",
    "- NO representes a ninguna persona real, famosa o identificable — si aparecen personas, deben ser genéricas y no reconocibles (de espaldas, a distancia, o sin protagonismo del rostro).",
    "- NO copies el estilo, logo o diseño de ningún medio de noticias existente.",
    hasReference
      ? "- NO reproduzcas ni copies la fotografía de referencia tal cual — dibuja una imagen enteramente nueva y original que reinterprete esa misma escena específica, nunca una reproducción de ella ni de su encuadre exacto."
      : "- Es una imagen ilustrativa y genérica del tema, no una fotografía del hecho específico — no la presentes como si fuera evidencia real del suceso."
  );
  return lines.join("\n");
}

/**
 * Descarga la foto real del artículo original (si existe y se puede
 * acceder) para usarla como referencia visual — nunca se envía tal cual
 * al sitio ni se guarda, solo se le muestra a la IA para que la escena
 * generada corresponda al lugar/entorno real en vez de ser genérica.
 * Nunca lanza; límite de tamaño para no exceder el request a Gemini.
 */
async function fetchReferenceImage(sourceUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const extracted = await extractOgImage(sourceUrl);
    if (!extracted) return null;

    const res = await fetch(extracted.url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const mimeType = res.headers.get("content-type") || "";
    if (!mimeType.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 4 * 1024 * 1024) return null; // 4MB máx para el request a Gemini

    return { data: buffer.toString("base64"), mimeType };
  } catch (err) {
    console.error(`[fetchReferenceImage] Falló para ${sourceUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Genera una imagen 100% original con IA para acompañar un artículo —
 * reemplaza la extracción de la foto real de la fuente (extractImage.ts),
 * eliminando el riesgo de derechos de autor que esa función traía
 * documentado (ver extractImage.ts). Devuelve un data URL (base64) listo
 * para usarse directamente como `imageUrl` en publishArticle — no
 * requiere almacenamiento externo ni configurar dominios de imágenes.
 *
 * La imagen se guarda en Netlify Blobs y se sirve desde nuestro propio
 * dominio (/api/image/[key]) — así la URL es públicamente descargable,
 * requisito de la API de Instagram/Facebook para publicar (ver
 * lib/social/). Nunca lanza: si falla, no hay GEMINI_API_KEY, o el
 * modelo no devuelve una imagen, retorna null y el llamador cae de
 * vuelta al banco de fotos ilustrativas por categoría (mismo patrón que
 * extractOgImage antes).
 */
export async function generateArticleImage(input: {
  title: string;
  excerpt: string;
  categorySlug: string;
  /** Link al artículo original — si se puede acceder a su foto, se usa como referencia visual (ver fetchReferenceImage). */
  sourceUrl?: string;
}): Promise<GeneratedImage | null> {
  if (!isImageAiConfigured()) return null;

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const reference = input.sourceUrl ? await fetchReferenceImage(input.sourceUrl) : null;
    const prompt = buildPrompt(input.title, input.excerpt, input.categorySlug, !!reference);

    const requestParts: object[] = [{ text: prompt }];
    if (reference) requestParts.push({ inlineData: { mimeType: reference.mimeType, data: reference.data } });
    const contents = [{ role: "user", parts: requestParts }];

    let response;
    try {
      response = await client.models.generateContent({ model: IMAGE_MODEL, contents });
    } catch (err) {
      // Mismo patrón de reintento que generateArticle.ts — el tier gratuito
      // de Gemini a veces devuelve 503 "high demand" transitorio.
      const isOverloaded = err instanceof Error && /503|UNAVAILABLE|high demand/i.test(err.message);
      if (!isOverloaded) throw err;
      await new Promise((r) => setTimeout(r, 2500));
      response = await client.models.generateContent({ model: IMAGE_MODEL, contents });
    }

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) return null;

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const bytes = Buffer.from(imagePart.inlineData.data, "base64");
    const { url } = await saveImageBlob(bytes, mimeType);
    return { url, model: IMAGE_MODEL };
  } catch (err) {
    console.error("[generateArticleImage] Falló la generación de imagen:", err instanceof Error ? err.message : err);
    return null;
  }
}
