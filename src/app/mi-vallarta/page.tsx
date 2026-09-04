import Link from "next/link";
import { ZONES } from "@/lib/data";

export const metadata = { title: "Mi Vallarta — Qué Pasa Vallarta" };

export default function MiVallartaPage() {
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Mi Vallarta
      </div>
      <h1 style={{ margin: "0 0 6px" }}>📍 Mi Vallarta</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 20 }}>
        Elige tu zona para ver noticias, tránsito, seguridad y eventos hiperlocales.
      </p>
      <div className="zone-grid">
        {ZONES.map((z) => (
          <Link key={z.slug} href={`/mi-vallarta/${z.slug}`} className="zone-btn" style={{ textDecoration: "none" }}>
            {z.name}
            <small>Noticias, tránsito y eventos de tu colonia</small>
          </Link>
        ))}
      </div>
    </div>
  );
}
