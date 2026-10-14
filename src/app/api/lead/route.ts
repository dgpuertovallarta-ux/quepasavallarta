import { NextResponse } from "next/server";
import { saveLead } from "@/lib/business/db";

/** Solicitud de un negocio desde Anúnciate / Vallarta Conecta. Se ve en el panel → Comercial. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  // Campo trampa: las personas no lo ven; los robots lo llenan.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const business = typeof body.business === "string" ? body.business.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const page = typeof body.page === "string" ? body.page : "";
  if (business.length < 2 || contact.length < 6) {
    return NextResponse.json({ error: "Escribe el nombre del negocio y un WhatsApp o correo." }, { status: 400 });
  }
  try {
    const saved = await saveLead({ business, contact, message, page });
    if (!saved) return NextResponse.json({ error: "No pudimos guardar tu solicitud. Intenta más tarde." }, { status: 503 });
  } catch (err) {
    console.error("[lead]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No pudimos guardar tu solicitud. Intenta más tarde." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
