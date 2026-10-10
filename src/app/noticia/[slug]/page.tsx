import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { NEWS, getNewsBySlug, getCategoryName, type NewsItem } from "@/lib/data";
import { NewsListItem, SectionHead, Byline, DemoTag } from "@/components/cards";
import { newsImageSrc, socialImageSrc, photoCreditLabel } from "@/lib/photos";
import ArticleBody from "@/components/ArticleBody";
import { fmtDateTime } from "@/lib/format";
import { getPublishedArticleBySlug, getPublishedArticlesByCategory } from "@/lib/db/articles";

// Artículos reales se publican después del build — no se pueden pre-generar todos.
export const dynamicParams = true;
export const revalidate = 60;

export function generateStaticParams() {
  return NEWS.map((n) => ({ slug: n.slug }));
}

async function findArticle(slug: string): Promise<NewsItem | undefined> {
  const real = await getPublishedArticleBySlug(slug);
  if (real) return real;
  const demo = getNewsBySlug(slug);
  return demo ? { ...demo, isDemo: true } : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = await findArticle(slug);
  if (!n) return { title: "Noticia no encontrada" };
  // Vista previa al compartir el enlace (Facebook, WhatsApp, X).
  const image = socialImageSrc(n);
  return {
    title: `${n.title} — Qué Pasa Vallarta`,
    description: n.dek,
    alternates: { canonical: `/noticia/${n.slug}` },
    openGraph: {
      type: "article",
      title: n.title,
      description: n.dek,
      url: `/noticia/${n.slug}`,
      siteName: "Qué Pasa Vallarta",
      locale: "es_MX",
      publishedTime: n.publishedAt,
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: n.title, description: n.dek, images: [image] },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = await findArticle(slug);
  if (!n) notFound();

  const relatedReal = n.isDemo ? [] : await getPublishedArticlesByCategory(n.category, 5);
  const related = n.isDemo
    ? NEWS.filter((x) => x.category === n.category && x.slug !== n.slug).slice(0, 4)
    : relatedReal.filter((x) => x.slug !== n.slug).slice(0, 4);

  return (
    <div className="container section article-page">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href={`/categoria/${n.category}`}>{getCategoryName(n.category)}</Link>
      </div>
      <div className="article-head">
        {n.breaking ? (
          <span className="chip chip-breaking">Última hora</span>
        ) : (
          <span className="chip">{getCategoryName(n.category)}</span>
        )}
        {n.verified ? (
          <span className="chip chip-verified" style={{ marginLeft: 6 }}>
            Verificado
          </span>
        ) : (
          <span className="chip chip-demo" style={{ marginLeft: 6 }}>
            Sin confirmación oficial
          </span>
        )}
        {n.isDemo && (
          <span style={{ marginLeft: 6 }}>
            <DemoTag />
          </span>
        )}
        <h1>{n.title}</h1>
        <p className="article-dek">{n.dek}</p>
        <Byline n={n} />
      </div>

      <figure className="article-figure">
        <div className="card-media">
          <Image src={newsImageSrc(n)} alt={n.title} fill sizes="(max-width: 1040px) 100vw, 980px" priority unoptimized={!!n.imageUrl} />
          <span className="photo-tag">{photoCreditLabel(n)}</span>
        </div>
      </figure>

      <ArticleBody paragraphs={n.body} />

      <div className="panel" style={{ maxWidth: 780, marginTop: 24 }}>
        <strong style={{ fontSize: 13 }}>Fuentes</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, color: "var(--text-muted)" }}>
          {n.sources.map((s) => (
            <li key={s.label}>
              <a href={s.url}>{s.label}</a>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
          Última actualización: {fmtDateTime(n.updatedAt)} ·{" "}
          {n.isDemo
            ? "Este es un artículo de demostración generado para el MVP."
            : "Redactado con asistencia de IA a partir de las fuentes citadas y revisado por el equipo editorial antes de publicarse."}
        </p>
      </div>

      <div className="section" style={{ paddingBottom: 0, maxWidth: 900 }}>
        <SectionHead title="Relacionadas" />
        <div className="panel">
          {related.length ? (
            related.map((r) => <NewsListItem n={r} key={r.slug} />)
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Todavía no hay más notas de esta categoría.</p>
          )}
        </div>
      </div>
    </div>
  );
}
