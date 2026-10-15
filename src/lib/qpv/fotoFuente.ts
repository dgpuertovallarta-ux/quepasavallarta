/**
 * Foto REAL de la nota, tomada de la fuente original (2026-10).
 *
 * El sitio ya no usa imágenes de IA ni fotos ilustrativas que no tienen que
 * ver con el tema. La foto de una nota sale de su fuente:
 *   - Fuente oficial (gobierno, Protección Civil, Fiscalía…): crédito a la
 *     institución.
 *   - Medio de comunicación: crédito al medio y enlace a la nota original,
 *     sin alterar la foto (Ley Federal del Derecho de Autor, art. 148 fr. II:
 *     se permite reproducir fotos de actualidad publicadas por la prensa
 *     citando la fuente, salvo que el titular lo prohíba expresamente).
 *     Los medios que lo prohíban van en QPV_MEDIOS_SIN_FOTO (dominios
 *     separados por coma). QPV_FOTO_DE_MEDIOS=0 apaga las fotos de medios.
 *
 * Esto es solo para el SITIO. En Facebook/Instagram sale la tarjeta de
 * color QPV (ver tarjetas.tsx), que solo lleva foto si es oficial.
 */
import { extractOgImage } from "../ingest/extractImage";
import { imagenComoDataUri } from "./tarjetas";
import { creditoOficial } from "./oficiales";
import { saveImageBlob } from "../storage/imageBlobs";

export type FotoFuente = { url: string; credito: string; urlOriginal: string; oficial: boolean };

const NO_ES_FOTO = /logo|favicon|default|placeholder|no-?image|sin-?imagen|share[-_]?image|og[-_]?default|avatar|icon/i;
const MIN_BYTES = 20_000; // menos que esto suele ser un logo o un ícono

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function medioBloqueado(url: string): boolean {
  const d = dominio(url);
  return (process.env.QPV_MEDIOS_SIN_FOTO || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((b) => d === b || d.endsWith("." + b));
}

/** Busca la foto principal de la nota original y la guarda en el sitio. Nunca lanza. */
export async function fotoDeFuente(sourceUrl?: string | null, sourceName?: string | null): Promise<FotoFuente | null> {
  if (!sourceUrl) return null;
  try {
    const oficial = creditoOficial(sourceUrl);
    // Fotos de otros medios: APAGADAS por omisión (2026-10: se veía que copiábamos
    // a Noticias PV). Solo se usan si QPV_FOTO_DE_MEDIOS=1.
    if (!oficial && (process.env.QPV_FOTO_DE_MEDIOS !== "1" || medioBloqueado(sourceUrl))) return null;

    const og = await extractOgImage(sourceUrl);
    if (!og || NO_ES_FOTO.test(og.url)) return null;

    const dataUri = await imagenComoDataUri(og.url);
    if (!dataUri) return null;
    const [meta, b64] = dataUri.split(",");
    const bytes = Buffer.from(b64, "base64");
    if (bytes.byteLength < MIN_BYTES) return null;

    const { url } = await saveImageBlob(bytes, meta.slice(5, meta.indexOf(";")));
    return {
      url,
      credito: oficial ?? (sourceName?.trim() || dominio(sourceUrl)),
      urlOriginal: og.url,
      oficial: !!oficial,
    };
  } catch (err) {
    console.error("[fotoDeFuente]", sourceUrl, err instanceof Error ? err.message : err);
    return null;
  }
}
