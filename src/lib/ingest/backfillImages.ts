import { getArticlesNeedingRealPhoto, setArticleRealPhoto } from "../db/articles";
import { isDatabaseConfigured } from "../db/client";
import { fotoDeFuente } from "../qpv/fotoFuente";
import { fotoDeArchivo } from "../qpv/fotoArchivo";

/**
 * Cambia la imagen de las notas YA publicadas por la foto REAL de su fuente
 * (2026-10): las que tenían imagen de IA y las que no tenían ninguna.
 * Si la fuente no tiene foto utilizable, la nota queda con la pleca de color
 * de su sección y no se vuelve a intentar.
 *
 * Corre solo en cada /api/ingest (pocas por corrida) y también a mano en
 * GET /api/backfill-images (repetir hasta que "remaining" salga en false).
 */
const MAX_POR_CORRIDA = 10;

export type BackfillResult = {
  attempted: number;
  updated: number;
  sinFoto: number;
  errors: { slug: string; error: string }[];
  remaining: boolean;
};

export async function runImageBackfill(max = MAX_POR_CORRIDA): Promise<BackfillResult> {
  const result: BackfillResult = { attempted: 0, updated: 0, sinFoto: 0, errors: [], remaining: false };
  if (!isDatabaseConfigured()) return result;

  const candidates = await getArticlesNeedingRealPhoto(max + 1);
  result.remaining = candidates.length > max;

  // En paralelo: cada búsqueda tarda hasta ~16 s (página + foto), así el lote cabe en la corrida.
  await Promise.all(
    candidates.slice(0, max).map(async (a) => {
      result.attempted++;
      try {
        const foto = await fotoDeFuente(a.sourceUrl, a.sourceName); // oficial o medio (con crédito)
        const archivo = foto ? null : fotoDeArchivo(a.title, a.excerpt, a.slug);
        await setArticleRealPhoto(
          a.slug,
          foto
            ? { imageUrl: foto.url, imageCredit: foto.credito, imageSourceUrl: foto.urlOriginal }
            : archivo
              ? { imageUrl: archivo.url, imageCredit: archivo.credito, imageSourceUrl: "archivo-v2", licencia: "illustrative_fallback" }
              : null
        );
        if (foto || archivo) result.updated++;
        else result.sinFoto++;
      } catch (err) {
        result.errors.push({ slug: a.slug, error: err instanceof Error ? err.message : "Error desconocido" });
      }
    })
  );
  return result;
}
