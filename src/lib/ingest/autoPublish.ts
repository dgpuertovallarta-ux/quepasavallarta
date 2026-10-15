import type { Story } from "./storyGraph";
import { isAutoPublishEligible, isHumanReviewEligible } from "./storyGraph";
import { generateArticleDraft, isAiConfigured } from "./generateArticle";
import { parseArticleDraft, looksLikeInsufficientMaterial, isBadTitle } from "./articleFormat";
import { generateArticleImage } from "./generateImage";
import { hasPublishedArticleForStory, findDuplicateTitle, getRecentArticleTitles, publishArticle, DuplicateArticleError, type RecentTitle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { sortByEditorialFocus, isOffTopicStory, isOfficialBulletinStory } from "./localFocus";
import { loadSkips, saveSkips } from "./skipMemory";
import { encolarRedes } from "../qpv/colaRedes";
import { isHurricaneSimonContent } from "../social/editorialPolicy";
import { siteUrl } from "../storage/imageBlobs";

// Una noticia publicada o enviada a revisión por corrida. El texto y la
// imagen se generan dentro de la ingesta; mantener el límite evita
// acercarse al máximo de tiempo de Netlify.
const MAX_ARTICLES_PER_RUN = 1;

// Borradores que se pueden pedir a la IA por corrida mientras no se haya
// creado una noticia. El primero siempre se intenta; los siguientes
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
   * anterior no generó una publicación pendiente. El primer intento se hace siempre.
   */
  attemptsUntil?: number;
  /** Si ya pasó esta hora al llegar aquí, la corrida no intenta nada (no le queda tiempo para redactar una nota). */
  startBefore?: number;
};

export type AutoPublishResult = {
  attempted: number;
  autoPublished: number;
  queuedForReview: number;
  socialResults: { storyId: string; facebook: "published" | "failed" | "skipped"; instagram: "published" | "failed" | "skipped" }[];
  alreadyPublished: number;
  /** Historias cuyo titular de origen ya coincide con una nota publicada: se saltan sin gastar una redacción. */
  sameAsPublished: number;
  /** Historias saltadas porque ya se habían descartado en una corrida anterior (ver skipMemory.ts). */
  skippedKnown: number;
  errors: { storyId: string; error: string }[];
};

/**
 * Publica las Stories NIVEL A/B corroboradas y neutrales. Las historias con
 * señales sensibles o de revisión quedan en la cola del panel administrativo.
 */
export async function runAutoPublish(stories: Story[], options: AutoPublishOptions = {}): Promise<AutoPublishResult> {
  const result: AutoPublishResult = {
    attempted: 0,
    autoPublished: 0,
    queuedForReview: 0,
    socialResults: [],
    alreadyPublished: 0,
    sameAsPublished: 0,
    skippedKnown: 0,
    errors: [],
  };
  if (!isAiConfigured() || !isDatabaseConfigured()) return result;
  if (options.startBefore !== undefined && Date.now() > options.startBefore) return result;

  // Enfoque editorial (ver localFocus.ts): se descartan las historias que
  // claramente son de otro lugar y se ordena lo demás poniendo primero
  // los avisos oficiales, Protección Civil y lo que pasa en Vallarta.
  const candidates = sortByEditorialFocus(stories.filter((s) => (isAutoPublishEligible(s) || isHumanReviewEligible(s)) && !isOffTopicStory(s)));

  // Se recorre la lista hasta publicar o enviar a revisión una nota. Las historias ya
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
  let createdThisRun = 0;

  for (const story of candidates.slice(0, 40)) {
    if (createdThisRun >= MAX_ARTICLES_PER_RUN || result.attempted >= MAX_DRAFTS_PER_RUN) break;
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

      // Si la IA no tuvo material suficiente, no se crea un borrador
      // incompleto para la cola de aprobación.
      // Se reintenta en unas horas por si llegan más fuentes.
      if (looksLikeInsufficientMaterial(draft.draft)) {
        throw new StorySkipped(
          `La IA determinó que no hay material suficiente para "${story.labelSeed}" — no se envía a aprobación.`,
          3 * HOUR
        );
      }

      const { title, excerpt, bodyParagraphs } = parseArticleDraft(draft.draft);
      // Sin un titular real (p. ej. el modelo solo devolvió el STORY ID) no se crea el borrador.
      if (isBadTitle(title)) {
        throw new StorySkipped(`El borrador de "${story.labelSeed}" no trae un titular utilizable — no se envía a aprobación.`, HOUR);
      }

      // Red de seguridad extra: la misma historia real puede generar dos
      // STORY ID distintos entre corridas (si el titular de la fuente
      // varió mínimamente) — ya pasó una vez y generó dos borradores de la
      // misma noticia. Se compara por similitud de título, no solo por storyId.
      // Excepción: los boletines oficiales periódicos (aviso de huracán
      // cada 3 h) siempre se parecen al anterior y aun así cada emisión
      // puede ser una actualización que merece revisión.
      const similarSlug = isBulletin ? null : findDuplicateTitle(title, recentTitles);
      if (similarSlug) {
        throw new StorySkipped(`Ya existe un artículo muy similar recientemente (${similarSlug}) — se omite para no duplicar.`, 6 * HOUR);
      }

      // Foto real de la fuente (con crédito) + postal de color para redes. Ya no se generan imágenes con IA.
      const primarySource = story.items[0];
      const generatedImage = await generateArticleImage({
        title,
        excerpt,
        categorySlug: primarySource.categoryGuess,
        sourceUrl: primarySource.link,
        sourceName: primarySource.sourceName,
      });

      const automatic = isAutoPublishEligible(story);
      const { slug } = await publishArticle({
        title,
        excerpt,
        body: bodyParagraphs.join("\n\n"),
        categorySlug: primarySource.categoryGuess,
        newsScore: story.maxNewsScore,
        aiModel: draft.model,
        storyExternalKey: story.storyId,
        imageUrl: generatedImage?.url,
        imageCredit: generatedImage?.credit,
        imageLicenseStatus: generatedImage?.licenseStatus,
        status: automatic ? "published" : "pending_review",
        permitirParecida: isBulletin,
      });
      if (automatic) {
        result.autoPublished++;
        const content = `${title} ${excerpt} ${bodyParagraphs.join(" ")}`;
        if (isHurricaneSimonContent(content)) {
          result.socialResults.push({ storyId: story.storyId, facebook: "skipped", instagram: "skipped" });
        } else {
          // Ya no se publica en redes al instante: entra a la cola (máximo diario y separación entre posts) — ver lib/qpv/colaRedes.ts.
          // Nada sale a Facebook sin foto real (2026-10): sin foto, la nota queda solo en el sitio.
          if (generatedImage?.url && generatedImage.cardUrl) {
            await encolarRedes({ title, excerpt, articleUrl: `${siteUrl()}/noticia/${slug}`, imageUrl: generatedImage.cardUrl });
          }
          result.socialResults.push({ storyId: story.storyId, facebook: "skipped", instagram: "skipped" });
        }
      } else {
        result.queuedForReview++;
      }
      createdThisRun++;
      recentTitles.push({ slug, title });
    } catch (err) {
      if (err instanceof DuplicateArticleError) {
        // Otra corrida (o una nota parecida) ya la publicó: no es error, se descarta la historia.
        result.sameAsPublished++;
        skips[story.storyId] = { until: Date.now() + 24 * HOUR, reason: err.message.slice(0, 200) };
        skipsChanged = true;
        continue;
      }
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
