import { esDuplicada } from "../qpv/dedupe";
import { getPool, isDatabaseConfigured } from "./client";
import type { NewsItem, Media, ExplicaItem } from "../data";
import { illustrationFor } from "../photos";
import { repairArticle, isBadTitle } from "../ingest/articleFormat";

/**
 * Lectura y publicación real de artículos — conecta la portada pública
 * (home, categorías, /noticia/[slug]) a Postgres en vez de al array de
 * demostración NEWS[] en data.ts. Sin DATABASE_URL configurada, las
 * funciones de lectura devuelven listas vacías (la portada cae de vuelta
 * al contenido demo) en lugar de fallar — mismo patrón que el resto del
 * pipeline de ingesta.
 */

const CATEGORY_MEDIA: Record<string, Media> = {
  clima: "ocean",
  playas: "ocean",
  turismo: "ocean",
  "medio-ambiente": "green",
  cultura: "sunset",
  gastronomia: "sunset",
  eventos: "sunset",
  entretenimiento: "sunset",
  seguridad: "sand",
  gobierno: "sand",
  politica: "sand",
};

function mediaForCategory(slug: string): Media {
  return CATEGORY_MEDIA[slug] || "ocean";
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "articulo"
  );
}

type ArticleRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  news_score: number;
  published_at: string;
  updated_at: string;
  category_slug: string;
  author_name: string;
  source_url: string | null;
  source_name: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_license_status?: string | null;
};

/**
 * Decisión editorial (2026-10): el sitio ya no muestra imágenes generadas con
 * IA — restaban credibilidad y Facebook marcaba los posts como "AI content".
 * Las notas que tenían una quedan con la foto real ilustrativa de su
 * categoría (banco de Wikimedia, ver photos.ts). No se borra nada de la base.
 */
function realImageUrl(row: { image_url: string | null; image_credit?: string | null; image_license_status?: string | null }): string | undefined {
  if (!row.image_url) return undefined;
  if (row.image_license_status === "ai_generated") return undefined;
  if (/generada con ia/i.test(row.image_credit || "")) return undefined;
  return row.image_url;
}

function mapRowToNewsItem(row: ArticleRow): NewsItem {
  const category = row.category_slug || "comunidad";
  // Las notas se limpian al leerlas (no solo al redactarlas) para que
  // también las ya publicadas con título "STORY ID: …" o con markdown
  // crudo en el cuerpo se muestren bien — ver repairArticle.
  const fixed = repairArticle({
    title: row.title || "",
    excerpt: row.excerpt || "",
    bodyParagraphs: (row.body || "").split("\n\n").filter(Boolean),
  });
  return {
    slug: row.slug,
    title: fixed.title,
    dek: fixed.excerpt,
    category,
    zone: null,
    author: row.author_name,
    score: row.news_score,
    breaking: row.news_score >= 90,
    verified: true, // solo llega aquí después de revisión humana (ver /api/publish-article)
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    media: mediaForCategory(category),
    image: illustrationFor(category, row.slug),
    imageUrl: realImageUrl(row),
    imageCredit: realImageUrl(row) ? row.image_credit || undefined : undefined,
    sources: row.source_url ? [{ label: row.source_name || "Fuente original", url: row.source_url }] : [],
    body: fixed.bodyParagraphs,
  };
}

/** Convierte filas en notas: una por slug (el join con fuentes duplica filas) y sin las que no tienen un título utilizable. */
function rowsToNewsItems(rows: ArticleRow[]): NewsItem[] {
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const row of rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    const item = mapRowToNewsItem(row);
    if (item.title) items.push(item);
  }
  return items;
}

const SELECT_BASE = `
  select
    a.slug, a.title, a.excerpt, a.body, a.news_score, a.published_at, a.updated_at,
    a.image_url, a.image_credit, a.image_license_status,
    c.slug as category_slug,
    coalesce(au.display_name, 'Redacción Qué Pasa Vallarta') as author_name,
    ss.url as source_url,
    s.name as source_name
  from articles a
  left join categories c on c.id = a.category_id
  left join authors au on au.id = a.author_id
  left join story_sources ss on ss.story_id = a.story_id
  left join sources s on s.id = ss.source_id
  where a.status = 'published' and a.is_explainer = false
`;

