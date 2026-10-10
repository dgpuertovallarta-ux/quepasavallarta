import Link from "next/link";
import { ZONES, getZoneName } from "@/lib/data";
import { searchPublishedArticles } from "@/lib/db/articles";
import { uniqueIllustrations } from "@/lib/photos";
import { NewsCard, SectionHead } from "@/components/cards";

export const revalidate = 300;

export function generateStaticParams() {
  return ZONES.map((z) => ({ zone: z.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  return { title: `${getZoneName(zone)} — Mi Vallarta` };
}

export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  // Notas reales que mencionan la colonia o zona por su nombre.
  const zoneItems = uniqueIllustrations(await searchPublishedArticles(getZoneName(zone), 12, { phrase: true }));

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Mi Vallarta
      </div>
      <h1 style={{ margin: "0 0 6px" }}>Mi Vallarta</h1>
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
            Todavía no hay notas recientes que mencionen esta zona. Cuando publiquemos alguna, aparecerá aquí.
          </div>
        )}
      </div>
    </div>
  );
}
