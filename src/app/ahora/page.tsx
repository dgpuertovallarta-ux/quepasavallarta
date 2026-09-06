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
        Dashboard en tiempo real de la ciudad. Clima y calidad del aire ya son datos reales (Open-Meteo,
        sin costo). Tránsito, playas/oleaje, aeropuerto y cruceros siguen en <DemoTag /> porque requieren
        una API de pago o con registro (Google Maps, AviationStack, etc.) que el propietario tendría que
        contratar — ver <code>/docs/ARCHITECTURE.md</code>.
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