export async function getPublishedArticles(limit = 30): Promise<NewsItem[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  // Se piden más filas que el límite porque el join con story_sources
  // puede repetir una nota varias veces (una por fuente).
  const res = await pool.query<ArticleRow>(
    `${SELECT_BASE} order by a.published_at desc nulls last limit $1`,
    [limit * 3]
  );
  return rowsToNewsItems(res.rows).slice(0, limit);
}

export async function getPublishedArticlesByCategory(categorySlug: string, limit = 30): Promise<NewsItem[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const res = await pool.query<ArticleRow>(
    `${SELECT_BASE} and c.slug = $1 order by a.published_at desc nulls last limit $2`,
    [categorySlug, limit * 3]
  );
  return rowsToNewsItems(res.rows).slice(0, limit);
}

/**
 * Categorías que ya tienen al menos una nota publicada. El menú, el pie
 * y la fila de filtros solo enlazan a estas — así nadie llega a una
 * sección vacía (p. ej. Seguridad, cuyas notas requieren revisión).
 */
export async function getActiveCategorySlugs(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const pool = getPool();
    const res = await pool.query<{ slug: string }>(
      `select distinct c.slug
         from articles a
         join categories c on c.id = a.category_id
        where a.status = 'published' and a.is_explainer = false and c.slug is not null`
    );
    return res.rows.map((r) => r.slug);
  } catch {
    return [];
  }
}

// Raíces de palabras (sin acentos) que identifican una nota de
// Protección Civil / emergencia en su título o bajada.
const EMERGENCY_SQL_TERMS = [
  "proteccion civil", "huracan", "tormenta tropical", "ciclon", "evacu", "refugio", "albergue", "inundaci",
  "desbord", "deslave", "marejada", "oleaje", "suspenden clases", "suspension de clases", "suspenden actividades",
  "alerta", "bomberos", "zona de riesgo", "zonas de riesgo", "damnificad", "lluvias intensas", "rafagas", "sismo",
];

/**
 * Notas de Protección Civil y emergencias de los últimos días (por
 * palabras clave en título y bajada) — alimenta /proteccion-civil y la
 * franja de aviso de la portada.
 */
export async function getEmergencyArticles(limit = 30, sinceDays = 7): Promise<NewsItem[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const pool = getPool();
    const res = await pool.query<ArticleRow>(
      `${SELECT_BASE}
        and a.published_at > now() - interval '1 day' * $2
        and translate(lower(coalesce(a.title,'') || ' ' || coalesce(a.excerpt,'')), 'áéíóúüñ', 'aeiouun') like any($3)
        order by a.published_at desc nulls last limit $1`,
      [limit * 3, sinceDays, EMERGENCY_SQL_TERMS.map((t) => `%${t}%`)]
    );
    return rowsToNewsItems(res.rows).slice(0, limit);
  } catch {
    return [];
  }
}

export type SitemapEntry = { slug: string; isExplainer: boolean; lastModified: string };

/**
 * Lista ligera (sin el cuerpo de las notas) de todo lo publicado, para el
 * mapa del sitio que leen los buscadores (ver app/sitemap.ts). Se omiten
 * las notas sin un titular utilizable, igual que en el resto del sitio.
 */
export async function getSitemapEntries(limit = 2000): Promise<SitemapEntry[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const pool = getPool();
    const res = await pool.query<{
      slug: string;
      title: string;
      body: string | null;
      is_explainer: boolean;
      published_at: Date | null;
      updated_at: Date | null;
    }>(
      `select slug, title, left(body, 600) as body, is_explainer, published_at, updated_at
         from articles
        where status = 'published'
        order by published_at desc nulls last
        limit $1`,
      [limit]
    );
    return res.rows
      .filter((r) => !isBadTitle(r.title) || !!r.body)
      .map((r) => ({
        slug: r.slug,
        isExplainer: r.is_explainer,
        lastModified: (r.updated_at || r.published_at || new Date()).toISOString(),
      }));
  } catch {
    return [];
  }
}

