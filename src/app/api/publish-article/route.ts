import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { publishArticle, findSimilarRecentArticle, getPrimarySourceForStory } from "@/lib/db/articles";
import { generateArticleImage } from "@/lib/ingest/generateImage";
import { CATEGORIES } from "@/lib/data";

/**
 * Guarda un borrador en la cola de aprobación. Requiere una sesión
 * administrativa válida mediante la protección configurada en proxy.ts.
 * Un administrador lo hace público desde /admin/aprobaciones.
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
    // Imagen 100% generada por IA (nunca la foto real del hecho) — ver
    // generateImage.ts. Se usa la foto de la fuente solo como referencia
    // visual para que la escena corresponda al lugar/hecho real. Si todo
    // falla, publishArticle cae de vuelta a la imagen ilustrativa por categoría.
    const primarySource = storyExternalKey ? await getPrimarySourceForStory(storyExternalKey) : null;
    const generatedImage = await generateArticleImage({ title, excerpt, categorySlug, sourceUrl: primarySource?.url });

    const result = await publishArticle({
      title,
      excerpt,
      body,
      categorySlug,
      newsScore,
      aiModel,
      storyExternalKey,
      imageUrl: generatedImage?.url,
      imageCredit: generatedImage ? "Imagen generada con IA" : undefined,
      imageLicenseStatus: generatedImage ? "ai_generated" : undefined,
      status: "pending_review",
    });
    return NextResponse.json({ queuedForReview: true, slug: result.slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido al publicar." }, { status: 500 });
  }
}
