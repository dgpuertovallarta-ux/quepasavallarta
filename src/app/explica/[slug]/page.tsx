import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EXPLICA, getExplicaBySlug } from "@/lib/data";
import { PHOTOS } from "@/lib/photos";
import { fmtDate } from "@/lib/format";

export function generateStaticParams() {
  return EXPLICA.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getExplicaBySlug(slug);
  return { title: e ? `${e.title} — Vallarta Explica` : "No encontrado" };
}

export default async function ExplicaArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getExplicaBySlug(slug);
  if (!e) notFound();

  const blocks: [string, string][] = [
    ["Qué pasó", e.quePaso],
    ["Por qué importa", e.porQueImporta],
    ["Qué sabemos", e.queSabemos],
    ["Qué no sabemos", e.queNoSabemos],
    ["Contexto", e.contexto],
    ["Qué sigue", e.queSigue],
  ];

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href="/explica">Vallarta Explica</Link>
      </div>
      <div className="article-head">
        <span className="chip">Vallarta Explica</span>
        <h1>{e.title}</h1>
        <p className="article-dek">{e.dek}</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{fmtDate(e.publishedAt)}</p>
      </div>
      <div className="card-media" style={{ maxWidth: 780, aspectRatio: "16/9", borderRadius: "var(--radius-md)", marginBottom: 22 }}>
        <Image src={PHOTOS[e.image]} alt={e.title} fill sizes="780px" priority />
        <span className="photo-tag">Foto ilustrativa</span>
      </div>
      <div className="panel" style={{ maxWidth: 780 }}>
        {blocks.map(([label, body]) => (
          <div className="explica-block" key={label}>
            <div className="explica-label">{label}</div>
            <div className="explica-body">{body}</div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ maxWidth: 780, marginTop: 16 }}>
        <strong style={{ fontSize: 13 }}>Fuentes</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, color: "var(--text-muted)" }}>
          {e.fuentes.map((s) => (
            <li key={s.label}>
              <a href={s.url}>{s.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