const SEARCH_HAYSTACK =
  "translate(lower(coalesce(a.title,'') || ' ' || coalesce(a.excerpt,'') || ' ' || coalesce(a.body,'')), 'áéíóúüñ', 'aeiouun')";

function normalizeForSearch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Búsqueda real sobre las notas publicadas (título, bajada y cuerpo) —
 * la usan /buscar, /pregunta y Mi Vallarta. Sin acentos ni mayúsculas en
 * la comparación. Primero exige todas las palabras; si así no hay nada,
 * acepta cualquiera de ellas. Con `phrase: true` busca la frase tal cual
 * (nombres de colonia como "5 de Diciembre").
 */
export async function searchPublishedArticles(
  query: string,
  limit = 20,
  opts: { phrase?: boolean } = {}
): Promise<NewsItem[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const run = async (where: string, params: string[]) => {
    const res = await pool.query<ArticleRow>(
      `${SELECT_BASE} and (${where}) order by a.published_at desc nulls last limit $${params.length + 1}`,
      [...params, limit * 3]
    );
    return rowsToNewsItems(res.rows).slice(0, limit);
  };

  if (opts.phrase) {
    const phrase = normalizeForSearch(query).trim();
    return phrase ? run(`${SEARCH_HAYSTACK} like $1`, [`%${phrase}%`]) : [];
  }

  const words = normalizeForSearch(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w))
    .slice(0, 6);
  if (words.length === 0) return [];
  const params = words.map((w) => `%${w}%`);
  const likes = words.map((_, i) => `${SEARCH_HAYSTACK} like $${i + 1}`);
  const all = await run(likes.join(" and "), params);
  if (all.length > 0 || words.length === 1) return all;
  return run(likes.join(" or "), params);
}

const SEARCH_STOPWORDS = new Set([
  "que", "los", "las", "del", "con", "por", "para", "una", "uno", "hay", "hoy", "esta", "este", "sobre", "como",
  "paso", "pasa", "dicen", "puerto", "vallarta",
]);

export async function getPublishedArticleBySlug(slug: string): Promise<NewsItem | null> {
  if (!isDatabaseConfigured()) return null;
  const pool = getPool();
  const res = await pool.query<ArticleRow>(`${SELECT_BASE} and a.slug = $1 limit 1`, [slug]);
  if (res.rows.length === 0) return null;
  const item = mapRowToNewsItem(res.rows[0]);
  return item.title ? item : { ...item, title: item.dek || "Nota de Qué Pasa Vallarta" };
}

// ---------------------------------------------------------------------
// VALLARTA EXPLICA — mismo pipeline y tabla, marcados is_explainer=true,
// con una estructura más profunda (ver editorialPrompt.ts EXPLICA_SYSTEM_PROMPT).
// ---------------------------------------------------------------------

const EXPLICA_SELECT_BASE = SELECT_BASE.replace("a.is_explainer = false", "a.is_explainer = true");

function sectionFrom(bodyParagraphs: string[], headerMatch: RegExp): string {
  const idx = bodyParagraphs.findIndex((p) => p.startsWith("## ") && headerMatch.test(p.slice(3)));
  if (idx === -1) return "";
  const out: string[] = [];
  for (let i = idx + 1; i < bodyParagraphs.length && !bodyParagraphs[i].startsWith("## "); i++) {
    out.push(bodyParagraphs[i]);
  }
  return out.join(" ");
}

