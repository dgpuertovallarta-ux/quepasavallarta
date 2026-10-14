import { NextResponse } from "next/server";
import { correrMonitor, ultimaInstantanea } from "@/lib/trafico/monitor";

export const maxDuration = 60;

/** GET: última medición de tráfico (pública, la usa /trafico). */
export async function GET() {
  const s = await ultimaInstantanea();
  return NextResponse.json(s ?? { actualizado: null, corredores: [], incidentes: [] }, { headers: { "Cache-Control": "public, max-age=60" } });
}

/** POST: corre el monitor. Solo con la clave interna (la manda netlify/functions/monitor-trafico.ts). */
export async function POST(request: Request) {
  const clave = process.env.QPV_TOKEN_INTERNO;
  if (!clave || request.headers.get("x-qpv-token") !== clave) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    return NextResponse.json({ resultado: await correrMonitor() });
  } catch (err) {
    console.error("[api/trafico]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error en el monitor." }, { status: 500 });
  }
}
