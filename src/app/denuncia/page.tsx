import Link from "next/link";
import DenunciaForm from "@/components/DenunciaForm";
import { NewsCard } from "@/components/cards";
import { getDenuncias } from "@/lib/db/articles";

export const metadata = {
  title: "Denuncia Ciudadana — Qué Pasa Vallarta",
  description: "Envía tu denuncia con foto y ubicación: baches, basura, tráfico, abusos en la vía pública. La revisamos y la publicamos para que las autoridades la atiendan.",
};
export const revalidate = 120;

export default async function DenunciaPage() {
  const denuncias = await getDenuncias(8).catch(() => []);
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Denuncia Ciudadana
      </div>
      <span className="chip chip-breaking">Denuncia ciudadana</span>
      <h1 style={{ margin: "8px 0 6px" }}>¿Qué está pasando en tu colonia?</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 680, marginBottom: 24 }}>
        Mándanos tu denuncia con foto y ubicación: tráfico, baches, basura, falta de servicios o abusos en la vía pública. La revisamos y la publicamos en el sitio y en nuestras redes para que llegue a las autoridades.
      </p>
      <div className="denuncia-grid">
        <DenunciaForm />
        <aside>
          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Denuncias recientes</h2>
          {denuncias.length === 0 && <p style={{ color: "var(--text-muted)" }}>Todavía no hay denuncias publicadas. La tuya puede ser la primera.</p>}
          <div className="grid" style={{ gap: 20 }}>
            {denuncias.map((n) => (
              <NewsCard n={n} key={n.slug} compact />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
