import Link from "next/link";
import { getCategoryName, type NewsItem } from "@/lib/data";
import { timeAgo } from "@/lib/format";

const SUGGESTIONS = ["Huracán", "Tráfico", "Aeropuerto", "Seguridad", "Playas", "Agua"];

/**
 * "Pregúntale a Vallarta": búsqueda sobre las notas reales publicadas en
 * el sitio. No redacta respuestas ni inventa datos — devuelve las notas
 * que hablan del tema, con su fuente y hace cuánto se publicaron. El
 * formulario es un GET normal a /pregunta?q=…, así funciona sin JavaScript.
 */
export default function AskBox({
  query,
  results,
  latest,
}: {
  query: string;
  results: NewsItem[];
  /** Notas más recientes — se muestran cuando la pregunta no encontró nada o es demasiado general. */
  latest: NewsItem[];
}) {
  const searched = query.trim().length > 0;
  const list = results.length > 0 ? results : latest;

  return (
    <>
      <div className="ask-box">
        <h1 style={{ margin: "0 0 8px" }}>Pregúntale a Vallarta</h1>
        <p style={{ maxWidth: 640, margin: 0, color: "var(--text-muted)" }}>
          Escribe un tema o una pregunta y te mostramos lo que hemos publicado al respecto, con su fuente.
          Solo responde con información que está en el sitio.
        </p>
        <form className="ask-input-row" action="/pregunta" method="get">
          <input
            className="ask-input"
            name="q"
            defaultValue={query}
            placeholder="Por ejemplo: ¿sigue abierto el aeropuerto?"
            aria-label="Tu pregunta"
          />
          <button className="btn btn-primary" type="submit">
            Preguntar
          </button>
        </form>
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <Link key={s} className="ask-suggestion" href={`/pregunta?q=${encodeURIComponent(s)}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      {searched && (
        <div className="ask-answer">
          {results.length === 0 && (
            <div className="ask-fact">
              <div className="ask-fact-label">Sin resultados</div>
              <p>
                No encontramos notas sobre &ldquo;{query}&rdquo;. Prueba con otras palabras; mientras tanto,
                esto es lo más reciente:
              </p>
            </div>
          )}
          {list.map((n) => (
            <div className="ask-fact" key={n.slug}>
              <div className="ask-fact-label">
                {getCategoryName(n.category)} · {timeAgo(n.updatedAt || n.publishedAt)}
              </div>
              <p>
                <Link href={`/noticia/${n.slug}`}>
                  <strong>{n.title}</strong>
                </Link>
                {n.dek && (
                  <>
                    <br />
                    {n.dek}
                  </>
                )}
              </p>
              {n.sources[0] && (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Fuente: {n.sources[0].label}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
