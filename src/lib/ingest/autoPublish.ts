import type { Story } from "./storyGraph";
import { isAutoPublishEligible } from "./storyGraph";
import { generateArticleDraft, isAiConfigured } from "./generateArticle";
import { parseArticleDraft, looksLikeInsufficientMaterial } from "./articleFormat";
import { generateArticleImage } from "./generateImage";
import { hasPublishedArticleForStory, findSimilarRecentArticle, publishArticle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { publishToSocial } from "../social/publishToSocial";
import { siteUrl } from "../storage/imageBlobs";

// Límite por corrida — cada auto-publicación llama a la API de Claude
// (varios segundos) y ahora también genera una imagen con IA (otra
// llamada de varios segundos) y la sube a Netlify Blobs, todo dentro del
// mismo request de /api/ingest, que ya gasta tiempo descargando las
// fuentes RSS. Bajado de 3 a 1 (2026-09) porque con 3 el request completo
// empezó a tardar más de lo que el proxy de Netlify tolera en una
// invocación síncrona — la conexión se cortaba a medias sin ni siquiera
// devolver el error, dejando /api/ingest "colgado" para quien lo visita
// y, más grave, probablemente también para el cron programado. Las
// Stories que no alcancen esta corrida se recogen en la siguiente (cada
// 30 min) — no se pierden, solo se reparten en el tiempo.
const MAX_AUTO_PUBLISH_PER_RUN = 1;

export type AutoPublishResult = {
  attempted: number;
  published: number;
  alreadyPublished: number;
  errors: { storyId: string; error: string }[];
  social: { facebookPublished: number; instagramPublished: number; errors: string[] };
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
  const result: AutoPublishResult = {
    attempted: 0,
    published: 0,
    alreadyPublished: 0,
    errors: [],
    social: { facebookPublished: 0, instagramPublished: 0, errors: [] },
  };
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

      // Sin excepción en este flujo (sin humano de por medio): si la IA
      // no tuvo material suficiente, no se publica nada — a diferencia
      // del botón manual del panel, que sí puede mostrárselo a un humano.
      if (looksLikeInsufficientMaterial(draft.draft)) {
        throw new Error(
          `La IA determinó que no hay material suficiente para "${story.labelSeed}" — no se auto-publica.`
        );
      }

      const { title, excerpt, bodyParagraphs } = parseArticleDraft(draft.draft);

      // Red de seguridad extra: la misma historia real puede generar dos
      // STORY ID distintos entre corridas (si el titular de la fuente
      // varió mínimamente) — ya pasó una vez y publicó la misma noticia
      // dos veces. Se compara por similitud de título, no solo por storyId.
      const similarSlug = await findSimilarRecentArticle(title);
      if (similarSlug) {
        throw new Error(`Ya existe un artículo muy similar publicado recientemente (${similarSlug}) — se omite para no duplicar.`);
      }

      // Imagen 100% generada por IA (nunca la foto real del hecho) — ver
      // generateImage.ts. Si falla, publishArticle cae de vuelta a la
      // imagen ilustrativa por categoría, igual que antes con la fuente.
      const primarySource = story.items[0];
      const generatedImage = await generateArticleImage({
        title,
        excerpt,
        categorySlug: primarySource.categoryGuess,
        sourceUrl: primarySource.link,
      });

      const { slug } = await publishArticle({
        title,
        excerpt,
        body: bodyParagraphs.join("\n\n"),
        categorySlug: primarySource.categoryGuess,
        newsScore: story.maxNewsScore,
        aiModel: draft.model,
        storyExternalKey: story.storyId,
        imageUrl: generatedImage?.url,
        imageCredit: generatedImage ? "Imagen generada con IA" : undefined,
        imageLicenseStatus: generatedImage ? "ai_generated" : undefined,
      });
      result.published++;

      // Publicación en redes — nunca bloquea ni revierte lo anterior, el
      // artículo ya quedó publicado en el sitio en este punto. Sin las
      // variables de entorno de Facebook/Instagram configuradas, esto no
      // hace nada (ver publishToSocial.ts).
      const social = await publishToSocial({
        title,
        excerpt,
        articleUrl: `${siteUrl()}/noticia/${slug}`,
        imageUrl: generatedImage?.url,
      });
      if (social.facebook.ok) result.social.facebookPublished++;
      else if (social.facebook.attempted) result.social.errors.push(`Facebook (${slug}): ${social.facebook.error}`);
      if (social.instagram.ok) result.social.instagramPublished++;
      else if (social.instagram.attempted) result.social.errors.push(`Instagram (${slug}): ${social.instagram.error}`);
    } catch (err) {
      result.errors.push({ storyId: story.storyId, error: err instanceof Error ? err.message : "Error desconocido" });
    }
  }

  return result;
}
