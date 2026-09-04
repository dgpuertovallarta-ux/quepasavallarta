import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BUSINESSES, getBusinessBySlug } from "@/lib/data";
import { PHOTOS } from "@/lib/photos";

export function generateStaticParams() {
  return BUSINESSES.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = getBusinessBySlug(slug);
  return { title: b ? `${b.name} — Vallarta Guía` : "Negocio no encontrado" };
}

export default async function NegocioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = getBusinessBySlug(slug);
  if (!b) notFound();

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href="/guia">Vallarta Guía</Link>
      </div>
      <div className={`card-media${b.image ? "" : " sand"}`} style={{ borderRadius: "var(--radius-md)", maxWidth: 780, aspectRatio: "16/9", marginBottom: 18 }}>
        {b.image ? (
          <>
            <Image src={PHOTOS[b.image]} alt={b.name} fill sizes="780px" priority />
            <span className="photo-tag">Foto ilustrativa</span>
          </>
        ) : (
          <div className="card-media-label">{b.name.split(" (")[0]}</div>
        )}
      </div>
      <div className="article-head">
        <span className="chip">{b.category}</span>
        {b.featured && (
          <span className="chip chip-sponsor" style={{ marginLeft: 6 }}>
            Destacado
          </span>
        )}
        <h1>{b.name}</h1>
        <p className="article-dek">{b.dek}</p>
      </div>
      <div className="panel" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>🕒 {b.hours}</div>
        <div>📞 {b.phone}</div>
        <div>
          🌐 <a href={b.website}>Sitio web</a>
        </div>
        <div className="biz-cta-row" style={{ marginTop: 6 }}>
          <a className="btn btn-primary" href={`https://wa.me/${b.whatsapp}`} target="_blank" rel="noopener">
            Escribir por WhatsApp
          </a>
          <a className="btn btn-outline" href={`tel:${b.phone.replace(/\s/g, "")}`}>
            Llamar
          </a>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 520, marginTop: 14 }}>
        Ficha de demostración. En producción, esta información la administra el propio negocio desde su
        panel Vallarta Conecta.
      </p>
    </div>
  );
}
