import { NextResponse, type NextRequest } from "next/server";
import { readFacebookPagePosts, isFacebookReadConfigured } from "@/lib/ingest/fetchFacebookPage";

/**
 * Prueba del lector de Facebook, solo para el panel (protegido con la
 * sesión de /admin en src/proxy.ts): muestra las últimas publicaciones
 * que la API de Meta deja leer de una página.
 *
 * GET /api/facebook-preview?page=ProteccionCivilPV
 *
 * Sirve para dos cosas: comprobar qué responde Meta para cada página
 * (si falta el permiso, el error lo dice) y grabar la demostración que
 * pide la revisión de la app. No guarda ni publica nada.
 */
export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page")?.trim() || "";
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(page)) {
    return NextResponse.json({ error: "Falta ?page= con el nombre o ID de la página (letras, números, punto, guion)." }, { status: 400 });
  }
  if (!isFacebookReadConfigured()) {
    return NextResponse.json({ error: "Falta FB_READ_ACCESS_TOKEN (o FB_PAGE_ACCESS_TOKEN) en Netlify." }, { status: 501 });
  }

  try {
    const posts = await readFacebookPagePosts(page, 10);
    return NextResponse.json({ page, count: posts.length, posts });
  } catch (err) {
    return NextResponse.json({ page, error: err instanceof Error ? err.message : "Error desconocido al leer la página." }, { status: 502 });
  }
}
