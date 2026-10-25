import type { MetadataRoute } from "next";
import { CATEGORIES, ZONES } from "@/lib/data";
import { EVENTS } from "@/lib/events";
import { getSitemapEntries, getActiveCategorySlugs } from "@/lib/db/articles";

// El mapa del sitio se vuelve a armar cada hora con las notas nuevas.
export const revalidate = 3600;

const SITE_URL = (process.env.URL || "https://quepasavta.com").replace(/\/$/, "");

/**
 * Mapa del sitio para buscadores: portada, secciones con contenido,
 * todas las notas y explicadores publicados, y la agenda. No incluye la
 * Guía (todavía con negocios de ejemplo), el panel ni las búsquedas.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, activeCategories] = await Promise.all([getSitemapEntries(), getActiveCategorySlugs()]);
  const now = new Date();
  const latest = entries[0]?.lastModified || now.toISOString();

  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: latest, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/categoria/ultima-hora`, lastModified: latest, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/proteccion-civil`, lastModified: latest, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/reporte`, lastModified: latest, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/alertas`, lastModified: latest, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/ahora`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/explica`, lastModified: latest, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/agenda`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/mi-vallarta`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categories: MetadataRoute.Sitemap = CATEGORIES.filter((c) => activeCategories.includes(c.slug)).map((c) => ({
    url: `${SITE_URL}/categoria/${c.slug}`,
    lastModified: latest,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const zones: MetadataRoute.Sitemap = ZONES.map((z) => ({
    url: `${SITE_URL}/mi-vallarta/${z.slug}`,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  const events: MetadataRoute.Sitemap = EVENTS.map((e) => ({
    url: `${SITE_URL}/agenda/${e.slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const articles: MetadataRoute.Sitemap = entries.map((a) => ({
    url: `${SITE_URL}/${a.isExplainer ? "explica" : "noticia"}/${a.slug}`,
    lastModified: a.lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...fixed, ...categories, ...zones, ...events, ...articles];
}
