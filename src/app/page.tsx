import Link from "next/link";
import Image from "next/image";
import { NEWS, EXPLICA, getCategoryName, type NewsItem } from "@/lib/data";
import { getPublishedArticles, getPublishedExplainers, dropNearDuplicates, getEmergencyArticles } from "@/lib/db/articles";
import { upcomingEvents, eventDateLabel } from "@/lib/events";
import { NewsCard, SectionHead, StoryMeta, DemoTag } from "@/components/cards";
import CarouselRow from "@/components/CarouselRow";
import WeatherBar from "@/components/WeatherBar";
import NewsletterForm from "@/components/NewsletterForm";
import { PHOTOS, newsImageSrc, photoCreditLabel, uniqueIllustrations, type PhotoKey } from "@/lib/photos";

const GUIDE_CATEGORIES = ["Restaurantes", "Hoteles", "Tours y actividades", "Salud", "Inmobiliarias", "Automotriz"];

const TIME_ZONE = "America/Mexico_City";

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: TIME_ZONE }).replace(".", "");
}

function StoryPhoto({ n, sizes, priority }: { n: NewsItem; sizes: string; priority?: boolean }) {
  return (
    <Link href={`/noticia/${n.slug}`} className="lead-media" aria-hidden="true" tabIndex={-1}>
      <Image src={newsImageSrc(n)} alt="" fill sizes={sizes} priority={priority} unoptimized={!!n.imageUrl} />
      <span className="photo-tag">{photoCreditLabel(n)}</span>
    </Link>
  );
}

export const revalidate = 60;

