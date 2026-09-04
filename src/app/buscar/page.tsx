import Link from "next/link";
import { NEWS, EVENTS, BUSINESSES } from "@/lib/data";
import SearchBox from "@/components/SearchBox";

export const metadata = { title: "Buscar — Qué Pasa Vallarta" };

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim().toLowerCase();
  const news = query ? NEWS.filter((n) => (n.title + n.dek).toLowerCase().includes(query)) : [];
  const events = query ? EVENTS.filter((e) => (e.title + e.dek).toLowerCase().includes(query)) : [];
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
        <div className="empty-state">Sin resultados para &ldquo;{q}&rdquo; en el contenido demo.</div>
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
                      <div className="card-meta">{e.location}</div>
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
