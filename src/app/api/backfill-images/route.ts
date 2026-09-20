import { NextResponse } from "next/server";
import { runImageBackfill } from "@/lib/ingest/backfillImages";

export const maxDuration = 60;

/**
 * Regenera con IA la imagen de artículos ya publicados que todavía tienen
 * la foto ilustrativa repetida por categoría (ver backfillImages.ts).
 *
 * Uso: entra a esta URL en el navegador (GET /api/backfill-images) y
 * vuelve a recargar la página varias veces seguidas — cada visita procesa
 * hasta 6 artículos. Cuando la respuesta diga "remaining": false, ya se
 * terminó con todos.
 */
export async function GET() {
  try {
    const result = await runImageBackfill();
    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    console.error("[api/backfill-images] Error no manejado:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido en /api/backfill-images." },
      { status: 500 }
    );
  }
}