export default async function HomePage() {
  const [real, emergency] = await Promise.all([getPublishedArticles(45), getEmergencyArticles(6, 2)]);
  // Franja de aviso: solo aparece cuando hay actividad real de Protección
  // Civil (tres o más notas de emergencia en las últimas 48 horas).
  const alertNote = emergency.length >= 3 ? emergency[0] : null;
  const demo = NEWS.map((n) => ({ ...n, isDemo: true }));
  const byDate = (real.length > 0 ? real : demo).sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );
  // En portada: una sola nota por hecho (si se publicaron varias casi
  // iguales se queda la más reciente) y ninguna foto ilustrativa repetida.
  const events = upcomingEvents().slice(0, 8);
  // Las fotos de la agenda ya están tomadas: ninguna nota las repite.
  const usedPhotos = new Set<PhotoKey>(events.map((e) => e.image));
  const sorted = uniqueIllustrations(dropNearDuplicates(byDate), usedPhotos);
  // Cada bloque continúa donde terminó el anterior, para que ninguna
  // nota se repita en la portada.
  const lead = sorted[0];
  const leadMore = sorted.slice(1, 3);
  const trio = sorted.slice(3, 6);
  const feature = sorted[6];
  const timeline = sorted.slice(7, 13);
  // La rejilla es de 4 columnas: se recorta a filas completas para no dejar huecos.
  const rest = sorted.slice(13, 25);
  const moreNews = rest.length > 4 ? rest.slice(0, Math.floor(rest.length / 4) * 4) : rest;

  const realExplica = await getPublishedExplainers(10);
  const explica = uniqueIllustrations(
    dropNearDuplicates(realExplica.length > 0 ? realExplica : EXPLICA.map((e) => ({ ...e, isDemo: true }))),
    usedPhotos
  );
  const explicaLead = explica[0];
  const explicaMore = explica.slice(1, 4);

  return (
    <>
      <div className="container">
        {alertNote && (
          <Link href="/proteccion-civil" className="alert-band">
            <strong>Protección Civil</strong>
            <span>{alertNote.title}</span>
            <em>Avisos oficiales y cobertura →</em>
          </Link>
        )}
        <WeatherBar />
      </div>

      <div className="container">
        {lead && (
          <section className="lead rule" aria-label="Nota principal">
            <div>
              <span className="card-kicker">{getCategoryName(lead.category)}</span>
              <h2 className="display lead-title">
                <Link href={`/noticia/${lead.slug}`}>{lead.title}</Link>
              </h2>
              <p className="lead-dek">{lead.dek}</p>
              <StoryMeta n={lead} />
              {leadMore.length > 0 && (
                <div className="lead-more">
                  {leadMore.map((n) => (
                    <article className="lead-more-item" key={n.slug}>
                      <h3 className="headline">
                        <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
                      </h3>
                      <StoryMeta n={n} />
                    </article>
                  ))}
                </div>
              )}
            </div>
            <StoryPhoto n={lead} sizes="(max-width: 900px) 100vw, 66vw" priority />
          </section>
        )}

        {trio.length > 0 && (
          <section className="trio rule" aria-label="Más notas destacadas">
            {trio.map((n) => (
              <NewsCard n={n} key={n.slug} compact square />
            ))}
          </section>
        )}
      </div>

      <aside className="ad-band" aria-label="Publicidad">
        <div className="container">
          <div className="ad-label">Publicidad</div>
          <Link href="/conecta">
            <img src="/media/byd-banner.gif" alt="BYD Puerto Vallarta — Vive Vallarta en modo 100% eléctrico" />
          </Link>
        </div>
      </aside>

      {feature && (
        <div className="container section">
          <SectionHead title="Ahora en Vallarta" linkHref="/ahora" linkLabel="Ver todo" />
          <div className="split">
            <div className="timeline">
              {timeline.map((n) => (
                <article className="timeline-item" key={n.slug}>
                  <div className="timeline-time">
                    <strong>{clockTime(n.publishedAt)}</strong>
                    <span>{shortDate(n.publishedAt)}</span>
                  </div>
                  <span className="timeline-rail" aria-hidden="true" />
                  <div>
                    <h3 className="headline">
                      <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
                    </h3>
                    {n.isDemo && (
                      <div className="story-meta">
                        <DemoTag />
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <article className="feature">
              <StoryPhoto n={feature} sizes="(max-width: 900px) 100vw, 66vw" />
              <span className="card-kicker">{getCategoryName(feature.category)}</span>
              <h3 className="display feature-title" style={{ marginTop: 8 }}>
                <Link href={`/noticia/${feature.slug}`}>{feature.title}</Link>
              </h3>
              <p className="lead-dek">{feature.dek}</p>
              <StoryMeta n={feature} />
            </article>
          </div>
        </div>
      )}

      {explicaLead && (
        <section className="band surface-paper">
          <div className="container">
            <SectionHead
              title={
                <>
                  Vallarta Explica {realExplica.length === 0 && <DemoTag />}
                </>
              }
              sub="Entendemos lo que importa"
              linkHref="/explica"
              linkLabel="Ver todos"
            />
            <div className="split split-even">
              <article className="feature">
                <Link href={`/explica/${explicaLead.slug}`} className="lead-media" aria-hidden="true" tabIndex={-1}>
                  <Image
                    src={explicaLead.imageUrl || PHOTOS[explicaLead.image]}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 50vw"
                    unoptimized={!!explicaLead.imageUrl}
                  />
                  <span className="photo-tag">{photoCreditLabel(explicaLead)}</span>
                </Link>
                <h3 className="feature-title-serif">
                  <Link href={`/explica/${explicaLead.slug}`}>{explicaLead.title}</Link>
                </h3>
                <p className="lead-dek">{explicaLead.dek}</p>
              </article>
              <div className="thumb-list">
                {explicaMore.map((e) => (
                  <Link key={e.slug} href={`/explica/${e.slug}`} className="thumb-list-item">
                    <h3 className="headline">{e.title}</h3>
                    <div className="thumb-list-media">
                      <Image src={e.imageUrl || PHOTOS[e.image]} alt="" fill sizes="244px" unoptimized={!!e.imageUrl} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {moreNews.length > 0 && (
        <div className="container section">
          <SectionHead title="Más noticias" linkHref="/categoria/ultima-hora" linkLabel="Ver todas" />
          <div className="grid grid-4">
            {moreNews.map((n) => (
              <NewsCard n={n} key={n.slug} compact />
            ))}
          </div>
        </div>
      )}

      <div className="container section-tight">
        <section id="newsletter" className="newsletter-block surface-stone" aria-label="Boletín">
          <img src="/brand/logo-transparent.png" alt="" />
          <h2>Buenos días, Vallarta</h2>
          <p>Recibe lo más importante cada mañana, directo en tu correo.</p>
          <NewsletterForm />
        </section>
      </div>

      {events.length > 0 && (
        <div className="container section">
          <SectionHead title="Vive Vallarta" sub="Qué hacer en la ciudad" linkHref="/agenda" linkLabel="Ver agenda" />
          <CarouselRow>
            {events.map((e) => (
              <Link key={e.slug} href={`/agenda/${e.slug}`} className="tall-card carousel-item quarter">
                <Image src={PHOTOS[e.image]} alt="" fill sizes="(max-width: 720px) 78vw, 25vw" />
                <div className="tall-card-body">
                  <span className="tall-card-kicker">
                    {e.category} · {eventDateLabel(e)}
                  </span>
                  <h3 className="tall-card-title">{e.title}</h3>
                  <span className="tall-card-meta">{e.location}</span>
                </div>
              </Link>
            ))}
          </CarouselRow>
        </div>
      )}

      <div className="container section">
        <SectionHead title="Guía de negocios" linkHref="/guia" linkLabel="Ver guía completa" />
        <nav className="link-grid" aria-label="Categorías de la guía">
          {GUIDE_CATEGORIES.map((name) => (
            <Link key={name} href={`/guia?cat=${encodeURIComponent(name)}`}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="cta-strip" style={{ marginTop: 34 }}>
          <div>
            <span className="card-kicker">Vallarta Conecta</span>
            <h3>Impulsa tu negocio con visibilidad real y conectada con tu audiencia</h3>
          </div>
          <Link className="btn btn-primary" href="/conecta">
            Conoce más
          </Link>
        </div>
      </div>
    </>
  );
}
