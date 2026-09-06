import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { publishArticle, getPrimarySourceForStory, findSimilarRecentArticle } from "@/lib/db/articles";
import { extractOgImage } from "@/lib/ingest/extractImage";
import { CATEGORIES } from "@/lib/data";

/**
 * Publica un artículo real en la portada pública. Se llama SOLO desde el
 * botón "Publicar" del panel editorial (/admin → Cola), después de que
 * un humano revisó (y pudo editar) el borrador que generó la IA —
 * "IA redacta, humano revisa", nunca automático.
 *
 * NOTA DE ALCANCE: este endpoint todavía no tiene autenticación de editor
 * (ver /docs/ARCHITECTURE.md — el panel /admin completo comparte esta
 * misma limitación pendiente). No lo expongas en un botón público.
 *
 * POST body: { title, excerpt, body, categorySlug, newsScore, aiModel, storyExternalKey }
 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no está configurada — no se puede publicar sin base de datos." }, { status: 501 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido — se espera JSON." }, { status: 400 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const excerpt = typeof payload.excerpt === "string" ? payload.excerpt.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const categorySlug = typeof payload.categorySlug === "string" ? payload.categorySlug : "";
  const newsScore = typeof payload.newsScore === "number" ? payload.newsScore : 0;
  const aiModel = typeof payload.aiModel === "string" ? payload.aiModel : null;
  const storyExternalKey = typeof payload.storyExternalKey === "string" ? payload.storyExternalKey : null;

  if (!title || !body) {
    return NextResponse.json({ error: "Falta título o cuerpo del artículo." }, { status: 400 });
  }
  if (!CATEGORIES.some((c) => c.slug === categorySlug)) {
    return NextResponse.json({ error: `Categoría "${categorySlug}" no reconocida.` }, { status: 400 });
  }

  const similarSlug = await findSimilarRecentArticle(title, { isExplainer: false });
  if (similarSlug) {
    return NextResponse.json(
      { error: `Ya existe un artículo muy similar publicado recientemente (/noticia/${similarSlug}) — revísalo antes de publicar este, para no duplicar la misma historia.` },
      { status: 409 }
    );
  }

  try {
    // Foto real de la fuente (decisión del propietario, con el riesgo de
    // derechos de autor ya explicado — ver extractImage.ts). Si no hay
    // storyExternalKey, o falla la extracción, publishArticle cae de
    // vuelta a la imagen ilustrativa por categoría.
    const primarySource = storyExternalKey ? await getPrimarySourceForStory(storyExternalKey) : null;
    const extractedImage = primarySource ? await extractOgImage(primarySource.url) : null;

    const result = await publishArticle({
      title,
      excerpt,
      body,
      categorySlug,
      newsScore,
      aiModel,
      storyExternalKey,
      imageUrl: extractedImage?.url,
      imageSourceUrl: extractedImage?.sourceUrl,
      imageCredit: primarySource?.sourceName,
    });
    return NextResponse.json({ published: true, slug: result.slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido al publicar." }, { status: 500 });
  }
}
