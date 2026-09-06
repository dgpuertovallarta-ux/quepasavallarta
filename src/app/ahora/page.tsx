import Link from "next/link";
import { NEWS } from "@/lib/data";
import { SectionHead, DemoTag } from "@/components/cards";
import AhoraStrip from "@/components/AhoraStrip";
import CategoryTabs from "@/components/CategoryTabs";
import { getPublishedArticles } from "@/lib/db/articles";

export const metadata = { title: "Vallarta Ahora — Qué Pasa Vallarta" };
export const revalidate = 60;

export default async function AhoraPage() {
  const real = await getPublishedArticles(30);
  const demo = NEWS.map((n) => ({ ...n, isDemo: true }));
  const latest = (real.length > 0 ? real : demo).sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );

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
          <CategoryTabs items={latest} />
        </div>
      </div>
    </div>
  );
}
