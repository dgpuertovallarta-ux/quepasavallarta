import Link from "next/link";
import Image from "next/image";
import { NEWS, EXPLICA, EVENTS, BUSINESSES } from "@/lib/data";
import { EventCard, SectionHead, DemoTag } from "@/components/cards";
import HeroCarousel from "@/components/HeroCarousel";
import EditorialLead from "@/components/EditorialLead";
import LatestList from "@/components/LatestList";
import LiveFeed from "@/components/LiveFeed";
import CarouselRow from "@/components/CarouselRow";
import Reveal from "@/components/Reveal";
import AhoraStrip from "@/components/AhoraStrip";
import NewsletterForm from "@/components/NewsletterForm";
import { PHOTOS } from "@/lib/photos";

const QUICK_ACTIONS = [
  { href: "/alertas", icon: "🔔", title: "Alertas", sub: "Activa notificaciones de lo importante", color: "coral" },
  { href: "/mi-vallarta", icon: "📍", title: "Mi Zona", sub: "Noticias y alertas de tu colonia", color: "blue" },
  { href: "/agenda", icon: "📅", title: "Agenda", sub: "Descubre qué hay hoy en Vallarta", color: "purple" },
  { href: "/pregunta", icon: "💬", title: "Pregúntale a Vallarta", sub: "Búsqueda que responde lo que necesitas", color: "teal" },
];

const GUIDE_CATEGORIES = [
  { name: "Restaurantes", icon: "🍽️", color: "coral" },
  { name: "Hoteles", icon: "🏨", color: "blue" },
  { name: "Tours y actividades", icon: "🧭", color: "teal" },
  { name: "Salud", icon: "➕", color: "pink" },
  { name: "Inmobiliarias", icon: "🏠", color: "purple" },
  { name: "Automotriz", icon: "🚗", color: "green" },
];

export default function HomePage() {
  const sorted = [...NEWS].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const heroItems = sorted.slice(0, 5);
  const lead = sorted[0];
  const secondary = sorted.slice(1, 4);
  const latest = sorted.slice(0, 6);
  const explica = EXPLICA;
  const events = EVENTS;
  const featuredBiz = BUSINESSES.filter((b) => b.featured).length;

  return (
    <>
      <div className="container section-tight">
        <HeroCarousel items={heroItems} />
      </div>

      <div className="container section-tight">
        <Reveal>
          <div className="quick-actions">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="quick-action">
                <span className={`quick-action-icon icon-badge-${a.color}`}>{a.icon}</span>
                <span>
                  <span className="quick-action-title" style={{ display: "block" }}>{a.title}</span>
                  <span className="quick-action-sub">{a.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="container section-tight">
        <Reveal>
          <AhoraStrip />
        </Reveal>
      </div>

      <div className="container section">
        <SectionHead title="Lo más importante" sub="La ciudad ahora mismo" linkHref="/categoria/ultima-hora" linkLabel="Ver todas →" />
        <div className="grid grid-2" style={{ gridTemplateColumns: "1.7fr 1fr", alignItems: "start" }}>
          <Reveal>
            <EditorialLead lead={lead} secondary={secondary} />
          </Reveal>
          <Reveal delay={120}>
            <div className="panel">
              <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--text-muted)" }}>
                Lo último
              </strong>
              <LatestList items={latest} />
            </div>
          </Reveal>
        </div>
      </div>

      <div className="container section" style={{ borderTop: "1px solid var(--border)" }}>
        <Reveal>
          <div className="panel surface-dark">
            <SectionHead
              title={
                <>
                  <span className="live-dot" /> Ahora en Vallarta
                </>
              }
              sub="Actividad reciente de la ciudad — se actualiza desde el sistema editorial"
            />
            <LiveFeed />
          </div>
        </Reveal>
      </div>

      <div className="container section" style={{ borderTop: "1px solid var(--border)" }}>
        <Reveal>
          <SectionHead
            title={
              <>
                Explica — entendemos lo que importa <DemoTag />
              </>
            }
            linkHref="/explica"
            linkLabel="Ver todos →"
          />
        </Reveal>
        <Reveal delay={80}>
          <CarouselRow>
            {explica.map((e) => (
              <Link
                key={e.slug}
                href={`/explica/${e.slug}`}
                className="card carousel-item"
                style={{ textDecoration: "none", color: "inherit", width: 340 }}
              >
                <div className="card-media">
                  <Image src={PHOTOS[e.image]} alt={e.title} fill sizes="340px" />
                  <span className="chip" style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>Explica</span>
                </div>
                <div className="card-body">
                  <h3 className="card-title" style={{ margin: 0 }}>
                    {e.title}
                  </h3>
                  <p className="card-dek">{e.dek}</p>
                  <span className="link-arrow" style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
                    Leer explicación <span className="arrow">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </CarouselRow>
        </Reveal>
      </div>

      <div className="container section" style={{ borderTop: "1px solid var(--border)" }}>
        <Reveal>
          <SectionHead title="Vive Vallarta" sub="Qué hacer esta semana en la ciudad" linkHref="/agenda" linkLabel="Ver más →" />
        </Reveal>
        <Reveal delay={80}>
          <CarouselRow>
            {events.map((e) => (
              <div className="carousel-item" style={{ width: 320 }} key={e.slug}>
                <EventCard ev={e} />
              </div>
            ))}
          </CarouselRow>
        </Reveal>
      </div>

      <div className="container section" style={{ borderTop: "1px solid var(--border)" }}>
        <Reveal>
          <div id="newsletter" className="banner-photo scrim-left" style={{ marginBottom: 20 }}>
            <Image src={PHOTOS.malecomAtardecer} alt="" fill sizes="100vw" />
            <div className="banner-photo-content">
              <h3 style={{ color: "#fff" }}>Buenos días, Vallarta ☀️</h3>
              <p>Recibe lo más importante cada mañana, directo en tu correo.</p>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <NewsletterForm />
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="banner-photo scrim-warm">
            <Image src={PHOTOS.ceviche} alt="" fill sizes="100vw" />
            <div className="banner-photo-content">
              <span className="chip chip-sponsor" style={{ marginBottom: 8, display: "inline-block" }}>Vallarta Conecta</span>
              <h3 style={{ color: "#fff" }}>Impulsa tu negocio con visibilidad real y conectada con tu audiencia</h3>
              <p style={{ marginBottom: 14 }}>{featuredBiz} negocios ya están destacados en Qué Pasa Vallarta.</p>
              <Link className="btn btn-primary" href="/conecta">Conoce más →</Link>
            </div>
            <div className="banner-photo-stats">
              <span className="banner-photo-stat">📈 Más visibilidad</span>
              <span className="banner-photo-stat">👥 Más clientes</span>
              <span className="banner-photo-stat">📊 Más resultados</span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="container section" style={{ borderTop: "1px solid var(--border)" }}>
        <Reveal>
          <SectionHead title="Guía de negocios" linkHref="/guia" linkLabel="Ver guía completa →" />
        </Reveal>
        <Reveal delay={80}>
          <div className="guide-icon-grid">
            {GUIDE_CATEGORIES.map((c) => (
              <Link key={c.name} href={`/guia?cat=${encodeURIComponent(c.name)}`} className="guide-icon-tile">
                <span className={`icon icon-badge-${c.color}`}>{c.icon}</span>
                <span className="label">{c.name}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </>
  );
}
