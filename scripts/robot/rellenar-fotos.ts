/**
 * Pone foto a las notas y explicadores de WordPress que no tienen (2026-10-28).
 * Para cada una, en este orden:
 *   1. Foto de la nota original (si es de fuente oficial o medio, con su crédito).
 *   2. Foto del TEMA: la IA lee el titular y busca en Wikimedia Commons (uso libre).
 *   3. Foto de archivo del lugar (Malecón, playas, etc.), si corresponde.
 * Uso: RELLENAR_TIPOS="explica,comunidad,cultura" RELLENAR_MAX=300 npx tsx scripts/robot/rellenar-fotos.ts
 */
import { wp } from "../../src/lib/wp/cliente";
import { fotoDeFuente } from "../../src/lib/qpv/fotoFuente";
import { fotoDelTema } from "../../src/lib/qpv/fotoTema";
import { fotoDeArchivo } from "../../src/lib/qpv/fotoArchivo";

type Post = { id: number; slug: string; title: { rendered: string }; excerpt: { rendered: string }; meta: Record<string, string> };
const limpio = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&#8217;|&#039;/g, "'").replace(/&#822[01];|&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z#0-9]+;/g, "").replace(/\s+/g, " ").trim();

async function main() {
  const tipos = (process.env.RELLENAR_TIPOS || "explica,comunidad,cultura").split(",").map((x) => x.trim()).filter(Boolean);
  const max = Number(process.env.RELLENAR_MAX || 300);
  const cats = new Map(((await wp<{ id: number; slug: string }[]>("/wp/v2/categories?per_page=100&_fields=id,slug")) ?? []).map((c) => [c.slug, c.id]));
  let hechas = 0, sinFoto = 0;
  for (const t of tipos) {
    const ruta = t === "explica" ? "explica" : "posts";
    const filtro = t === "explica" || t === "todas" ? "" : `&categories=${cats.get(t) ?? 0}`;
    for (let pagina = 1; pagina < 60 && hechas < max; pagina++) {
      const xs = (await wp<Post[]>(`/wp/v2/${ruta}?status=publish&per_page=100&page=${pagina}&context=edit&_fields=id,slug,title,excerpt,meta${filtro}`).catch(() => null)) ?? [];
      if (!xs.length) break;
      for (const p of xs) {
        if (hechas >= max) break;
        if (p.meta?.qpv_image_url) continue;
        const titulo = limpio(p.title.rendered), resumen = limpio(p.excerpt.rendered);
        let fuente: string | undefined, nombre: string | undefined;
        try { const f = JSON.parse(p.meta?.qpv_sources || "[]")[0]; fuente = f?.url; nombre = f?.label; } catch { /* sin fuente */ }
        let url = "", credito = "";
        if (fuente && !/quepasavta\.com/.test(fuente)) {
          const f = await fotoDeFuente(fuente, nombre).catch(() => null);
          if (f) { url = f.url; credito = f.credito; }
        }
        if (!url) {
          const f = await fotoDelTema(titulo, resumen).catch(() => null);
          if (f) { url = f.url; credito = f.credito; }
        }
        if (!url) {
          const a = fotoDeArchivo(titulo, resumen, p.slug);
          if (a) { url = a.url; credito = a.credito; }
        }
        if (!url) { sinFoto++; continue; }
        await wp(`/wp/v2/${ruta}/${p.id}`, { method: "POST", json: { meta: { qpv_image_url: url, qpv_image_credit: credito } } });
        hechas++;
        console.log(`${t}: ${titulo.slice(0, 70)} → ${credito.slice(0, 60)}`);
      }
    }
  }
  console.log(`Listo: ${hechas} con foto nueva, ${sinFoto} se quedan sin foto.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
