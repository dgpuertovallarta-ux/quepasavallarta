import { NextResponse } from "next/server";
import { readImageBlob } from "@/lib/storage/imageBlobs";

/**
 * Sirve las imágenes generadas por IA (ver generateImage.ts +
 * imageBlobs.ts). Es lo que hace que `imageUrl` en los artículos sea una
 * URL pública real de nuestro propio dominio — necesario para que
 * Instagram/Facebook puedan descargarla al publicar automáticamente
 * (ver lib/social/).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const blob = await readImageBlob(key);
  if (!blob) {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  }
  return new NextResponse(blob.data, {
    status: 200,
    headers: {
      "Content-Type": blob.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
