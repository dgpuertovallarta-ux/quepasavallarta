/**
 * Recupera las fotos de las notas pasadas del sitio anterior (2026-10-27).
 * En Netlify las fotos se guardaban en su almacén (/api/image/...), que ya no existe.
 * Para cada nota sin foto en WordPress:
 *   1. Baja otra vez la foto original (image_source_url) y la sube a WordPress.
 *   2. Si era foto de archivo, la vuelve a elegir (Wikimedia, con crédito).
 *   3. Si no hay ninguna, busca la foto de la nota original de la fuente.
 * Uso: DATABASE_URL=… WP_URL=… WP_USER=… WP_APP_PASSWORD=… npx tsx scripts/robot/fotos.ts
 */
import { Pool } from "pg";
import { wp, subirMedio } from "../../src/lib/wp/cliente";
import { fotoDeArchivo } from "../../src/lib/qpv/fotoArchivo";
import { fotoDeFuente } from "../../src/lib/qpv/fotoFuente";

type Post = { id: number; slug: string; title: { rendered: string }; excerpt: { rendered: string }; meta: Record<string, string> };
const limpio = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&#8217;/g, "'").replace(/&[a-z#0-9]+;/g, " ").trim();

async function bajar(url: string): Promise<{ bytes: Buffer; tipo: string } | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (QuePasaVallarta)" }, signal: AbortSignal.timeout(15000) });
    const tipo = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.ok || !/^image\/(jpe?g|png|webp)$/.test(tipo)) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    return bytes.byteLength > 8000 ? { bytes, tipo } : null;
  } catch {
    return null;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  const { rows } = await pool.query<{ slug: string; image_source_url: string | null; image_credit: string | null; image_license_status: string | null; source_url: string | null; source_name: string | null }>(
    `select distinct on (a.slug) a.slug, a.image_source_url, a.image_credit, a.image_license_status, ss.url as source_url, s.name as source_name
       from articles a left join story_sources ss on ss.story_id = a.story_id left join sources s on s.id = ss.source_id
      where a.status in ('published','pending_review') order by a.slug, ss.captured_at asc nulls last`
  );
  const datos = new Map(rows.map((r) => [r.slug, r]));
  let hechas = 0, sin = 0;
  for (const tipo of ["posts", "explica"]) {
    for (let pagina = 1; pagina < 100; pagina++) {
      const posts = (await wp<Post[]>(`/wp/v2/${tipo}?status=publish,pending&per_page=100&page=${pagina}&context=edit&_fields=id,slug,title,excerpt,meta`).catch(() => null)) ?? [];
      if (!posts.length) break;
      for (const p of posts) {
        if (p.meta?.qpv_image_url) continue;
        const d = datos.get(p.meta?.qpv_original_slug || p.slug);
        if (!d || d.image_license_status === "ai_generated") { sin++; continue; }
        const titulo = limpio(p.title.rendered), resumen = limpio(p.excerpt.rendered);
        let url = "", credito = "";
        if (d.image_source_url && /^https?:/.test(d.image_source_url)) {
          const f = await bajar(d.image_source_url);
          if (f) {
            url = (await subirMedio(f.bytes, f.tipo, `qpv-${p.slug.slice(0, 60)}.${f.tipo.split("/")[1].replace("jpeg", "jpg")}`)).url;
            credito = d.image_credit || d.source_name || "fuente original";
          }
        }
        if (!url && d.image_source_url === "archivo-v2") {
          const a = fotoDeArchivo(titulo, resumen, d.slug);
          if (a) { url = a.url; credito = a.credito; }
        }
        if (!url && d.source_url) {
          const f = await fotoDeFuente(d.source_url, d.source_name);
          if (f) { url = f.url; credito = f.credito; }
        }
        if (!url) { sin++; continue; }
        await wp(`/wp/v2/${tipo}/${p.id}`, { method: "POST", json: { meta: { qpv_image_url: url, qpv_image_credit: credito } } });
        hechas++;
        if (hechas % 20 === 0) console.log(`… ${hechas} fotos`);
      }
    }
  }
  console.log(`Listo: ${hechas} notas con foto recuperada, ${sin} se quedan sin foto (pleca de color).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
