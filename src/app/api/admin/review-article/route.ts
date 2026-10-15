import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminIdentity } from "@/lib/auth/credentials";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { reviewPendingArticle } from "@/lib/db/articles";
import { publishToSocial } from "@/lib/social/publishToSocial";
import { isHurricaneSimonContent } from "@/lib/social/editorialPolicy";
import { siteUrl } from "@/lib/storage/imageBlobs";
import { getPublishedArticleBySlug } from "@/lib/db/articles";
import { crearTarjeta } from "@/lib/qpv/tarjetas";

async function currentAdmin() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  return session ? getAdminIdentity(session.username) : null;
}

export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Sesión de administrador inválida." }, { status: 401 });

  let body: { slug?: unknown; decision?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const decision = body.decision;
  if (!slug || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json({ error: "Indica el artículo y si se aprueba o rechaza." }, { status: 400 });
  }

  try {
    const article = await reviewPendingArticle(slug, decision, admin);
    if (!article) {
      return NextResponse.json({ error: "La publicación ya fue revisada o no está en la cola." }, { status: 409 });
    }
    if (decision === "reject") {
      return NextResponse.json({ reviewed: true, decision, reviewedBy: admin.displayName });
    }

    if (isHurricaneSimonContent(`${article.title} ${article.excerpt} ${article.body}`)) {
      return NextResponse.json({
        reviewed: true,
        decision,
        reviewedBy: admin.displayName,
        published: true,
        socialSkipped: "La regla editorial evita enviar a redes publicaciones sobre el huracán Simón.",
      });
    }

    // Aprobada por una persona: sale a redes en ese momento, con su tarjeta QPV (no con imagen de IA).
    const publicada = await getPublishedArticleBySlug(article.slug).catch(() => null);
    const cardUrl = await crearTarjeta({
      titulo: article.title,
      categoria: publicada?.category ?? "comunidad",
      clave: article.slug,
      urlFuente: publicada?.sources[0]?.url,
      fotoFuente: publicada?.imageUrl,
      creditoFoto: publicada?.imageCredit,
    });
    if (!cardUrl) {
      return NextResponse.json({
        reviewed: true,
        decision,
        reviewedBy: admin.displayName,
        published: true,
        socialSkipped: "La nota no tiene foto real, así que no se publicó en Facebook ni Instagram (regla: nada sin foto).",
      });
    }
    const social = await publishToSocial({
      title: article.title,
      excerpt: article.excerpt,
      articleUrl: `${siteUrl()}/noticia/${article.slug}`,
      imageUrl: cardUrl,
    });
    return NextResponse.json({ reviewed: true, decision, reviewedBy: admin.displayName, published: true, social });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo revisar la publicación." }, { status: 500 });
  }
}
