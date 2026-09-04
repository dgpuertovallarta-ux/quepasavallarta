import Link from "next/link";
import { NEWS } from "@/lib/data";
import { NewsListItem, SectionHead, DemoTag } from "@/components/cards";
import AhoraStrip from "@/components/AhoraStrip";

export const metadata = { title: "Vallarta Ahora — Qué Pasa Vallarta" };

export default function AhoraPage() {
  const latest = [...NEWS].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6);
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Vallarta Ahora
      </div>
      <h1 style={{ margin: "0 0 6px" }}>🟠 Vallarta Ahora</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 20 }}>
        Dashboard en tiempo real de la ciudad: clima, tránsito, playas, aeropuerto y más. <DemoTag /> Los
        valores mostrados son marcadores de posición — cuando se conecten las fuentes reales (ver{" "}
        <Link href="/admin">panel editorial</Link> y <code>/docs/ARCHITECTURE.md</code>), se sustituyen
        automáticamente por datos en vivo.
      </p>
      <AhoraStrip />

      <div className="section" style={{ paddingBottom: 0 }}>
        <SectionHead title="Última actualización de noticias" sub="Ordenado por más reciente" />
        <div className="panel">
          {latest.map((n) => (
            <NewsListItem n={n} key={n.slug} />
          ))}
        </div>
      </div>
    </div>
  );
}
