import Link from "next/link";
import Image from "next/image";
import { getCategoryName, AUTHORS, type NewsItem, type EventItem, type Business, type Media } from "@/lib/data";
import { PHOTOS } from "@/lib/photos";
import { timeAgo, fmtDate } from "@/lib/format";

function mediaClass(media: Media) {
  return { ocean: "", sunset: "alt", sand: "sand", green: "green" }[media] || "";
}

export function CardMedia({
  media,
  image,
  alt,
  sizes,
  priority,
}: {
  media?: Media;
  image?: keyof typeof PHOTOS;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`card-media ${media ? mediaClass(media) : ""}`}>
      {image ? (
        <>
          <Image src={PHOTOS[image]} alt={alt} fill sizes={sizes || "(max-width: 720px) 100vw, 33vw"} priority={priority} />
          <span className="photo-tag">Foto ilustrativa</span>
        </>
      ) : (
        <div className="card-media-label">
          Qué Pasa Vallarta
          <br />
          <small>imagen ilustrativa (demo)</small>
        </div>
      )}
    </div>
  );
}

export function NewsCard({ n, compact }: { n: NewsItem; compact?: boolean }) {
  return (
    <article className="card">
      <CardMedia media={n.media} image={n.image} alt={n.title} />
      <div className="card-body">
        <span className="card-kicker">{getCategoryName(n.category)}</span>
        <h3 className="card-title">
          <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
        </h3>
        {!compact && <p className="card-dek">{n.dek}</p>}
        <div className="card-meta">
          {n.verified && <span className="chip chip-verified">Verificado</span>}
          <span>{timeAgo(n.updatedAt || n.publishedAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function NewsListItem({ n }: { n: NewsItem }) {
  return (
    <div className="card-list-item">
      <div className="card-list-thumb" style={{ position: "relative", overflow: "hidden" }}>
        <Image src={PHOTOS[n.image]} alt="" fill sizes="84px" style={{ objectFit: "cover" }} />
      </div>
      <div className="card-list-body">
        <span className="card-kicker">{getCategoryName(n.category)}</span>
        <h4 className="card-title">
          <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
        </h4>
        <div className="card-meta">
          <span>{timeAgo(n.updatedAt || n.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function HeroCard({ n }: { n: NewsItem }) {
  return (
    <article className="hero-photo">
      <Image src={PHOTOS[n.image]} alt={n.title} fill sizes="(max-width: 900px) 100vw, 66vw" priority />
      <div className="hero-photo-body">
        {n.breaking ? (
          <span className="chip chip-breaking">Última hora</span>
        ) : (
          <span className="chip">{getCategoryName(n.category)}</span>
        )}
        <h2>
          <Link href={`/noticia/${n.slug}`} style={{ color: "inherit" }}>
            {n.title}
          </Link>
        </h2>
        <p>{n.dek}</p>
        <div className="hero-photo-meta">
          {n.verified && <span className="chip chip-verified">Verificado</span>}
          <span>{timeAgo(n.updatedAt || n.publishedAt)}</span>
        </div>
        <Link href={`/noticia/${n.slug}`} className="btn btn-primary btn-sm">
          Leer nota completa →
        </Link>
      </div>
    </article>
  );
}

export function EventCard({ ev }: { ev: EventItem }) {
  const d = new Date(ev.date + "T00:00:00");
  const day = d.toLocaleDateString("es-MX", { day: "2-digit" });
  const month = d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
  return (
    <article className="card">
      <CardMedia image={ev.image} alt={ev.title} />
      <div className="card-body">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div className="event-date">
            <span className="d">{day}</span>
            <span className="m">{month}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="card-kicker">{ev.category}</span>
            <h4 className="card-title" style={{ margin: "4px 0 6px" }}>
              <Link href={`/agenda/${ev.slug}`}>{ev.title}</Link>
            </h4>
          </div>
        </div>
        <p className="card-dek" style={{ margin: 0 }}>
          {ev.dek}
        </p>
        <div className="card-meta">
          📍 {ev.location} &nbsp;·&nbsp; ⏰ {ev.time} h
        </div>
      </div>
    </article>
  );
}

const PLAN_LABEL: Record<Business["plan"], string> = {
  conecta: "Vallarta Conecta",
  "conecta-pro": "Vallarta Conecta Pro",
  partner: "Partner",
};

export function BusinessCard({ b }: { b: Business }) {
  return (
    <article className="card biz-card">
      {b.featured && <span className="chip chip-sponsor biz-featured-badge">Destacado</span>}
      {b.image ? (
        <CardMedia image={b.image} alt={b.name} />
      ) : (
        <div className="card-media sand">
          <div className="card-media-label">{b.name.split(" (")[0]}</div>
        </div>
      )}
      <div className="card-body">
        <span className="card-kicker">{b.category}</span>
        <h3 className="card-title">
          <Link href={`/guia/${b.slug}`}>{b.name}</Link>
        </h3>
        <p className="card-dek">{b.dek}</p>
        <div className="card-meta">
          <span className="chip">{PLAN_LABEL[b.plan]}</span>
        </div>
        <div className="biz-cta-row">
          <a className="btn btn-primary btn-sm" href={`https://wa.me/${b.whatsapp}`} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <Link className="btn btn-outline btn-sm" href={`/guia/${b.slug}`}>
            Ver ficha
          </Link>
        </div>
      </div>
    </article>
  );
}

export function SectionHead({
  title,
  sub,
  linkHref,
  linkLabel,
}: {
  title: React.ReactNode;
  sub?: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="section-title">{title}</div>
        {sub && <div className="section-sub">{sub}</div>}
      </div>
      {linkHref && (
        <Link className="section-link" href={linkHref}>
          {linkLabel || "Ver todo →"}
        </Link>
      )}
    </div>
  );
}

export function DemoTag() {
  return <span className="chip chip-demo">Demo</span>;
}

export function Byline({ n }: { n: NewsItem }) {
  const a = AUTHORS[n.author] || AUTHORS.redaccion;
  return (
    <div className="byline">
      <span className="avatar">{a.initials}</span>
      <span>
        <strong style={{ color: "var(--text)" }}>{a.name}</strong> · {fmtDate(n.publishedAt)}
      </span>
    </div>
  );
}
