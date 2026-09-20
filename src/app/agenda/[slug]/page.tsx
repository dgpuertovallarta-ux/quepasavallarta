import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EVENTS } from "@/lib/data";
import { PHOTOS } from "@/lib/photos";
import { fmtDate } from "@/lib/format";

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

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href="/agenda">Vive Vallarta</Link>
      </div>
      <div className="article-head">
        <span className="chip">{e.category}</span>
        <h1>{e.title}</h1>
        <p className="article-dek">{e.dek}</p>
      </div>
      <div className="card-media" style={{ maxWidth: 680, aspectRatio: "16/9", borderRadius: "var(--radius-md)", marginBottom: 22 }}>
        <Image src={PHOTOS[e.image]} alt={e.title} fill sizes="680px" priority />
        <span className="photo-tag">Foto ilustrativa</span>
      </div>
      <div className="panel" style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          📅 <strong>{fmtDate(e.date)}</strong> · ⏰ {e.time} h
        </div>
        <div>📍 {e.location}</div>
        <div>🏛️ Organiza: {e.org}</div>
      </div>
    </div>
  );
}
