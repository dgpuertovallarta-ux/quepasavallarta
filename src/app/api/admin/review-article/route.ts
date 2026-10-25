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
import { creditoOficial } from "@/lib/qpv/oficiales";
import { fotoDeArchivo } from "@/lib/qpv/fotoArchivo";
import { patrocinioParaNota, contarPublicacion } from "@/lib/business/patrocinios";

/** Facebook: foto oficial de la nota o, si no, la de archivo del lugar/tema. Nunca la de otro medio. */
function fotoParaRedes(url: string | undefined, credito: string | undefined, titulo: string, resumen: string, fuente?: string) {
  // Foto oficial, o la que nos mandó el ciudadano en una denuncia (es nuestra para publicar).
  if (url && (creditoOficial(fuente) || /^(denuncia|reporte) ciudadan[oa]/i.test(credito ?? ""))) return { fotoFuente: url, creditoFoto: credito };
  const a = fotoDeArchivo(titulo, resumen);
  return a ? { fotoFuente: a.url, creditoFoto: a.credito } : {};
}

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
    const pat = await patrocinioParaNota(article.title, publicada?.category ?? "comunidad");
    const cardUrl = await crearTarjeta({
      patrocinio: pat ? { nombre: pat.nombre, logo: pat.logo } : null,
      titulo: article.title,
      categoria: publicada?.category ?? "comunidad",
      clave: article.slug,
      urlFuente: publicada?.sources[0]?.url,
      resumen: article.excerpt,
      ...fotoParaRedes(publicada?.imageUrl, publicada?.imageCredit, article.title, article.excerpt, publicada?.sources[0]?.url),
    });
    if (!cardUrl) {
      return NextResponse.json({
        reviewed: true,
        decision,
        reviewedBy: admin.displayName,
        published: true,
        socialSkipped: "No se pudo armar la tarjeta para redes; la nota quedó publicada solo en el sitio.",
      });
    }
    const social = await publishToSocial({
      title: article.title,
      excerpt: article.excerpt,
      articleUrl: `${siteUrl()}/noticia/${article.slug}`,
      imageUrl: cardUrl,
      patrocinador: pat?.nombre,
    });
    if (pat && social.facebook.ok) await contarPublicacion(pat.id, article.title);
    return NextResponse.json({ reviewed: true, decision, reviewedBy: admin.displayName, published: true, social });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo revisar la publicación." }, { status: 500 });
  }
}
