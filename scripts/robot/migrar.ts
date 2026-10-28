/**
 * Pasa las notas del sitio anterior (Postgres) a WordPress — se corre una vez (2026-10-27).
 * Conserva el mismo slug (las ligas /noticia/... siguen funcionando), la fecha, la foto,
 * la fuente y la sección. Si una nota ya está en WordPress (mismo slug anterior) la salta,
 * así se puede volver a correr sin duplicar.
 *
 * Uso: DATABASE_URL=… WP_URL=… WP_USER=… WP_APP_PASSWORD=… npx tsx scripts/robot/migrar.ts [limite]
 */
import { Pool } from "pg";
import { wp } from "../../src/lib/wp/cliente";
import { cuerpoAHtml, explicaAHtml } from "../../src/lib/wp/articulos";
import { repairArticle } from "../../src/lib/ingest/articleFormat";

type Fila = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  status: string;
  news_score: number;
  is_explainer: boolean;
  published_at: string | null;
  drafted_at: string | null;
  category_slug: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_license_status: string | null;
  source_url: string | null;
  source_name: string | null;
  story_key: string | null;
};

async function main() {
  const limite = Number(process.argv[2] || 5000);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  const cats = new Map(((await wp<{ id: number; slug: string }[]>("/wp/v2/categories?per_page=100&_fields=id,slug")) ?? []).map((c) => [c.slug, c.id]));
  const { rows } = await pool.query<Fila>(
    `select distinct on (a.slug) a.slug, a.title, a.excerpt, a.body, a.status, a.news_score, a.is_explainer,
            a.published_at, a.drafted_at, c.slug as category_slug, a.image_url, a.image_credit, a.image_license_status,
            ss.url as source_url, s.name as source_name, st.external_key as story_key
       from articles a
       left join categories c on c.id = a.category_id
       left join stories st on st.id = a.story_id
       left join story_sources ss on ss.story_id = a.story_id
       left join sources s on s.id = ss.source_id
      where a.status in ('published', 'pending_review')
      order by a.slug, ss.captured_at asc nulls last
      limit $1`,
    [limite]
  );
  rows.sort((x, y) => +new Date(x.published_at || x.drafted_at || 0) - +new Date(y.published_at || y.drafted_at || 0));
  console.log(`${rows.length} notas para pasar`);
  let hechas = 0, saltadas = 0, fallas = 0;
  for (const r of rows) {
    const tipo = r.is_explainer ? "explica" : "posts";
    try {
      const ya = (await wp<{ id: number }[]>(`/wp/v2/${tipo}?status=publish,pending,draft&qpv_original_slug=${encodeURIComponent(r.slug)}&_fields=id`)) ?? [];
      if (ya.length) { saltadas++; continue; }
      const f = repairArticle({ title: r.title || "", excerpt: r.excerpt || "", bodyParagraphs: (r.body || "").split("\n\n").filter(Boolean) });
      if (!f.title) { saltadas++; continue; }
      const cuerpo = f.bodyParagraphs.join("\n\n");
      const foto = r.image_url && r.image_license_status !== "ai_generated" && !/generada con ia/i.test(r.image_credit || "") && !r.image_url.includes("/api/image/") ? r.image_url : "";
      const fecha = (r.published_at || r.drafted_at) ? new Date(r.published_at || r.drafted_at!).toISOString().slice(0, 19) : undefined;
      const cat = cats.get(r.category_slug || "comunidad") ?? cats.get("comunidad");
      await wp(`/wp/v2/${tipo}`, {
        method: "POST",
        json: {
          slug: r.slug,
          title: f.title,
          excerpt: f.excerpt,
          content: r.is_explainer ? explicaAHtml(cuerpo) : cuerpoAHtml(cuerpo),
          status: r.status === "published" ? "publish" : "pending",
          date_gmt: fecha,
          categories: cat ? [cat] : [],
          meta: {
            qpv_original_slug: r.slug,
            qpv_score: r.news_score ?? 50,
            qpv_breaking: (r.news_score ?? 0) >= 90,
            qpv_verified: true,
            qpv_author: "ia",
            qpv_sources: JSON.stringify(r.source_url ? [{ label: r.source_name || "Fuente original", url: r.source_url }] : []),
            ...(r.story_key ? { qpv_story_key: r.story_key } : {}),
            ...(foto ? { qpv_image_url: foto, qpv_image_credit: r.image_credit || "" } : {}),
            ...(/^(reporte|denuncia) ciudadan/i.test(f.title) ? { qpv_es_reporte: 1 } : {}),
          },
        },
      });
      hechas++;
      if (hechas % 25 === 0) console.log(`… ${hechas} pasadas`);
    } catch (e) {
      fallas++;
      console.error(`falló ${r.slug}:`, e instanceof Error ? e.message : e);
    }
  }

  // Anuncios y patrocinios vigentes
  try {
    const ads = await pool.query<{ advertiser: string; slot: string; image_url: string; link_url: string; ends_at: string | null; active: boolean; clicks: number }>(
      "select advertiser, slot, image_url, link_url, ends_at::text, active, clicks from site_ads"
    );
    for (const a of ads.rows) {
      if (a.image_url.includes("/api/image/")) console.warn(`anuncio ${a.advertiser}: su imagen estaba en Netlify; súbela de nuevo en el panel`);
      await wp("/wp/v2/qpv_anuncio", {
        method: "POST",
        json: { title: a.advertiser, status: "publish", meta: { qpv_espacio: a.slot, qpv_imagen: a.image_url, qpv_liga: a.link_url, qpv_vence: a.ends_at || "", qpv_activo: a.active, qpv_clics: a.clicks } },
      });
    }
    console.log(`${ads.rows.length} anuncios pasados`);
  } catch (e) {
    console.log("anuncios:", e instanceof Error ? e.message : e);
  }
  console.log(`Listo: ${hechas} pasadas, ${saltadas} ya estaban o sin título, ${fallas} con error.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
