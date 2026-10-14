import { NextResponse } from "next/server";
import { registerAdClick } from "@/lib/business/db";

/** Clic en un banner: se cuenta (para el reporte del anunciante) y se manda a su sitio. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  let target: string | null = null;
  if (Number.isInteger(n) && n > 0) {
    try {
      target = await registerAdClick(n);
    } catch (err) {
      console.error("[ad-click]", err instanceof Error ? err.message : err);
    }
  }
  const safe = target && /^https?:\/\//i.test(target) ? target : new URL("/", request.url).toString();
  return NextResponse.redirect(safe, 302);
}
