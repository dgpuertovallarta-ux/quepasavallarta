import Link from "next/link";
import { NEWS, CATEGORIES, getCategoryName } from "@/lib/data";
import { NewsCard } from "@/components/cards";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${getCategoryName(slug)} — Qué Pasa Vallarta` };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const items = NEWS.filter((n) => n.category === slug).sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
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
          <h3>Sin noticias demo en esta categoría todavía</h3>
          <p>
            En producción, esta vista se llenará automáticamente conforme el motor de recopilación
            (RSS/APIs) publique historias en &ldquo;{name}&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