function mapRowToExplicaItem(row: ArticleRow): ExplicaItem {
  const category = row.category_slug || "comunidad";
  const fixed = repairArticle({
    title: row.title || "",
    excerpt: row.excerpt || "",
    bodyParagraphs: (row.body || "").split("\n\n").filter(Boolean),
  });
  const paragraphs = fixed.bodyParagraphs;
  return {
    slug: row.slug,
    title: fixed.title,
    dek: fixed.excerpt,
    image: illustrationFor(category, row.slug),
    imageUrl: realImageUrl(row),
    imageCredit: realImageUrl(row) ? row.image_credit || undefined : undefined,
    publishedAt: row.published_at,
    quePaso: sectionFrom(paragraphs, /QU[EÉ] (EST[AÁ] )?PAS(Ó|O|ANDO)/i),
    porQueImporta: sectionFrom(paragraphs, /POR QU[EÉ] IMPORTA/i),
    queSabemos: sectionFrom(paragraphs, /^LO QUE SABEMOS$/i),
    queNoSabemos: sectionFrom(paragraphs, /LO QUE NO SABEMOS/i),
    contexto: sectionFrom(paragraphs, /^CONTEXTO$/i),
    queSigue: sectionFrom(paragraphs, /QU[EÉ] SIGUE/i),
    fuentes: row.source_url ? [{ label: row.source_name || "Fuente original", url: row.source_url }] : [],
  };
}

export async function getPublishedExplainers(limit = 20): Promise<ExplicaItem[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const res = await pool.query<ArticleRow>(
    `${EXPLICA_SELECT_BASE} order by a.published_at desc nulls last limit $1`,
    [limit * 3]
  );
  const seen = new Set<string>();
  const items: ExplicaItem[] = [];
  for (const row of res.rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    const item = mapRowToExplicaItem(row);
    if (item.title) items.push(item);
  }
  return items.slice(0, limit);
}

export async function getPublishedExplainerBySlug(slug: string): Promise<ExplicaItem | null> {
  if (!isDatabaseConfigured()) return null;
  const pool = getPool();
  const res = await pool.query<ArticleRow>(`${EXPLICA_SELECT_BASE} and a.slug = $1 limit 1`, [slug]);
  if (res.rows.length === 0) return null;
  return mapRowToExplicaItem(res.rows[0]);
}

/** Evita generar un explicador para una Story que ya tiene uno. */
export async function hasExplainerForStory(storyExternalKey: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const pool = getPool();
  const res = await pool.query(
    `select 1 from articles a join stories s on s.id = a.story_id where s.external_key = $1 and a.is_explainer = true limit 1`,
    [storyExternalKey]
  );
  return res.rows.length > 0;
}

/** Controla la cadencia (~4 al día) de "Vallarta Explica" — ver explicaPublish.ts. */
export async function getLastExplainerPublishedAt(): Promise<Date | null> {
  if (!isDatabaseConfigured()) return null;
  const pool = getPool();
  const res = await pool.query<{ published_at: string | Date | null }>(
    `select max(coalesce(published_at, drafted_at)) as published_at
       from articles
      where is_explainer = true and status in ('published', 'pending_review')`
  );
  const value = res.rows[0]?.published_at;
  return value ? new Date(value) : null;
}

const TITLE_STOPWORDS = new Set([
  "de", "la", "el", "en", "y", "a", "que", "del", "los", "las", "un", "una", "con", "por", "para", "se", "su", "es", "al",
  // Palabras específicas del sitio que aparecen en casi cualquier título
  // (nombre del lugar, verbos de reporte genéricos) — diluían el cálculo
  // de similitud entre dos títulos sobre el MISMO hecho contado por
  // fuentes distintas, dejando pasar duplicados reales (bug real: el
  // mismo sistema tropical publicado 3 veces con títulos "Vigilan..."
  // ligeramente distintos, cada uno bajo el 60% de umbral anterior).
  "puerto", "vallarta", "bahia", "banderas", "vigilan", "region",
]);

function titleTokens(title: string): Set<string> {
  const clean = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w))
    // "costa"/"costas", "vuelo"/"vuelos" cuentan como la misma palabra.
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
  return new Set(clean);
}

