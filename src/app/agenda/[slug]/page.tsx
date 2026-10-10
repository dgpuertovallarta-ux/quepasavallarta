import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EVENTS, eventDateLabel } from "@/lib/events";
import { PHOTOS, PHOTO_CREDITS } from "@/lib/photos";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = EVENTS.find((x) => x.slug === slug);
  return { title: e ? `${e.title} — Vive Vallarta` : "Evento no encontrado" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = EVENTS.find((x) => x.slug === slug);
  if (!e) notFound();
  const credit = PHOTO_CREDITS[e.image];

  return (
    <div className="container section article-page">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href="/agenda">Vive Vallarta</Link>
      </div>
      <div className="article-head">
        <span className="chip">{e.category}</span>
        <h1>{e.title}</h1>
        <p className="article-dek">{e.dek}</p>
      </div>
      <figure className="article-figure">
        <div className="card-media">
          <Image src={PHOTOS[e.image]} alt="" fill sizes="(max-width: 1040px) 100vw, 980px" priority />
          <span className="photo-tag">{credit ? `Foto ilustrativa: ${credit}` : "Foto ilustrativa"}</span>
        </div>
      </figure>
      <dl className="fact-list">
        <div>
          <dt>Cuándo</dt>
          <dd>{eventDateLabel(e)}</dd>
        </div>
        <div>
          <dt>Dónde</dt>
          <dd>{e.location}</dd>
        </div>
        <div>
          <dt>Más información</dt>
          <dd>
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
              {e.sourceName} (calendario oficial de turismo)
            </a>
          </dd>
        </div>
      </dl>
      <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 720, marginTop: 16 }}>
        Las fechas y horarios pueden cambiar. Confirma con el organizador antes de ir.
      </p>
    </div>
  );
}
