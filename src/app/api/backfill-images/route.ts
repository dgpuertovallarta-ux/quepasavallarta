import { NextResponse } from "next/server";
import { runImageBackfill } from "@/lib/ingest/backfillImages";

export const maxDuration = 60;

/**
 * Pone la foto REAL de su fuente a las notas ya publicadas que tenían
 * imagen de IA o ninguna (ver backfillImages.ts). También corre solo en
 * cada /api/ingest.
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