export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const w of ta) if (tb.has(w)) intersection++;
  return intersection / Math.min(ta.size, tb.size);
}

/**
 * Para las portadas: de varias notas publicadas con horas de diferencia
 * sobre el mismo hecho (títulos muy parecidos) deja solo la primera de la
 * lista — que, con la lista ordenada de más nueva a más vieja, es la más
 * reciente. No borra nada: las demás siguen en su categoría y su URL.
 *
 * Para no confundir notas distintas de un mismo tema del día (en un
 * huracán casi todos los títulos comparten "huracán" y su nombre), las
 * palabras que aparecen en buena parte de la lista no cuentan como
 * coincidencia: hacen falta al menos 3 palabras en común fuera de esas.
 */
export function dropNearDuplicates<T extends { title: string; publishedAt: string }>(items: T[], threshold = 0.4): T[] {
  const tokens = items.map((i) => titleTokens(i.title));
  const frequency = new Map<string, number>();
  for (const set of tokens) for (const w of set) frequency.set(w, (frequency.get(w) || 0) + 1);
  const commonAt = Math.max(3, Math.ceil(items.length * 0.2));
  const distinctiveShared = (a: Set<string>, b: Set<string>) => {
    let n = 0;
    for (const w of a) if (b.has(w) && (frequency.get(w) || 0) < commonAt) n++;
    return n;
  };

  const kept: number[] = [];
  items.forEach((item, idx) => {
    const duplicate = kept.some(
      (k) =>
        Math.abs(+new Date(items[k].publishedAt) - +new Date(item.publishedAt)) < 36 * 3_600_000 &&
        titleSimilarity(items[k].title, item.title) >= threshold &&
        distinctiveShared(tokens[k], tokens[idx]) >= 3
    );
    if (!duplicate) kept.push(idx);
  });
  return kept.map((k) => items[k]);
}

export type RecentTitle = { slug: string; title: string };

/**
 * ¿Este título cuenta el mismo hecho que alguna nota ya publicada?
 * Devuelve el slug de la nota parecida, o null.
 *
 * Las palabras que se repiten en buena parte de lo publicado esos días
 * (en un huracán: "huracán", su nombre, "Jalisco"…) NO cuentan como
 * coincidencia: son el tema del día, no el hecho. Bug real (2026-10-10,
 * huracán Simón): la regla anterior comparaba todas las palabras y una
 * sola nota vieja ("Emiten vigilancia de huracán… Simón") bastaba para
 * descartar como "duplicado" casi cualquier titular nuevo con "huracán
 * Simón" — el sitio se quedó horas sin publicar justo cuando más
 * noticias había. Ahora solo cuentan las palabras fuera del tema del
 * día: hacen falta tres en común (y que sean el 40% o más del título más
 * corto), o dos si son casi todo el título (60% o más). Es la misma idea
 * que ya usa dropNearDuplicates en las portadas. Probado con los 80
 * titulares publicados del 8 al 10 de octubre de 2026: sigue atrapando
 * los duplicados reales (Volaris, Profepa, IMSS-VPH, Capitán Sol) y deja
 * pasar notas distintas del mismo huracán.
 */
export function findDuplicateTitle(title: string, recent: RecentTitle[]): string | null {
  // Filtro reforzado (2026-10): además de las palabras del título, compara
  // lugares, instituciones, cifras y nombres propios — así "Aseguran a un
  // sujeto en San Vicente…" y "Capturan en San Vicente a sujeto…" ya se
  // detectan como la misma nota. Ver lib/qpv/dedupe.ts.
  const reforzado = esDuplicada({ titulo: title }, recent.map((r) => ({ id: r.slug, titulo: r.title })));
  if (reforzado.duplicada && reforzado.de.id) return reforzado.de.id;
  const sets = recent.map((r) => titleTokens(r.title));
  const frequency = new Map<string, number>();
  for (const set of sets) for (const w of set) frequency.set(w, (frequency.get(w) || 0) + 1);
  const commonAt = Math.max(3, Math.ceil(recent.length * 0.1));
  const distinctive = (set: Set<string>) => [...set].filter((w) => (frequency.get(w) || 0) < commonAt);

  const mine = distinctive(titleTokens(title));
  for (let i = 0; i < recent.length; i++) {
    const theirs = new Set(distinctive(sets[i]));
    const shared = mine.filter((w) => theirs.has(w)).length;
    if (shared < 2) continue;
    const ratio = shared / Math.min(mine.length, theirs.size);
    if ((shared >= 3 && ratio >= 0.4) || ratio >= 0.6) return recent[i].slug;
  }
  return null;
}

