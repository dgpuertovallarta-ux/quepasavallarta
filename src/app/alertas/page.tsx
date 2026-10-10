import Link from "next/link";
import { NewsListItem } from "@/components/cards";
import { getPublishedArticles } from "@/lib/db/articles";

export const metadata = { title: "Alertas — Qué Pasa Vallarta" };
export const revalidate = 60;

export default async function AlertasPage() {
  // Lo más importante de los últimos días: las notas con mayor puntaje editorial.
  const recent = await getPublishedArticles(60);
  const urgent = recent.filter((n) => n.score >= 80).slice(0, 15);
  const items = urgent.length > 0 ? urgent : recent.slice(0, 10);

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Alertas
      </div>
      <h1 style={{ margin: "0 0 6px" }}>Alertas</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 20 }}>
        Lo más importante que está pasando en Puerto Vallarta y la bahía: avisos, emergencias y noticias
        de mayor impacto, de lo más reciente a lo más antiguo.
      </p>
      {items.length ? (
        <div className="panel">
          {items.map((n) => (
            <NewsListItem n={n} key={n.slug} />
          ))}
        </div>
      ) : (
        <div className="empty-state">No hay alertas por ahora.</div>
      )}
    </div>
  );
}
