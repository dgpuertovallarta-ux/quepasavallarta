import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EXPLICA, getExplicaBySlug, type ExplicaItem } from "@/lib/data";
import { DemoTag } from "@/components/cards";
import { newsImageSrc } from "@/lib/photos";
import { fmtDate } from "@/lib/format";
import { getPublishedExplainerBySlug } from "@/lib/db/articles";

export const dynamicParams = true;
export const revalidate = 60;

export function generateStaticParams() {
  return EXPLICA.map((e) => ({ slug: e.slug }));
}

async function findExplainer(slug: string): Promise<ExplicaItem | undefined> {
  const real = await getPublishedExplainerBySlug(slug);
  if (real) return real;
  const demo = getExplicaBySlug(slug);
  return demo ? { ...demo, isDemo: true } : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await findExplainer(slug);
  return { title: e ? `${e.title} — Vallarta Explica` : "No encontrado" };
}

export default async function ExplicaArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await findExplainer(slug);
  if (!e) notFound();

  const allBlocks: [string, string][] = [
    ["Qué pasó", e.quePaso],
    ["Por qué importa", e.porQueImporta],
    ["Qué sabemos", e.queSabemos],
    ["Qué no sabemos", e.queNoSabemos],
    ["Contexto", e.contexto],
    ["Qué sigue", e.queSigue],
  ];
  const blocks = allBlocks.filter(([, body]) => body.trim().length > 0);

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href="/explica">Vallarta Explica</Link>
      </div>
      <div className="article-head">
        <span className="chip">Vallarta Explica</span>
        {e.isDemo && (
          <span style={{ marginLeft: 6 }}>
            <DemoTag />
          </span>
        )}
        <h1>{e.title}</h1>
        <p className="article-dek">{e.dek}</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{fmtDate(e.publishedAt)}</p>
      </div>
      <div className="card-media" style={{ maxWidth: 780, aspectRatio: "16/9", borderRadius: "var(--radius-md)", marginBottom: 22 }}>
        <Image src={newsImageSrc(e)} alt={e.title} fill sizes="780px" priority unoptimized={!!e.imageUrl} />
        <span className="photo-tag">{e.imageUrl ? `Foto: ${e.imageCredit || "fuente original"}` : "Foto ilustrativa"}</span>
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
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
          {e.isDemo
            ? "Este es un explicador de demostración generado para el MVP."
            : "Redactado con asistencia de IA a partir de las fuentes citadas y revisado por el equipo editorial antes de publicarse."}
        </p>
      </div>
    </div>
  );
}