/** Títulos publicados en los últimos días, para comparar contra ellos sin consultar la base en cada intento. */
export async function getRecentArticleTitles(opts: { sinceDays?: number; isExplainer?: boolean } = {}): Promise<RecentTitle[]> {
  if (!isDatabaseConfigured()) return [];
  const { sinceDays = 3, isExplainer = false } = opts;
  const pool = getPool();
  const res = await pool.query<RecentTitle>(
    `select slug, title from articles
      where ((status = 'published' and published_at > now() - interval '1 day' * $1)
          or (status = 'pending_review' and drafted_at > now() - interval '1 day' * $1))
        and is_explainer = $2`,
    [sinceDays, isExplainer]
  );
  return res.rows;
}

/**
 * Red de seguridad extra contra duplicados: la misma noticia real puede
 * generar dos STORY ID distintos en corridas diferentes del Story Graph
 * (si el titular de la fuente varió mínimamente entre fetches), lo cual
 * hace que hasPublishedArticleForStory (por storyId) no detecte que ya
 * se cubrió. Esto compara por SIMILITUD DE TÍTULO contra lo publicado en
 * los últimos días — ver findDuplicateTitle para la regla.
 */
export async function findSimilarRecentArticle(title: string, opts: { sinceDays?: number; isExplainer?: boolean } = {}): Promise<string | null> {
  return findDuplicateTitle(title, await getRecentArticleTitles(opts));
}

/** Para el flujo manual de publicación: recupera un link+nombre de fuente de una Story ya persistida, para poder extraer su foto real. */
export async function getPrimarySourceForStory(storyExternalKey: string): Promise<{ url: string; sourceName: string } | null> {
  if (!isDatabaseConfigured()) return null;
  const pool = getPool();
  const res = await pool.query<{ url: string; name: string }>(
    `select ss.url, s.name
     from story_sources ss
     join stories st on st.id = ss.story_id
     join sources s on s.id = ss.source_id
     where st.external_key = $1
     order by ss.captured_at asc
     limit 1`,
    [storyExternalKey]
  );
  if (res.rows.length === 0) return null;
  return { url: res.rows[0].url, sourceName: res.rows[0].name };
}

/** Evita republicar la misma Story en cada corrida del cron (cada 10 min). */
export async function hasPublishedArticleForStory(storyExternalKey: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const pool = getPool();
  const res = await pool.query(
    `select 1 from articles a join stories s on s.id = a.story_id where s.external_key = $1 limit 1`,
    [storyExternalKey]
  );
  return res.rows.length > 0;
}

export type PublishArticleInput = {
  title: string;
  excerpt: string;
  body: string;
  categorySlug: string;
  newsScore: number;
  aiModel: string | null;
  storyExternalKey: string | null;
  /**
   * Imagen del artículo. Desde 2026-09 es una URL pública generada por IA
   * y servida desde /api/image/[key] (ver generateImage.ts + imageBlobs.ts)
   * — reemplaza la foto real extraída de la fuente que se usaba antes (ver
   * extractImage.ts, que queda sin usar en el flujo normal por el riesgo
   * de derechos de autor que traía).
   */
  imageUrl?: string;
  imageSourceUrl?: string;
  imageCredit?: string;
  /** Explícito porque ya no se puede inferir de la forma de la URL (antes era un data: URL). Default: 'illustrative_fallback' si no hay imageUrl. */
  imageLicenseStatus?: "ai_generated" | "source_unlicensed" | "illustrative_fallback";
  /** true para "Vallarta Explica" (ver explicaPublish.ts) — false (default) para noticia breve. */
  isExplainer?: boolean;
  /** Nuevos borradores automáticos/manualmente preparados esperan aprobación antes de hacerse públicos. */
  status?: "published" | "pending_review";
};

