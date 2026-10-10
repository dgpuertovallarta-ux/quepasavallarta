import Link from "next/link";
import { upcomingEvents } from "@/lib/events";
import { EventCard } from "@/components/cards";

export const metadata = { title: "Vive Vallarta — Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: catParam } = await searchParams;
  const upcoming = upcomingEvents();
  const cats = ["Todas", ...Array.from(new Set(upcoming.map((e) => e.category)))];
  const cat = catParam && cats.includes(catParam) ? catParam : "Todas";
  const items = upcoming.filter((e) => cat === "Todas" || e.category === cat);

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Vive Vallarta
      </div>
      <h1 style={{ margin: "0 0 6px" }}>Vive Vallarta — Agenda</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 18 }}>
        Conciertos, festivales, deportes y tradiciones en Puerto Vallarta y la bahía. Las fechas vienen del
        calendario oficial de turismo; confirma horarios con el organizador antes de ir.
      </p>
      <div className="filter-row">
        {cats.map((c) => (
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
      {items.length ? (
        <div className="grid grid-3">
          {items.map((e) => (
            <EventCard ev={e} key={e.slug} />
          ))}
        </div>
      ) : (
        <div className="empty-state">Por ahora no hay eventos próximos en la agenda.</div>
      )}
    </div>
  );
}
