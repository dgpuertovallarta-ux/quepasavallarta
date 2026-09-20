import Link from "next/link";
import { EVENTS } from "@/lib/data";
import { EventCard } from "@/components/cards";

export const metadata = { title: "Vive Vallarta — Agenda" };

const CATS = ["Todas", ...Array.from(new Set(EVENTS.map((e) => e.category)))];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: catParam } = await searchParams;
  const cat = catParam && CATS.includes(catParam) ? catParam : "Todas";
  const items = [...EVENTS]
    .filter((e) => cat === "Todas" || e.category === cat)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Vive Vallarta
      </div>
      <h1 style={{ margin: "0 0 6px" }}>🌴 Vive Vallarta — Agenda</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 18 }}>
        Conciertos, festivales, deportes y cultura. Qué hay hoy y esta semana en la ciudad.
      </p>
      <div className="filter-row">
        {CATS.map((c) => (
          <Link
            key={c}
            href={c === "Todas" ? "/agenda" : `/agenda?cat=${encodeURIComponent(c)}`}
            className={`filter-chip${c === cat ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {c}
          </Link>
        ))}
      </div>
      <div className="grid grid-2">
        {items.length ? (
          items.map((e) => <EventCard ev={e} key={e.slug} />)
        ) : (
          <div className="empty-state">Sin eventos en esta categoría.</div>
        )}
      </div>
    </div>
  );
}
