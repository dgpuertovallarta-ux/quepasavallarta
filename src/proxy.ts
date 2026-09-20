import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, ADMIN_SESSION_COOKIE } from "@/lib/auth/session";

// Protege el panel editorial (/admin) y las acciones que redactan o
// publican contenido (/api/generate-article, /api/publish-article) con
// una sesión real firmada — ver src/lib/auth/session.ts. /admin/login
// se deja pasar sin sesión (es la página para conseguirla).
// /api/ingest NO se protege aquí: lo dispara el cron de Netlify
// (netlify/functions/scheduled-ingest.ts) server a server, sin usuario.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const session = verifySessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/generate-article", "/api/publish-article"],
};
