import { NextResponse } from "next/server";
import { getPatrocinio, type SeccionPatrocinio } from "@/lib/business/patrocinios";

/** Patrocinador vigente de una sección (lo usa el generador de videos de huracán). */
export const dynamic = "force-dynamic";
const SECCIONES: SeccionPatrocinio[] = ["trafico", "huracanes", "clima", "reportes"];

export async function GET(request: Request) {
  const s = new URL(request.url).searchParams.get("seccion") as SeccionPatrocinio;
  if (!SECCIONES.includes(s)) return NextResponse.json({ error: "sección inválida" }, { status: 400 });
  const p = await getPatrocinio(s);
  return NextResponse.json(p ? { nombre: p.nombre, logo: p.logo } : null);
}
