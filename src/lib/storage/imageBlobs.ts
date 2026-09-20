import { getStore } from "@netlify/blobs";

/**
 * Almacén de imágenes generadas por IA (ver generateImage.ts). Se guardan
 * en Netlify Blobs en vez de como data URL incrustado en cada artículo
 * porque:
 *  1) Instagram/Facebook exigen una URL pública real para publicar — no
 *     aceptan imágenes incrustadas en base64.
 *  2) Evita inflar cada fila de la base de datos y cada página HTML con
 *     ~200-500 KB de base64 por artículo.
 *
 * No requiere configuración manual — Netlify inyecta las credenciales del
 * blob store automáticamente en el entorno de build/funciones.
 */
const STORE_NAME = "article-images";

export function siteUrl(): string {
  return (process.env.URL || process.env.DEPLOY_URL || "https://quepasavallarta.netlify.app").replace(/\/$/, "");
}

export async function saveImageBlob(bytes: Buffer, contentType: string): Promise<{ key: string; url: string }> {
  const store = getStore(STORE_NAME);
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const key = `${crypto.randomUUID()}.${extension}`;
  // @netlify/blobs solo acepta ArrayBuffer (no el Buffer de Node directamente).
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await store.set(key, arrayBuffer, { metadata: { contentType } });
  return { key, url: `${siteUrl()}/api/image/${key}` };
}

export async function readImageBlob(key: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const store = getStore(STORE_NAME);
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return null;
  const contentType = (result.metadata?.contentType as string) || "image/png";
  return { data: result.data, contentType };
}
