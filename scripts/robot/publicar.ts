/**
 * Publica una nota en WordPress a pedido (desde Actions → "Publicar nota").
 * Las de redacción/reportes no verificados salen con "Sin confirmación oficial".
 */
import { wp } from "../../src/lib/wp/cliente";
import { cuerpoAHtml } from "../../src/lib/wp/articulos";

async function main() {
  const e = process.env;
  const cats = new Map(((await wp<{ id: number; slug: string }[]>("/wp/v2/categories?per_page=100&_fields=id,slug")) ?? []).map((c) => [c.slug, c.id]));
  const cat = cats.get(e.NOTA_CATEGORIA || "transito") ?? cats.get("comunidad");
  const r = await wp<{ id: number; link: string }>("/wp/v2/posts", {
    method: "POST",
    json: {
      title: e.NOTA_TITULO,
      excerpt: e.NOTA_RESUMEN,
      content: cuerpoAHtml((e.NOTA_CUERPO || "").replace(/\\n/g, "\n")),
      status: "publish",
      categories: cat ? [cat] : [],
      meta: { qpv_score: Number(e.NOTA_PUNTAJE || 75), qpv_verified: e.NOTA_VERIFICADA === "true", qpv_author: "redaccion", qpv_sources: JSON.stringify([{ label: "Reportes de lectores a Qué Pasa Vallarta", url: "https://quepasavta.com/reporte" }]) },
    },
  });
  console.log("Publicada:", r.link);
}
main().catch((err) => { console.error(err); process.exit(1); });
