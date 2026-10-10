/**
 * Cargador de imágenes del sitio (next.config.ts → images.loaderFile).
 *
 * Las fotos ilustrativas vienen de Wikimedia Commons, que ya sirve cada
 * foto en varios anchos fijos. En vez de pasar por el optimizador de
 * imágenes del servidor (que tenía que descargar cada foto de Wikimedia
 * la primera vez — lento, y a veces fallaba dejando el hueco vacío), el
 * navegador pide directo a Wikimedia el ancho que necesita.
 *
 * Cualquier otra imagen (las generadas con IA en /api/image, logos,
 * banners) se devuelve tal cual.
 */
const WIKIMEDIA_WIDTHS = [330, 500, 960, 1280];
const WIKIMEDIA_THUMB = /^(https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)\d+px-([^/]+)$/;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const match = src.match(WIKIMEDIA_THUMB);
  if (!match) return src;
  const best = WIKIMEDIA_WIDTHS.find((w) => w >= width) || WIKIMEDIA_WIDTHS[WIKIMEDIA_WIDTHS.length - 1];
  return `${match[1]}${best}px-${match[2]}`;
}
