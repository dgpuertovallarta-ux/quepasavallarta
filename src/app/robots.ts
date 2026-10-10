import type { MetadataRoute } from "next";

const SITE_URL = (process.env.URL || "https://quepasavta.com").replace(/\/$/, "");

/**
 * Qué pueden leer los buscadores (Google, Bing…). Todo el sitio es
 * público, salvo el panel editorial, las rutas internas y las páginas de
 * resultados de búsqueda, que no aportan nada en un buscador.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/image/"],
      disallow: ["/admin", "/api/", "/buscar", "/pregunta"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
