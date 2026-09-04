import Link from "next/link";
import Image from "next/image";
import { getCategoryName, type NewsItem } from "@/lib/data";
import { CardMedia } from "./cards";
import { PHOTOS } from "@/lib/photos";
import { timeAgo } from "@/lib/format";

export default function EditorialLead({ lead, secondary }: { lead: NewsItem; secondary: NewsItem[] }) {
  return (
    <div className="lead-grid">
      <article className="card">
        <CardMedia media={lead.media} image={lead.image} alt={lead.title} sizes="(max-width: 960px) 100vw, 60vw" priority />
        <div className="card-body" style={{ padding: 20 }}>
          {lead.breaking ? (
            <span className="chip chip-breaking">Última hora</span>
          ) : (
            <span className="card-kicker">{getCategoryName(lead.category)}</span>
          )}
          <h3 className="card-title" style={{ fontSize: 24, margin: "6px 0" }}>
            <Link href={`/noticia/${lead.slug}`}>{lead.title}</Link>
          </h3>
          <p className="card-dek">{lead.dek}</p>
          <div className="card-meta">
            {lead.verified && <span className="chip chip-verified">Verificado</span>}
            <span>{timeAgo(lead.updatedAt || lead.publishedAt)}</span>
          </div>
        </div>
      </article>
      <div className="lead-secondary">
        {secondary.map((n) => (
          <div className="lead-secondary-item" key={n.slug}>
            <div className="lead-secondary-thumb">
              <Image src={PHOTOS[n.image]} alt="" fill sizes="100px" />
            </div>
            <div className="lead-secondary-body">
              <span className="card-kicker">{getCategoryName(n.category)}</span>
              <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
              <div className="card-meta" style={{ marginTop: 4 }}>
                <span>{timeAgo(n.updatedAt || n.publishedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
