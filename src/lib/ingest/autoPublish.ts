import type { Story } from "./storyGraph";
import { isAutoPublishEligible, isHumanReviewEligible } from "./storyGraph";
import { generateArticleDraft, isAiConfigured } from "./generateArticle";
import { parseArticleDraft, looksLikeInsufficientMaterial, isBadTitle } from "./articleFormat";
import { generateArticleImage } from "./generateImage";
import { hasPublishedArticleForStory, findDuplicateTitle, getRecentArticleTitles, publishArticle, DuplicateArticleError, type RecentTitle } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { usaWordPress } from "../wp/cliente";
import { storyPriority, isEmergencyStory, isLocalStory, isOfficialBulletinStory } from "./localFocus";
import { getPublishedArticles } from "../db/articles";
import { loadSkips, saveSkips } from "./skipMemory";
import { encolarRedes } from "../qpv/colaRedes";
import { isHurricaneSimonContent } from "../social/editorialPolicy";
import { siteUrl } from "../storage/imageBlobs";
import { mencionaExpress, esExpress } from "../qpv/express";

// Una noticia publicada o enviada a revisión por corrida. El texto y la
// imagen se generan dentro de la ingesta; mantener el límite evita
// acercarse al máximo de tiempo de Netlify.
// Una noticia por corrida (cada ~10 min); el ritmo lo marca el límite diario (abajo).
const MAX_ARTICLES_PER_RUN = Number(process.env.QPV_NOTAS_POR_VUELTA || 1);

// Borradores que se pueden pedir a la IA por corrida mientras no se haya
// creado una noticia. El primero siempre se intenta; los siguientes
// solo si todavía queda tiempo (ver `attemptsUntil`).
const MAX_DRAFTS_PER_RUN = MAX_ARTICLES_PER_RUN + 4;

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

/**
 * 2026-11-05 — Línea del propietario: 20 notas al día, las MÁS IMPORTANTES, es
 * decir las que más medios están reportando ("más presencia"). Se reparten de
 * 7 a. m. a 11 p. m. para que el cupo no se acabe temprano con notas flojas y
 * dé tiempo a que una historia junte medios. Emergencias (Protección Civil) y
 * notas express no esperan ni cuentan para el tope.
 * QPV_NOTAS_POR_DIA cambia el tope (0 = sin tope).
 */
const NOTAS_POR_DIA = Number(process.env.QPV_NOTAS_POR_DIA ?? 20);
const HORA_INICIO = 7;
const HORA_FIN = 23;

/** Cuántos medios distintos reportan la historia. */
export function presencia(s: Story): number {
  return new Set(s.items.map((it) => it.sourceName || it.sourceId)).size;
}

/** Importancia: la presencia manda; luego emergencia/local y el puntaje de la nota. */
function importancia(s: Story): number {
  return presencia(s) * 10 + storyPriority(s) * 8 + s.maxNewsScore / 10;
}

function minutoLocal(d: Date): { dia: string; min: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}

