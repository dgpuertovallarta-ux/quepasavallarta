import type { Story } from "./storyGraph";
import { isAutoPublishEligible } from "./storyGraph";
import { generateExplainerDraft, isAiConfigured } from "./generateArticle";
import { parseArticleDraft, looksLikeInsufficientMaterial } from "./articleFormat";
import { extractOgImage } from "./extractImage";
import { hasExplainerForStory, getLastExplainerPublishedAt, findSimilarRecentArticle, publishArticle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";

// ~4 al día: solo genera uno nuevo si pasaron al menos 5.5 horas desde el
// último (24h / 4 ≈ 6h, con margen para que no dependa de que el cron
// caiga justo en la hora exacta). No es una cuenta exacta de calendario,
// es un espaciado — el resultado real es "aproximadamente 4 al día".
const MIN_HOURS_BETWEEN_EXPLAINERS = 5.5;

export type ExplicaPublishResult =
  | { ran: false; reason: string }
  | { ran: true; published: boolean; storyId?: string; error?: string };

/**
 * Genera y publica UN artículo real de "Vallarta Explica" por corrida,
 * como mucho — y solo si ya pasó suficiente tiempo desde el último (ver
 * MIN_HOURS_BETWEEN_EXPLAINERS). Elige la Story elegible con mejor
 * puntaje que todavía no tenga un explicador (puede ser la misma que ya
 * se cubrió como noticia breve — un explicador profundiza, no reemplaza
 * la nota). Mismas reglas duras que las noticias: nunca sin
 * corroboración NIVEL A/B, nunca contenido sensible vía NIVEL C/D, nunca
 * un "resumen interno" publicado como si fuera una pieza real.
 */
export async function runExplicaPublish(stories: Story[]): Promise<ExplicaPublishResult> {
  if (!isAiConfigured() || !isDatabaseConfigured()) {
    return { ran: false, reason: "ANTHROPIC_API_KEY o DATABASE_URL no configuradas." };
  }

  const lastAt = await getLastExplainerPublishedAt();
  if (lastAt) {
    const hoursSince = (Date.now() - lastAt.getTime()) / 3_600_000;
    if (hoursSince < MIN_HOURS_BETWEEN_EXPLAINERS) {
      return { ran: false, reason: `Último explicador hace ${hoursSince.toFixed(1)}h — todavía no toca (cada ${MIN_HOURS_BETWEEN_EXPLAINERS}h, ~4/día).` };
    }
  }

  const eligible = stories.filter(isAutoPublishEligible);

  for (const story of eligible) {
    if (await hasExplainerForStory(story.storyId)) continue;

    try {
      const draft = await generateExplainerDraft(story);
      if (looksLikeInsufficientMaterial(draft.draft)) continue;

      const { title, excerpt, bodyParagraphs } = parseArticleDraft(draft.draft);

      const similarSlug = await findSimilarRecentArticle(title, { isExplainer: true });
      if (similarSlug) {
        return { ran: true, published: false, storyId: story.storyId, error: `Ya existe un explicador muy similar (${similarSlug}).` };
      }

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
        isExplainer: true,
      });

      return { ran: true, published: true, storyId: story.storyId };
    } catch (err) {
      return { ran: true, published: false, storyId: story.storyId, error: err instanceof Error ? err.message : "Error desconocido" };
    }
  }

  return { ran: true, published: false };
}
