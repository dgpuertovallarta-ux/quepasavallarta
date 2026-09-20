import Link from "next/link";
import { BUSINESSES } from "@/lib/data";
import { BusinessCard } from "@/components/cards";

export const metadata = { title: "Vallarta Guía — Qué Pasa Vallarta" };

const CATS = ["Todas", ...Array.from(new Set(BUSINESSES.map((b) => b.category)))];

export default async function GuiaPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: catParam } = await searchParams;
  const cat = catParam && CATS.includes(catParam) ? catParam : "Todas";
  const items = BUSINESSES.filter((b) => cat === "Todas" || b.category === cat).sort(
    (a, b) => Number(b.featured) - Number(a.featured)
  );

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Vallarta Guía
      </div>
      <h1 style={{ margin: "0 0 6px" }}>📖 Vallarta Guía</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 660, marginBottom: 18 }}>
        Directorio de restaurantes, hoteles, tours, salud, inmobiliarias y más. Los negocios marcados
        como &ldquo;Destacado&rdquo; tienen un plan Vallarta Conecta. <Link href="/conecta">Anuncia tu negocio aquí</Link>.
      </p>
      <div className="filter-row">
        {CATS.map((c) => (
          <Link
            key={c}
            href={c === "Todas" ? "/guia" : `/guia?cat=${encodeURIComponent(c)}`}
            className={`filter-chip${c === cat ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {c}
          </Link>
        ))}
      </div>
      <div className="grid grid-3">
        {items.map((b) => (
          <BusinessCard b={b} key={b.slug} />
        ))}
      </div>
    </div>
  );
}
