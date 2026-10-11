import type { Story } from "./storyGraph";
import { isAutoPublishEligible } from "./storyGraph";
import { generateArticleDraft, isAiConfigured } from "./generateArticle";
import { parseArticleDraft, looksLikeInsufficientMaterial, isBadTitle } from "./articleFormat";
import { generateArticleImage } from "./generateImage";
import { hasPublishedArticleForStory, findDuplicateTitle, getRecentArticleTitles, publishArticle, type RecentTitle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { publishToSocial } from "../social/publishToSocial";
import { siteUrl } from "../storage/imageBlobs";
import { sortByEditorialFocus, isOffTopicStory, isOfficialBulletinStory } from "./localFocus";
import { loadSkips, saveSkips } from "./skipMemory";

// Una nota publicada por corrida. Cada publicación llama a la IA para el
// texto, genera una imagen (otra llamada de varios segundos), la sube a
// Netlify Blobs y la manda a redes, todo dentro del mismo request de
// /api/ingest, que ya gasta tiempo descargando las fuentes. Con 3 por
// corrida (2026-09) el request se pasaba del tiempo que Netlify tolera y
// se cortaba a medias. En vez de publicar más por corrida, el cron corre
// más seguido (cada 10 min — ver netlify/functions/scheduled-ingest.ts):
// hasta 6 notas por hora en lugar de 2.
const MAX_AUTO_PUBLISH_PER_RUN = 1;

// Borradores que se pueden pedir a la IA en una corrida mientras no se
// haya publicado nada. El primero siempre se intenta; los siguientes
// solo si todavía queda tiempo (ver `attemptsUntil`).
const MAX_DRAFTS_PER_RUN = 4;

const HOUR = 3_600_000;

/**
 * Descarte definitivo de una historia en esta corrida (no es una falla
 * técnica): se anota para no volver a intentarla hasta que pase
 * `retryAfterMs` — ver skipMemory.ts.
 */
class StorySkipped extends Error {
  constructor(message: string, readonly retryAfterMs: number) {
    super(message);
  }
}

export type AutoPublishOptions = {
  /**
   * Hora límite (Date.now()) para EMPEZAR un intento más cuando el
   * anterior no publicó. El primer intento de la corrida se hace siempre.
   */
  attemptsUntil?: number;
  /** Si ya pasó esta hora al llegar aquí, la corrida no intenta nada (no le queda tiempo para publicar una nota completa). */
  startBefore?: number;
};

export type AutoPublishResult = {
  attempted: number;
  published: number;
  alreadyPublished: number;
  /** Historias cuyo titular de origen ya coincide con una nota publicada: se saltan sin gastar una redacción. */
  sameAsPublished: number;
  /** Historias saltadas porque ya se habían descartado en una corrida anterior (ver skipMemory.ts). */
  skippedKnown: number;
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
export async function runAutoPublish(stories: Story[], options: AutoPublishOptions = {}): Promise<AutoPublishResult> {
  const result: AutoPublishResult = {
    attempted: 0,
    published: 0,
    alreadyPublished: 0,
    sameAsPublished: 0,
    skippedKnown: 0,
    errors: [],
    social: { facebookPublished: 0, instagramPublished: 0, errors: [] },
  };
  if (!isAiConfigured() || !isDatabaseConfigured()) return result;
  if (options.startBefore !== undefined && Date.now() > options.startBefore) return result;

  // Enfoque editorial (ver localFocus.ts): se descartan las historias que
  // claramente son de otro lugar y se ordena lo demás poniendo primero
  // los avisos oficiales, Protección Civil y lo que pasa en Vallarta.
  const candidates = sortByEditorialFocus(stories.filter((s) => isAutoPublishEligible(s) && !isOffTopicStory(s)));

  // Se recorre la lista hasta publicar una nota. Las historias ya
  // publicadas y las que ya se descartaron en una corrida anterior se
  // saltan sin gastar un intento, para que no dejen atorada la fila.
  // Límites para no pasarse del tiempo del request: se revisan a lo más
  // 40 historias y se piden a lo más MAX_DRAFTS_PER_RUN borradores.
  const attemptsUntil = options.attemptsUntil ?? Date.now();
  const skips = await loadSkips();
  let skipsChanged = false;
  // Títulos publicados en los últimos días, para detectar duplicados sin
  // consultar la base en cada intento. Sin esa lista no se publica nada
  // en esta corrida: sería publicar a ciegas, sin protección de duplicados.
  let recentTitles: RecentTitle[];
  try {
    recentTitles = await getRecentArticleTitles();
  } catch (err) {
    result.errors.push({ storyId: "-", error: `No se pudo leer lo ya publicado: ${err instanceof Error ? err.message : "error desconocido"}` });
    return result;
  }
  let publishedThisRun = 0;

  for (const story of candidates.slice(0, 40)) {
    if (publishedThisRun >= MAX_AUTO_PUBLISH_PER_RUN || result.attempted >= MAX_DRAFTS_PER_RUN) break;
    if (result.attempted > 0 && Date.now() > attemptsUntil) break;
    if (skips[story.storyId]) {
      result.skippedKnown++;
      continue;
    }
    try {
      const already = await hasPublishedArticleForStory(story.storyId);
      if (already) {
        result.alreadyPublished++;
        continue;
      }

      const isBulletin = isOfficialBulletinStory(story);

      // Antes de gastar una redacción: si el titular de la propia fuente
      // ya coincide con una nota publicada, es el mismo hecho. No cuesta
      // nada revisarlo, así que no se anota en la memoria de descartes.
      if (!isBulletin && findDuplicateTitle(story.labelSeed, recentTitles)) {
        result.sameAsPublished++;
        continue;
      }

      result.attempted++;
      const draft = await generateArticleDraft(story);

      // Sin excepción en este flujo (sin humano de por medio): si la IA
      // no tuvo material suficiente, no se publica nada — a diferencia
      // del botón manual del panel, que sí puede mostrárselo a un humano.
      // Se reintenta en unas horas por si llegan más fuentes.
      if (looksLikeInsufficientMaterial(draft.draft)) {
        throw new StorySkipped(
          `La IA determinó que no hay material suficiente para "${story.labelSeed}" — no se auto-publica.`,
          3 * HOUR
        );
      }

      const { title, excerpt, bodyParagraphs } = parseArticleDraft(draft.draft);
      // Sin un titular real (p. ej. el modelo solo devolvió el STORY ID) no se publica.
      if (isBadTitle(title)) {
        throw new StorySkipped(`El borrador de "${story.labelSeed}" no trae un titular utilizable — no se auto-publica.`, HOUR);
      }

      // Red de seguridad extra: la misma historia real puede generar dos
      // STORY ID distintos entre corridas (si el titular de la fuente
      // varió mínimamente) — ya pasó una vez y publicó la misma noticia
      // dos veces. Se compara por similitud de título, no solo por storyId.
      // Excepción: los boletines oficiales periódicos (aviso de huracán
      // cada 3 h) siempre se parecen al anterior y aun así cada emisión
      // es una actualización que sí se publica.
      const similarSlug = isBulletin ? null : findDuplicateTitle(title, recentTitles);
      if (similarSlug) {
        throw new StorySkipped(`Ya existe un artículo muy similar publicado recientemente (${similarSlug}) — se omite para no duplicar.`, 6 * HOUR);
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
      publishedThisRun++;
      recentTitles.push({ slug, title });

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
      const message = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push({ storyId: story.storyId, error: message });
      // Solo se anotan los descartes de la historia en sí. Una falla
      // técnica (IA saturada, red, base de datos) no se anota: esa
      // historia se vuelve a intentar en la corrida siguiente.
      if (err instanceof StorySkipped) {
        skips[story.storyId] = { until: Date.now() + err.retryAfterMs, reason: message.slice(0, 200) };
        skipsChanged = true;
      }
    }
  }

  if (skipsChanged) await saveSkips(skips);
  return result;
}
