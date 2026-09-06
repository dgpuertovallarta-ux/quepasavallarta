import { getPool, isDatabaseConfigured } from "./client";
import type { NewsItem, Media } from "../data";
import type { PhotoKey } from "../photos";

/**
 * Lectura y publicación real de artículos — conecta la portada pública
 * (home, categorías, /noticia/[slug]) a Postgres en vez de al array de
 * demostración NEWS[] en data.ts. Sin DATABASE_URL configurada, las
 * funciones de lectura devuelven listas vacías (la portada cae de vuelta
 * al contenido demo) en lugar de fallar — mismo patrón que el resto del
 * pipeline de ingesta.
 */

// Imagen ilustrativa por categoría — reutiliza las fotos reales de
// Wikimedia ya verificadas en photos.ts (decisión del propietario:
// "seguir con ilustrativas por ahora", ver /docs/N8N_AUTOMATION.md).
const CATEGORY_IMAGE: Record<string, PhotoKey> = {
  "ultima-hora": "malecomAtardecer",
  seguridad: "maleconGeneral",
  gobierno: "maleconGeneral",
  comunidad: "fuenteAmistad",
  turismo: "malecomAtardecer",
  economia: "maleconGeneral",
  negocios: "maleconGeneral",
  transito: "construccion",
  playas: "playa",
  clima: "playaAtardecer",
  cultura: "bailarines",
  gastronomia: "tacos",
  eventos: "bailarines",
  entretenimiento: "bailarines",
  deportes: "faroMalecon",
  "medio-ambiente": "ballena",
  servicios: "construccion",
  politica: "maleconGeneral",
  jalisco: "maleconGeneral",
  mexico: "maleconGeneral",
  mundo: "maleconGeneral",
};

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

function imageForCategory(slug: string): PhotoKey {
  return CATEGORY_IMAGE[slug] || "maleconGeneral";
}

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
};

function mapRowToNewsItem(row: ArticleRow): NewsItem {
  const category = row.category_slug || "comunidad";
  return {
    slug: row.slug,
    title: row.title,
    dek: row.excerpt || "",
    category,
    zone: null,
    author: row.author_name,
    score: row.news_score,
    breaking: row.news_score >= 90,
    verified: true, // solo llega aquí después de revisión humana (ver /api/publish-article)
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    media: mediaForCategory(category),
    image: imageForCategory(category),
    imageUrl: row.image_url || undefined,
    imageCredit: row.image_credit || undefined,
    sources: row.source_url ? [{ label: row.source_name || "Fuente original", url: row.source_url }] : [],
    body: (row.body || "").split("\n\n").filter(Boolean),
  };
}

const SELECT_BASE = `
  select
    a.slug, a.title, a.excerpt, a.body, a.news_score, a.published_at, a.updated_at,
    a.image_url, a.image_credit,
    c.slug as category_slug,
    coalesce(au.display_name, 'Redacción Qué Pasa Vallarta') as author_name,
    ss.url as source_url,
    s.name as source_name
  from articles a
  left join categories c on c.id = a.category_id
  left join authors au on au.id = a.author_id
  left join story_sources ss on ss.story_id = a.story_id
  left join sources s on s.id = ss.source_id
  where a.status = 'published'
`;

export async function getPublishedArticles(limit = 30): Promise<NewsItem[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const res = await pool.query<ArticleRow>(
    `${SELECT_BASE} order by a.published_at desc nulls last limit $1`,
    [limit]
  );
  // left join con story_sources puede duplicar filas (varias fuentes por story) — quedarnos con una por slug.
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const row of res.rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    items.push(mapRowToNewsItem(row));
  }
  return items;
}

export async function getPublishedArticlesByCategory(categorySlug: string, limit = 30): Promise<NewsItem[]> {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const res = await pool.query<ArticleRow>(
    `${SELECT_BASE} and c.slug = $1 order by a.published_at desc nulls last limit $2`,
    [categorySlug, limit]
  );
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const row of res.rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    items.push(mapRowToNewsItem(row));
  }
  return items;
}

export async function getPublishedArticleBySlug(slug: string): Promise<NewsItem | null> {
  if (!isDatabaseConfigured()) return null;
  const pool = getPool();
  const res = await pool.query<ArticleRow>(`${SELECT_BASE} and a.slug = $1 limit 1`, [slug]);
  if (res.rows.length === 0) return null;
  return mapRowToNewsItem(res.rows[0]);
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

/** Evita republicar la misma Story en cada corrida del cron (cada 30 min). */
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
  /** Foto real extraída de la fuente (og:image) — ver extractImage.ts y la advertencia de derechos de autor en /docs/N8N_AUTOMATION.md. */
  imageUrl?: string;
  imageSourceUrl?: string;
  imageCredit?: string;
};

/**
 * Publica un artículo real. Requiere que un humano ya haya revisado el
 * texto (llamado desde /api/publish-article, disparado por el botón
 * "Publicar" del panel editorial, nunca automáticamente desde la IA).
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

    const imageLicenseStatus = input.imageUrl ? "source_unlicensed" : "illustrative_fallback";
    const imageExtractedAt = input.imageUrl ? new Date().toISOString() : null;

    await client.query(
      `insert into articles (
         story_id, slug, title, excerpt, body, category_id, author_id, ai_generated, ai_model, status, news_score,
         image_url, image_source_url, image_credit, image_license_status, image_extracted_at,
         discovered_at, drafted_at, published_at, updated_at
       )
       values ($1,$2,$3,$4,$5,$6,$7,true,$8,'published',$9, $10,$11,$12,$13,$14, now(), now(), now(), now())`,
      [
        storyId, slug, input.title, input.excerpt, input.body, categoryId, authorId, input.aiModel, input.newsScore,
        input.imageUrl || null, input.imageSourceUrl || null, input.imageCredit || null, imageLicenseStatus, imageExtractedAt,
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
