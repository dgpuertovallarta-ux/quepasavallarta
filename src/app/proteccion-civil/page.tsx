import Link from "next/link";
import { NewsCard } from "@/components/cards";
import { getEmergencyArticles, dropNearDuplicates } from "@/lib/db/articles";
import { uniqueIllustrations } from "@/lib/photos";
import { getLocalStormAdvisories } from "@/lib/official/nhc";
import { timeAgo } from "@/lib/format";

export const metadata = {
  title: "Protección Civil — Qué Pasa Vallarta",
  description:
    "Avisos oficiales de ciclones para la costa de Jalisco y las noticias de Protección Civil en Puerto Vallarta: alertas, refugios, suspensiones y servicios.",
};
// Los avisos oficiales cambian cada 3 horas; la página se rehace cada 5 minutos.
export const revalidate = 300;

const OFFICIAL_LINKS = [
  { name: "Centro Nacional de Huracanes (avisos oficiales)", url: "https://www.nhc.noaa.gov/?epac" },
  { name: "Servicio Meteorológico Nacional — Conagua", url: "https://smn.conagua.gob.mx/" },
  { name: "Protección Civil y Bomberos Jalisco", url: "https://proteccioncivil.jalisco.gob.mx/" },
];

export default async function ProteccionCivilPage() {
  const [advisories, notes] = await Promise.all([getLocalStormAdvisories(), getEmergencyArticles(30, 7)]);
  const items = uniqueIllustrations(dropNearDuplicates(notes));

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Protección Civil
      </div>
      <h1 style={{ margin: "0 0 6px" }}>Protección Civil</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 680, marginBottom: 22 }}>
        Avisos oficiales de ciclones para la costa de Jalisco y lo que publican las autoridades y los medios sobre
        alertas, refugios, suspensiones y servicios en Puerto Vallarta y la bahía.
      </p>

      <div className="pc-grid">
        <section className="pc-official" aria-label="Avisos oficiales vigentes">
          <span className="card-kicker">Aviso oficial vigente</span>
          {advisories.length > 0 ? (
            advisories.map((a) => (
              <div className="pc-advisory" key={a.url}>
                <h2>{a.system}</h2>
                {a.headline && <p className="pc-advisory-lead">{a.headline}.</p>}
                <p className="pc-advisory-meta">
                  {a.label}
                  {a.publishedAt ? ` · emitido ${timeAgo(a.publishedAt)}` : ""} · Centro Nacional de Huracanes
                </p>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                  Leer el aviso oficial completo
                </a>
              </div>
            ))
          ) : (
            <p className="pc-advisory-meta" style={{ marginTop: 10 }}>
              En este momento no hay un aviso de ciclón vigente para la costa de Jalisco o Nayarit.
            </p>
          )}
        </section>

        <aside className="pc-side">
          <div className="pc-emergency">
            <span>Emergencias</span>
            <a href="tel:911">911</a>
          </div>
          <span className="card-kicker">Fuentes oficiales</span>
          <ul className="pc-links">
            {OFFICIAL_LINKS.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.name}
                </a>
              </li>
            ))}
            <li>
              <Link href="/ahora">Clima, oleaje y viento en este momento</Link>
            </li>
          </ul>
        </aside>
      </div>

      <h2 className="pc-section-title">Lo más reciente</h2>
      {items.length ? (
        <div className="grid grid-3">
          {items.map((n) => (
            <NewsCard n={n} key={n.slug} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>Sin avisos de Protección Civil en los últimos días</h3>
          <p>
            Cuando haya alertas, suspensiones o avisos de las autoridades aparecerán aquí. Mientras tanto, revisa{" "}
            <Link href="/categoria/ultima-hora">lo más reciente</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
