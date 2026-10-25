import Link from "next/link";
import PresentadoPor from "@/components/PresentadoPor";
import DenunciaForm from "@/components/DenunciaForm";
import { NewsCard } from "@/components/cards";
import { getDenuncias } from "@/lib/db/articles";

export const metadata = {
  title: "Reporte Ciudadano — Qué Pasa Vallarta",
  description:
    "Manda tu reporte con foto y ubicación: baches, basura, falta de agua o luz, tráfico, inseguridad o abusos en la vía pública. Lo revisamos y lo publicamos en el sitio y en Facebook.",
};
export const revalidate = 120;

export default async function ReportePage() {
  const reportes = await getDenuncias(8).catch(() => []);
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Reporte Ciudadano
      </div>
      <span className="chip chip-breaking">Reporte ciudadano</span>
      <h1 style={{ margin: "8px 0 6px" }}>¿Viste algo en tu colonia? Repórtalo</h1>
      <PresentadoPor seccion="reportes" />
      <p style={{ color: "var(--text-muted)", maxWidth: 680, marginBottom: 20 }}>
        Baches, basura, fugas, falta de luz, tráfico, inseguridad o abusos en la vía pública. Mándanos tu reporte con foto: nuestro
        equipo lo revisa y lo publicamos en el sitio y en Facebook para que llegue a las autoridades.
      </p>
      <div className="reporte-pasos">
        <div><b>1</b>Toma una foto y escribe dónde y qué pasa.</div>
        <div><b>2</b>Nuestro equipo lo revisa (tus datos nunca se publican).</div>
        <div><b>3</b>Sale en quepasavta.com y en nuestro Facebook.</div>
      </div>
      <div className="denuncia-grid">
        <DenunciaForm />
        <aside>
          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Reportes recientes</h2>
          {reportes.length === 0 && <p style={{ color: "var(--text-muted)" }}>Todavía no hay reportes publicados. El tuyo puede ser el primero.</p>}
          <div className="grid" style={{ gap: 20 }}>
            {reportes.map((n) => (
              <NewsCard n={n} key={n.slug} compact />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