/** ¿Toca publicar una nota normal ahora? Devuelve el motivo si no. */
async function cupoDelDia(): Promise<string | null> {
  if (!NOTAS_POR_DIA) return null;
  const ahora = minutoLocal(new Date());
  if (ahora.min < HORA_INICIO * 60 || ahora.min >= HORA_FIN * 60) return "de noche solo emergencias y express";
  const recientes = await getPublishedArticles(60);
  const hoy = recientes.filter((n) => n.publishedAt && minutoLocal(new Date(n.publishedAt)).dia === ahora.dia);
  if (hoy.length >= NOTAS_POR_DIA) return `tope diario alcanzado (${NOTAS_POR_DIA})`;
  const ultima = recientes.map((n) => n.publishedAt).filter(Boolean).sort().pop();
  if (!ultima) return null;
  const desde = (Date.now() - new Date(ultima).getTime()) / 60_000;
  const espacio = Math.max(15, (HORA_FIN * 60 - ahora.min) / (NOTAS_POR_DIA - hoy.length));
  return desde < espacio ? `siguiente nota en ${Math.ceil(espacio - desde)} min` : null;
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
  if (!isAiConfigured() || !(isDatabaseConfigured() || usaWordPress())) return result;
  if (options.startBefore !== undefined && Date.now() > options.startBefore) return result;

  // Enfoque editorial (ver localFocus.ts): se descartan las historias que
  // claramente son de otro lugar y se ordena lo demás poniendo primero
  // los avisos oficiales, Protección Civil y lo que pasa en Vallarta.
  // Notas «express» (ver lib/qpv/express.ts): las que mencionan a Diego Franco entran
  // aunque solo las reporte una fuente y van al principio de la fila.
  const textoHistoria = (s: Story) => s.items.map((i) => `${i.title} ${i.excerpt}`).join(" ");
  const sinEspera = (s: Story) => isEmergencyStory(s) || isOfficialBulletinStory(s) || mencionaExpress(textoHistoria(s));
  let candidates = stories
    .filter(
      (s) =>
        (isAutoPublishEligible(s) || isHumanReviewEligible(s) || mencionaExpress(textoHistoria(s))) &&
        // 2026-11-02: el propietario acepta nacionales/internacionales (solo que lleven foto); QPV_SOLO_LOCAL=1 deja solo Vallarta y la bahía.
        (isLocalStory(s) || isOfficialBulletinStory(s) || process.env.QPV_SOLO_LOCAL !== "1")
    )
    // Las express primero; luego las que más medios reportan (ver importancia).
    .sort((a, b) => Number(mencionaExpress(textoHistoria(b))) - Number(mencionaExpress(textoHistoria(a))) || importancia(b) - importancia(a));

  // Tope de 20 al día repartidas en el día: fuera de turno solo pasan emergencias y express.
  const motivo = await cupoDelDia().catch(() => null);
  if (motivo) {
    candidates = candidates.filter(sinEspera);
    if (!candidates.length) {
      result.errors.push({ storyId: "-", error: `En espera: ${motivo}.` });
      return result;
    }
  }

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
      const { patrocinioParaNota } = await import("../business/patrocinios");
      const pat = await patrocinioParaNota(title, primarySource.categoryGuess);
      const generatedImage = await generateArticleImage({
        patrocinio: pat ? { nombre: pat.nombre, logo: pat.logo } : null,
        title,
        excerpt,
        categorySlug: primarySource.categoryGuess,
        sourceUrl: primarySource.link,
        sourceName: primarySource.sourceName,
      });

      // Express: positiva o neutral → directo al sitio; si trae señales de crítica → siempre a Reportes.
      const textoNota = `${title} ${excerpt} ${bodyParagraphs.join(" ")}`;
      // 2026-10-31 (pedido del propietario: no hay tiempo de aprobar): las notas
      // confirmadas por un medio o fuente oficial se publican solas aunque sean de
      // revisión. Solo quedan para aprobar los temas de menores, abuso sexual o
      // suicidio. Con QPV_CON_APROBACION=1 vuelve la regla anterior.
      const delicadaExtrema = /\b(menor(es)? de edad|niñ[oa]s?|adolescente|abuso sexual|violaci[oó]n|violad|suicid|feminicid)/i.test(textoNota);
      const automatic = mencionaExpress(textoNota) || mencionaExpress(textoHistoria(story))
        ? esExpress(textoNota)
        : isAutoPublishEligible(story) || (process.env.QPV_CON_APROBACION !== "1" && story.hasCorroboration && !delicadaExtrema);
      const { slug } = await publishArticle({
        title,
        excerpt,
        body: bodyParagraphs.join("\n\n"),
        categorySlug: primarySource.categoryGuess,
        newsScore: story.maxNewsScore,
        aiModel: draft.model,
        storyExternalKey: story.storyId,
        fuentes: story.items.slice(0, 3).map((it) => ({ label: it.sourceName, url: it.link })),
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
          // Con foto propia (oficial o de archivo que sí corresponde) o, si no, con la tarjeta tipográfica QPV (2026-10-24).
          // La postal lleva la foto real de fondo cuando la hay (oficial o de archivo); esas van primero en la cola.
          if (generatedImage?.cardUrl) {
            await encolarRedes({ title, excerpt, articleUrl: `${siteUrl()}/noticia/${slug}`, imageUrl: generatedImage.cardUrl }, { score: story.maxNewsScore, patrocinio: pat ? { id: pat.id, nombre: pat.nombre } : null, categoria: primarySource.categoryGuess, conFoto: !!generatedImage.fotoRedes });
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
