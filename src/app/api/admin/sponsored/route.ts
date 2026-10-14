import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth/currentAdmin";
import { setSponsored } from "@/lib/business/db";

/** Marca o desmarca una nota como "Patrocinado". Acepta la dirección completa de la nota o su slug. */
export async function POST(request: Request) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Sesión de administrador inválida." }, { status: 401 });
  let body: { note?: unknown; sponsor?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const raw = typeof body.note === "string" ? body.note.trim() : "";
  const match = raw.match(/\/noticia\/([^/?#\s]+)/);
  const slug = (match ? match[1] : raw).replace(/[^a-z0-9-]/gi, "");
  const sponsor = typeof body.sponsor === "string" ? body.sponsor.trim() : "";
  if (!slug) return NextResponse.json({ error: "Pega la dirección de la nota." }, { status: 400 });
  try {
    await setSponsored(slug, sponsor || null);
    return NextResponse.json({ ok: true, slug, sponsored: !!sponsor });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
