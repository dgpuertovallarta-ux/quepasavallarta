import type { Story } from "./storyGraph";
import { isAutoPublishEligible } from "./storyGraph";
import { generateArticleDraft, isAiConfigured } from "./generateArticle";
import { parseArticleDraft } from "./articleFormat";
import { extractOgImage } from "./extractImage";
import { hasPublishedArticleForStory, publishArticle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";

// Límite por corrida — cada auto-publicación llama a la API de Claude
// (varios segundos) y ahora también intenta descargar la página de la
// fuente para extraer su foto (hasta 8s más), todo dentro del mismo
// request de /api/ingest, que ya gasta tiempo descargando las fuentes
// RSS. Un número bajo evita exceder el límite de duración de la función
// serverless en Netlify (maxDuration=60s en la route). Las que no
// alcancen esta corrida se recogen en la siguiente (cada 30 min) — no
// se pierden, solo se reparten en el tiempo.
const MAX_AUTO_PUBLISH_PER_RUN = 3;

export type AutoPublishResult = {
  attempted: number;
  published: number;
  alreadyPublished: number;
  errors: { storyId: string; error: string }[];
};

/**
 * Publica automáticamente, sin revisión humana, las Stories NIVEL A/B
 * elegibles (ver isAutoPublishEligible: corroboradas, no sensibles, no
 * NIVEL C/D). Decisión explícita del propietario (2026-09) para que el
 * sitio se llene solo — antes esto requería aprobar cada nota desde
 * /admin. Sigue sin tocar: contenido sensible, fuentes NIVEL C/D, y
 * cualquier Story que ya tenga un artículo publicado (evita duplicados
 * en cada corrida del cron).
 */
export async function runAutoPublish(stories: Story[]): Promise<AutoPublishResult> {
  const result: AutoPublishResult = { attempted: 0, published: 0, alreadyPublished: 0, errors: [] };
  if (!isAiConfigured() || !isDatabaseConfigured()) return result;

  const eligible = stories.filter(isAutoPublishEligible).slice(0, MAX_AUTO_PUBLISH_PER_RUN);

  for (const story of eligible) {
    try {
      const already = await hasPublishedArticleForStory(story.storyId);
      if (already) {
        result.alreadyPublished++;
        continue;
      }

      result.attempted++;
      const draft = await generateArticleDraft(story);
      const { title, excerpt, bodyParagraphs } = parseArticleDraft(draft.draft);

      // Foto real de la fuente (decisión del propietario, con el riesgo de
      // derechos de autor ya explicado — ver extractImage.ts). Si falla,
      // publishArticle cae de vuelta a la imagen ilustrativa por categoría.
      const primarySource = story.items[0];
      const extractedImage = await extractOgImage(primarySource.link);

      await publishArticle({
        title,
        excerpt,
        body: bodyParagraphs.join("\n\n"),
        categorySlug: primarySource.categoryGuess,
        newsScore: story.maxNewsScore,
        aiModel: draft.model,
        storyExternalKey: story.storyId,
        imageUrl: extractedImage?.url,
        imageSourceUrl: extractedImage?.sourceUrl,
        imageCredit: primarySource.sourceName,
      });
      result.published++;
    } catch (err) {
      result.errors.push({ storyId: story.storyId, error: err instanceof Error ? err.message : "Error desconocido" });
    }
  }

  return result;
}
