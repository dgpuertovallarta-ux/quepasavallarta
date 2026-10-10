import Link from "next/link";
import { NEWS, CATEGORIES, getCategoryName } from "@/lib/data";
import { NewsCard } from "@/components/cards";
import { getPublishedArticles, getPublishedArticlesByCategory, dropNearDuplicates } from "@/lib/db/articles";
import { uniqueIllustrations } from "@/lib/photos";

export const revalidate = 60;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${getCategoryName(slug)} — Qué Pasa Vallarta` };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // "Última Hora" no es una categoría en la que se archive nada: es
  // simplemente todo lo más reciente del sitio.
  const latest = await getPublishedArticles(slug === "ultima-hora" ? 36 : 1);
  const real = slug === "ultima-hora" ? latest : await getPublishedArticlesByCategory(slug, 36);
  // Las notas de ejemplo solo se usan mientras el sitio no tiene ninguna
  // nota real — nunca se mezclan con contenido real.
  const siteHasRealContent = latest.length > 0;
  const demo = siteHasRealContent ? [] : NEWS.filter((n) => n.category === slug).map((n) => ({ ...n, isDemo: true }));
  const items = uniqueIllustrations(
    dropNearDuplicates((real.length > 0 ? real : demo).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)))
  );
  const name = getCategoryName(slug);

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / {name}
      </div>
      <h1 style={{ margin: "0 0 16px" }}>{name}</h1>
      <div className="filter-row">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            className={`filter-chip${c.slug === slug ? " active" : ""}`}
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            {c.name}
          </Link>
        ))}
      </div>
      {items.length ? (
        <div className="grid grid-3">
          {items.map((n) => (
            <NewsCard n={n} key={n.slug} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>Todavía no hay notas en {name}</h3>
          <p>
            Cuando publiquemos algo en esta sección aparecerá aquí. Mientras tanto, revisa{" "}
            <Link href="/categoria/ultima-hora">lo más reciente</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
