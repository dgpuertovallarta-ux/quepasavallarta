import * as cheerio from "cheerio";

export type ExtractedImage = { url: string; sourceUrl: string };

/**
 * Extrae la fotografía real del artículo original (og:image / twitter:image
 * del <head> de la página) para usarla en nuestro sitio.
 *
 * ADVERTENCIA — decisión explícita del propietario (2026-09): esa
 * fotografía es propiedad del medio que la publicó. Usarla sin permiso
 * explícito es un riesgo real de derechos de autor (no solo teórico) —
 * el propietario del sitio aceptó ese riesgo conscientemente después de
 * que se le explicó. Ver /docs/N8N_AUTOMATION.md → "Imágenes: siempre
 * desde la fuente original" para el detalle completo de la advertencia
 * legal y quién puede pedir que se retire una imagen.
 *
 * Si la extracción falla (bloqueo del sitio, sin og:image, timeout), la
 * función devuelve null — el llamador debe caer de vuelta al banco de
 * fotos ilustrativas (nunca inventar ni dejar el artículo sin imagen).
 */
export async function extractOgImage(articleUrl: string): Promise<ExtractedImage | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QuePasaVallartaBot/1.0; +https://quepasavallarta.netlify.app)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:secure_url"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (!ogImage) return null;

    const resolvedUrl = new URL(ogImage, articleUrl).toString();
    return { url: resolvedUrl, sourceUrl: articleUrl };
  } catch (err) {
    // No rompe el flujo de publicación (cae al banco ilustrativo), pero
    // queda en los logs — un catch silencioso aquí escondería bugs reales
    // (p. ej. ya pasó: un header no-ASCII hacía fallar TODA extracción).
    console.error(`[extractOgImage] Falló para ${articleUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
