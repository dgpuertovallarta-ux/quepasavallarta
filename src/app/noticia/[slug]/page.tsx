import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { NEWS, getNewsBySlug, getCategoryName, type NewsItem } from "@/lib/data";
import { NewsListItem, SectionHead, Byline } from "@/components/cards";
import { PHOTOS } from "@/lib/photos";
import { fmtDateTime } from "@/lib/format";

const SENSITIVE_CATEGORIES = ["seguridad", "politica"];

export function generateStaticParams() {
  return NEWS.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = getNewsBySlug(slug);
  return { title: n ? `${n.title} — Qué Pasa Vallarta` : "Noticia no encontrada" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = getNewsBySlug(slug);
  if (!n) notFound();

  const related = NEWS.filter((x) => x.category === n.category && x.slug !== n.slug).slice(0, 4);
  const showHechos = SENSITIVE_CATEGORIES.includes(n.category);

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / <Link href={`/categoria/${n.category}`}>{getCategoryName(n.category)}</Link>
      </div>
      <div className="article-head">
        {n.breaking ? (
          <span className="chip chip-breaking">Última hora</span>
        ) : (
          <span className="chip">{getCategoryName(n.category)}</span>
        )}
        {n.verified ? (
          <span className="chip chip-verified" style={{ marginLeft: 6 }}>
            Verificado
          </span>
        ) : (
          <span className="chip chip-demo" style={{ marginLeft: 6 }}>
            Sin confirmación oficial
          </span>
        )}
        <h1>{n.title}</h1>
        <p className="article-dek">{n.dek}</p>
        <Byline n={n} />
      </div>

      <div className="card-media" style={{ maxWidth: 780, aspectRatio: "16/9", borderRadius: "var(--radius-md)", marginBottom: 22 }}>
        <Image src={PHOTOS[n.image]} alt={n.title} fill sizes="780px" priority />
        <span className="photo-tag">Foto ilustrativa</span>
      </div>

      <article className="prose">
        {n.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      {showHechos && <Hechos n={n} />}

      <div className="panel" style={{ maxWidth: 780, marginTop: 24 }}>
        <strong style={{ fontSize: 13 }}>Fuentes</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, color: "var(--text-muted)" }}>
          {n.sources.map((s) => (
            <li key={s.label}>
              <a href={s.url}>{s.label}</a>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
          Última actualización: {fmtDateTime(n.updatedAt)} · Este es un artículo de demostración generado
          para el MVP.
        </p>
      </div>

      <div className="section" style={{ paddingBottom: 0, maxWidth: 900 }}>
        <SectionHead title="Relacionadas" />
        <div className="panel">
          {related.length ? (
            related.map((r) => <NewsListItem n={r} key={r.slug} />)
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Sin artículos relacionados en la demo.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Hechos({ n }: { n: NewsItem }) {
  return (
    <div className="panel" style={{ maxWidth: 780, marginTop: 20 }}>
      <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        Los hechos, separados de las versiones
      </strong>
      <div className="hechos-row">
        <span className="hechos-dot dot-green" />
        <div>
          <strong>🟢 Los hechos:</strong> {n.body[0]}
        </div>
      </div>
      <div className="hechos-row">
        <span className="hechos-dot dot-blue" />
        <div>
          <strong>🔵 Lo que dicen las autoridades:</strong> Declaraciones oficiales citadas en fuentes,
          cuando existan comunicados formales.
        </div>
      </div>
      <div className="hechos-row">
        <span className="hechos-dot dot-purple" />
        <div>
          <strong>🟣 Otras versiones:</strong> Se incluirán aquí cuando existan versiones alternas
          verificables.
        </div>
      </div>
      <div className="hechos-row">
        <span className="hechos-dot dot-yellow" />
        <div>
          <strong>🟡 Contexto:</strong> Antecedentes relevantes para entender la historia completa.
        </div>
      </div>
      <div className="hechos-row">
        <span className="hechos-dot dot-red" />
        <div>
          <strong>🔴 Lo que todavía no sabemos:</strong> Información pendiente de confirmación oficial.
        </div>
      </div>
    </div>
  );
}
