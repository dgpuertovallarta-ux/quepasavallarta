import Link from "next/link";
import { BUSINESSES } from "@/lib/data";
import { upcomingEvents, eventDateLabel } from "@/lib/events";
import { searchPublishedArticles, dropNearDuplicates } from "@/lib/db/articles";
import { timeAgo } from "@/lib/format";
import SearchBox from "@/components/SearchBox";

export const metadata = { title: "Buscar — Qué Pasa Vallarta", robots: { index: false, follow: true } };

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim().toLowerCase();
  const news = query ? dropNearDuplicates(await searchPublishedArticles(query, 24)) : [];
  const events = query ? upcomingEvents().filter((e) => (e.title + e.dek + e.location).toLowerCase().includes(query)) : [];
  const biz = query ? BUSINESSES.filter((b) => (b.name + b.dek).toLowerCase().includes(query)) : [];
  const total = news.length + events.length + biz.length;

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Buscar
      </div>
      <h1 style={{ margin: "0 0 16px" }}>Buscar</h1>
      <SearchBox initialQuery={q} />

      {!query ? (
        <div className="empty-state">Escribe algo para buscar en noticias, agenda y directorio.</div>
      ) : total === 0 ? (
        <div className="empty-state">No encontramos nada con &ldquo;{q}&rdquo;. Prueba con otras palabras.</div>
      ) : (
        <>
          {news.length > 0 && (
            <>
              <h3>Noticias</h3>
              <div className="panel" style={{ marginBottom: 20 }}>
                {news.map((n) => (
                  <div className="card-list-item" key={n.slug}>
                    <div className="card-list-body">
                      <h4 className="card-title">
                        <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
                      </h4>
                      <div className="card-meta">{timeAgo(n.publishedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {events.length > 0 && (
            <>
              <h3>Agenda</h3>
              <div className="panel" style={{ marginBottom: 20 }}>
                {events.map((e) => (
                  <div className="card-list-item" key={e.slug}>
                    <div className="card-list-body">
                      <h4 className="card-title">
                        <Link href={`/agenda/${e.slug}`}>{e.title}</Link>
                      </h4>
                      <div className="card-meta">
                        {eventDateLabel(e)} · {e.location}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {biz.length > 0 && (
            <>
              <h3>Vallarta Guía</h3>
              <div className="panel">
                {biz.map((b) => (
                  <div className="card-list-item" key={b.slug}>
                    <div className="card-list-body">
                      <h4 className="card-title">
                        <Link href={`/guia/${b.slug}`}>{b.name}</Link>
                      </h4>
                      <div className="card-meta">{b.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
