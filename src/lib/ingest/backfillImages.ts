import { generateArticleImage, isImageAiConfigured } from "./generateImage";
import { getArticlesNeedingImageBackfill, updateArticleImage } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";

// Cada artículo tarda unos segundos (llamada a Gemini + guardar en Netlify
// Blobs). Bajado de 6 a 2 (2026-09) por el mismo motivo que
// MAX_AUTO_PUBLISH_PER_RUN en autoPublish.ts — con lotes grandes el
// request completo tardaba más de lo que el proxy de Netlify tolera en
// una invocación síncrona y la conexión se cortaba sin devolver
// respuesta. Se corre llamando al endpoint varias veces seguidas hasta
// que "remaining" salga en false.
const MAX_BACKFILL_PER_RUN = 2;

export type BackfillResult = {
  attempted: number;
  updated: number;
  errors: { slug: string; error: string }[];
  /** true si probablemente queden más artículos por procesar — hay que volver a llamar este endpoint. */
  remaining: boolean;
};

/**
 * Repasa artículos YA publicados (noticias y Vallarta Explica) que se
 * publicaron antes de que existiera generateImage.ts, y por eso siguen
 * mostrando la foto ilustrativa repetida por categoría — les genera una
 * imagen propia con IA y reemplaza `image_url`. Decisión del propietario
 * (2026-09): "ya no quiero fotos repetidas en las noticias viejas".
 */
export async function runImageBackfill(): Promise<BackfillResult> {
  const result: BackfillResult = { attempted: 0, updated: 0, errors: [], remaining: false };
  if (!isImageAiConfigured() || !isDatabaseConfigured()) return result;

  // Pedimos uno más del límite del lote solo para saber si queda trabajo
  // pendiente, sin tener que hacer una segunda consulta de conteo.
  const candidates = await getArticlesNeedingImageBackfill(MAX_BACKFILL_PER_RUN + 1);
  result.remaining = candidates.length > MAX_BACKFILL_PER_RUN;
  const batch = candidates.slice(0, MAX_BACKFILL_PER_RUN);

  for (const article of batch) {
    result.attempted++;
    try {
      const generated = await generateArticleImage({
        title: article.title,
        excerpt: article.excerpt,
        categorySlug: article.categorySlug,
        sourceUrl: article.sourceUrl,
      });
      if (!generated) {
        result.errors.push({ slug: article.slug, error: "La IA no devolvió una imagen." });
        continue;
      }
      await updateArticleImage(article.slug, { imageUrl: generated.url, imageCredit: "Imagen generada con IA" });
      result.updated++;
    } catch (err) {
      result.errors.push({ slug: article.slug, error: err instanceof Error ? err.message : "Error desconocido" });
    }
  }

  return result;
}
