import { GoogleGenAI } from "@google/genai";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

export function isImageAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export type GeneratedImage = {
  dataUrl: string;
  model: string;
};

// Vocabulario visual por categoría — mismo criterio que CATEGORY_IMAGES en
// db/articles.ts, pero como descripción de escena para la IA en vez de un
// banco de fotos fijo. Mantiene consistencia visual del sitio sin usar
// nunca la foto real del hecho.
const CATEGORY_VISUAL_HINTS: Record<string, string> = {
  "ultima-hora": "el malecón de Puerto Vallarta al atardecer, luces difusas de fondo, tono urgente pero sobrio",
  seguridad: "una calle de Puerto Vallarta con presencia de autoridad a distancia, luz de tarde, estilo fotoperiodístico sobrio",
  gobierno: "el palacio municipal o una oficina de gobierno de Puerto Vallarta, fachada institucional",
  comunidad: "vecinos y vida de barrio en una calle empedrada de Puerto Vallarta",
  turismo: "la bahía de Banderas con veleros y el malecón, luz cálida de atardecer",
  economia: "un mercado o zona comercial de Puerto Vallarta, ambiente cotidiano",
  negocios: "una fachada de negocio local en el centro de Puerto Vallarta",
  transito: "una avenida de Puerto Vallarta con tráfico y semáforos, vista de calle",
  playas: "una playa de Puerto Vallarta con palmeras, arena y mar turquesa",
  clima: "cielo dramático sobre la bahía de Banderas, nubes de tormenta o sol intenso según el tema",
  cultura: "una plaza o evento cultural en el malecón de Puerto Vallarta",
  gastronomia: "un puesto de comida callejera o restaurante costero en Puerto Vallarta",
  eventos: "una multitud genérica en un evento público en el malecón de Puerto Vallarta",
  entretenimiento: "una escena nocturna de entretenimiento en el malecón de Puerto Vallarta",
  deportes: "una cancha o actividad deportiva al aire libre en Puerto Vallarta",
  "medio-ambiente": "la selva costera o el mar de Bahía de Banderas, tono conservacionista",
  servicios: "trabajadores de servicios públicos en una calle de Puerto Vallarta",
  politica: "el palacio municipal de Puerto Vallarta o una plaza pública",
  jalisco: "un paisaje representativo del estado de Jalisco",
  mexico: "un paisaje representativo de México",
  mundo: "una imagen editorial genérica de noticias internacionales",
};

function buildPrompt(title: string, excerpt: string, categorySlug: string): string {
  const hint = CATEGORY_VISUAL_HINTS[categorySlug] || CATEGORY_VISUAL_HINTS["comunidad"];
  const context = `Tema de la noticia: "${title}". ${excerpt || ""}`.slice(0, 600);
  return [
    "Genera UNA fotografía editorial realista (no ilustración, no dibujo, no render 3D evidente) para acompañar una noticia local de un sitio de noticias.",
    context,
    `Escena sugerida: ${hint}.`,
    "Estilo: fotoperiodismo, luz natural, composición horizontal 16:9, colores cálidos consistentes con Puerto Vallarta (dorados, azules del mar).",
    "IMPORTANTE — restricciones estrictas:",
    "- NO incluyas texto, letras, números, logotipos ni marcas de agua en la imagen.",
    "- NO representes a ninguna persona real, famosa o identificable — si aparecen personas, deben ser genéricas y no reconocibles (de espaldas, a distancia, o sin protagonismo del rostro).",
    "- NO copies el estilo, logo o diseño de ningún medio de noticias existente.",
    "- Es una imagen ilustrativa y genérica del tema, no una fotografía del hecho específico — no la presentes como si fuera evidencia real del suceso.",
  ].join("\n");
}

/**
 * Genera una imagen 100% original con IA para acompañar un artículo —
 * reemplaza la extracción de la foto real de la fuente (extractImage.ts),
 * eliminando el riesgo de derechos de autor que esa función traía
 * documentado (ver extractImage.ts). Devuelve un data URL (base64) listo
 * para usarse directamente como `imageUrl` en publishArticle — no
 * requiere almacenamiento externo ni configurar dominios de imágenes.
 *
 * Nunca lanza: si falla, no hay GEMINI_API_KEY, o el modelo no devuelve
 * una imagen, retorna null y el llamador cae de vuelta al banco de fotos
 * ilustrativas por categoría (mismo patrón que extractOgImage antes).
 */
export async function generateArticleImage(input: {
  title: string;
  excerpt: string;
  categorySlug: string;
}): Promise<GeneratedImage | null> {
  if (!isImageAiConfigured()) return null;

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = buildPrompt(input.title, input.excerpt, input.categorySlug);

    let response;
    try {
      response = await client.models.generateContent({ model: IMAGE_MODEL, contents: prompt });
    } catch (err) {
      // Mismo patrón de reintento que generateArticle.ts — el tier gratuito
      // de Gemini a veces devuelve 503 "high demand" transitorio.
      const isOverloaded = err instanceof Error && /503|UNAVAILABLE|high demand/i.test(err.message);
      if (!isOverloaded) throw err;
      await new Promise((r) => setTimeout(r, 2500));
      response = await client.models.generateContent({ model: IMAGE_MODEL, contents: prompt });
    }

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) return null;

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return { dataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}`, model: IMAGE_MODEL };
  } catch (err) {
    console.error("[generateArticleImage] Falló la generación de imagen:", err instanceof Error ? err.message : err);
    return null;
  }
}