/**
 * Guarda un artículo como pendiente de revisión o publicado según la
 * acción editorial. La publicación pública requiere aprobación explícita.
 */
export async function publishArticle(input: PublishArticleInput): Promise<{ slug: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const categoryRes = await client.query<{ id: string }>("select id from categories where slug = $1", [input.categorySlug]);
    const categoryId = categoryRes.rows[0]?.id || null;

    const authorRes = await client.query<{ id: string }>("select id from authors where external_key = 'redaccion-qpv'");
    const authorId = authorRes.rows[0]?.id || null;

    let storyId: string | null = null;
    if (input.storyExternalKey) {
      const storyRes = await client.query<{ id: string }>("select id from stories where external_key = $1", [input.storyExternalKey]);
      storyId = storyRes.rows[0]?.id || null;
    }

    let slug = slugify(input.title);
    let suffix = 2;
    while (true) {
      const exists = await client.query("select 1 from articles where slug = $1", [slug]);
      if (exists.rows.length === 0) break;
      slug = `${slugify(input.title)}-${suffix}`;
      suffix++;
    }

    const imageLicenseStatus = input.imageLicenseStatus || (input.imageUrl ? "source_unlicensed" : "illustrative_fallback");
    const imageExtractedAt = input.imageUrl ? new Date().toISOString() : null;
    const status = input.status || "published";

    await client.query(
      `insert into articles (
         story_id, slug, title, excerpt, body, category_id, author_id, ai_generated, ai_model, status, news_score,
         image_url, image_source_url, image_credit, image_license_status, image_extracted_at, is_explainer,
         discovered_at, drafted_at, published_at, updated_at
       )
       values ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10, $11,$12,$13,$14,$15,$16, now(), now(), case when $9 = 'published' then now() else null end, now())`,
      [
        storyId, slug, input.title, input.excerpt, input.body, categoryId, authorId, input.aiModel, status, input.newsScore,
        input.imageUrl || null, input.imageSourceUrl || null, input.imageCredit || null, imageLicenseStatus, imageExtractedAt,
        !!input.isExplainer,
      ]
    );

    await client.query("commit");
    return { slug };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export type PendingArticle = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  categorySlug: string;
  newsScore: number;
  draftedAt: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
};

/** Borradores que cualquier administrador puede aprobar antes de publicar. */
export async function getPendingArticles(limit = 100): Promise<PendingArticle[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const res = await pool.query<{
    slug: string;
    title: string;
    excerpt: string | null;
    body: string | null;
    category_slug: string | null;
    news_score: number;
    drafted_at: Date | string | null;
    image_url: string | null;
    source_url: string | null;
    source_name: string | null;
  }>(
    `select a.slug, a.title, a.excerpt, a.body, a.news_score, a.drafted_at, a.image_url,
            c.slug as category_slug, ss.url as source_url, s.name as source_name
       from articles a
       left join categories c on c.id = a.category_id
       left join story_sources ss on ss.story_id = a.story_id
       left join sources s on s.id = ss.source_id
      where a.status = 'pending_review'
      order by a.drafted_at desc nulls last
      limit $1`,
    [limit]
  );
  const seen = new Set<string>();
  return res.rows.flatMap((row) => {
    if (seen.has(row.slug)) return [];
    seen.add(row.slug);
    return [{
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || "",
      body: row.body || "",
      categorySlug: row.category_slug || "comunidad",
      newsScore: row.news_score,
      draftedAt: row.drafted_at ? new Date(row.drafted_at).toISOString() : "",
      imageUrl: row.image_url || undefined,
      sourceUrl: row.source_url || undefined,
      sourceName: row.source_name || undefined,
    }];
  });
}

