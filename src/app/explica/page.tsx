import Link from "next/link";
import Image from "next/image";
import { EXPLICA } from "@/lib/data";
import { DemoTag } from "@/components/cards";
import { newsImageSrc } from "@/lib/photos";
import { fmtDate } from "@/lib/format";
import { getPublishedExplainers } from "@/lib/db/articles";

export const metadata = { title: "Vallarta Explica — Qué Pasa Vallarta" };
export const revalidate = 60;

export default async function ExplicaIndexPage() {
  const real = await getPublishedExplainers(20);
  const demo = EXPLICA.map((e) => ({ ...e, isDemo: true }));
  const items = real.length > 0 ? real : demo;

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Vallarta Explica
      </div>
      <h1 style={{ margin: "0 0 6px" }}>🧠 Vallarta Explica {items === demo && <DemoTag />}</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 20 }}>
        Para temas complejos: qué pasó, por qué importa, qué sabemos, qué no sabemos y qué sigue.
      </p>
      <div className="grid grid-2">
        {items.map((e) => (
          <Link key={e.slug} href={`/explica/${e.slug}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card-media">
              <Image src={newsImageSrc(e)} alt={e.title} fill sizes="(max-width: 720px) 100vw, 50vw" unoptimized={!!e.imageUrl} />
              <span className="chip" style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                {e.isDemo ? <DemoTag /> : "Explica"}
              </span>
            </div>
            <div className="card-body">
              <span className="card-kicker">{fmtDate(e.publishedAt)}</span>
              <h2 className="card-title" style={{ margin: "4px 0" }}>
                {e.title}
              </h2>
              <p className="card-dek">{e.dek}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
