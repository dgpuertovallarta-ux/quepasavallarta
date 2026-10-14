import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/business/db";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|lighthouse|headless|monitor/i;

/**
 * Cuenta una visita (privado: solo se ve en el panel). Lo llama
 * PageTracker desde el navegador en cada cambio de página.
 */
export async function POST(request: Request) {
  if (BOT.test(request.headers.get("user-agent") || "")) return new NextResponse(null, { status: 204 });
  let body: { path?: unknown; vid?: unknown } = {};
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const path = typeof body.path === "string" ? body.path : "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) {
    return new NextResponse(null, { status: 204 });
  }
  const vid = typeof body.vid === "string" && /^[a-z0-9]{8,40}$/i.test(body.vid) ? body.vid : null;
  try {
    await recordPageView(path.split("?")[0].split("#")[0], vid);
  } catch (err) {
    console.error("[track]", err instanceof Error ? err.message : err);
  }
  return new NextResponse(null, { status: 204 });
}
