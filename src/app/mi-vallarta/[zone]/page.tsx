import Link from "next/link";
import { ZONES, NEWS, getZoneName } from "@/lib/data";
import { NewsCard, SectionHead } from "@/components/cards";

export function generateStaticParams() {
  return ZONES.map((z) => ({ zone: z.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  return { title: `${getZoneName(zone)} — Mi Vallarta` };
}

export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  const zoneItems = NEWS.filter((n) => n.zone === zone);

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
          <Link
            key={z.slug}
            href={`/mi-vallarta/${z.slug}`}
            className={`zone-btn${z.slug === zone ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {z.name}
            <small>Noticias, tránsito y eventos de tu colonia</small>
          </Link>
        ))}
      </div>

      <div className="section" style={{ paddingBottom: 0 }}>
        <SectionHead title={getZoneName(zone)} />
        {zoneItems.length ? (
          <div className="grid grid-3">
            {zoneItems.map((n) => (
              <NewsCard n={n} key={n.slug} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            Sin noticias demo asignadas a esta zona todavía. En producción, esta vista se llena
            automáticamente al etiquetar noticias con esta ubicación.
          </div>
        )}
      </div>
    </div>
  );
}