export type ReviewedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl?: string;
  imageCredit?: string;
};

/** Cambia el estado una sola vez; evita aprobar o rechazar dos veces el mismo borrador. */
export async function reviewPendingArticle(
  slug: string,
  decision: "approve" | "reject",
  reviewer: { username: string; displayName: string }
): Promise<ReviewedArticle | null> {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL no está configurada.");
  const pool = getPool();
  const status = decision === "approve" ? "published" : "discarded";
  const res = await pool.query<{
    slug: string;
    title: string;
    excerpt: string | null;
    body: string | null;
    image_url: string | null;
    image_credit: string | null;
    image_license_status: string | null;
  }>(
    `update articles
        set status = $2,
            reviewed_by_username = $3,
            reviewed_by_name = $4,
            reviewed_at = now(),
            approved_by_username = case when $2 = 'published' then $3 else null end,
            approved_by_name = case when $2 = 'published' then $4 else null end,
            published_at = case when $2 = 'published' then now() else null end,
            updated_at = now()
      where slug = $1 and status = 'pending_review'
      returning slug, title, excerpt, body, image_url, image_credit, image_license_status`,
    [slug, status, reviewer.username, reviewer.displayName]
  );
  const row = res.rows[0];
  if (!row) return null;
  return { slug: row.slug, title: row.title, excerpt: row.excerpt || "", body: row.body || "", imageUrl: realImageUrl(row), imageCredit: realImageUrl(row) ? row.image_credit || undefined : undefined };
}

// ---------------------------------------------------------------------
// REGENERAR IMÁGENES DE ARTÍCULOS VIEJOS — el propietario pidió (2026-09)
// que todos los artículos publicados antes de activar generateImage.ts
// (que hoy siguen con la foto ilustrativa repetida por categoría) también
// tengan su propia imagen única generada por IA. Ver backfillImages.ts.
// ---------------------------------------------------------------------

export type ArticleNeedingImage = {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  /** Link al artículo original, si quedó registrado — se usa como referencia visual (ver generateImage.ts). */
  sourceUrl?: string;
};

/** Artículos (noticias y Vallarta Explica) que todavía NO tienen imagen generada por IA. */
export async function getArticlesNeedingImageBackfill(limit = 8): Promise<ArticleNeedingImage[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const res = await pool.query<{
    slug: string;
    title: string;
    excerpt: string | null;
    category_slug: string | null;
    source_url: string | null;
  }>(
    `select a.slug, a.title, a.excerpt, c.slug as category_slug, ss.url as source_url
     from articles a
     left join categories c on c.id = a.category_id
     left join story_sources ss on ss.story_id = a.story_id
     where a.status = 'published'
       and (a.image_license_status is distinct from 'ai_generated' or a.image_license_status is null)
     order by a.published_at desc nulls last
     limit $1`,
    [limit]
  );
  const seen = new Set<string>();
  const items: ArticleNeedingImage[] = [];
  for (const r of res.rows) {
    if (seen.has(r.slug)) continue; // el join con story_sources puede duplicar filas (varias fuentes por story)
    seen.add(r.slug);
    items.push({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt || "",
      categorySlug: r.category_slug || "comunidad",
      sourceUrl: r.source_url || undefined,
    });
  }
  return items;
}

/** Reemplaza la imagen de un artículo ya publicado por una generada con IA. */
export async function updateArticleImage(
  slug: string,
  input: { imageUrl: string; imageCredit: string }
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `update articles
     set image_url = $1, image_credit = $2, image_source_url = null,
         image_license_status = 'ai_generated', image_extracted_at = now(), updated_at = now()
     where slug = $3`,
    [input.imageUrl, input.imageCredit, slug]
  );
}
