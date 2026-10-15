import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/credentials";
import { createSessionToken, ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

export async function POST(request: Request) {
  let username: string | undefined;
  let password: string | undefined;
  try {
    const body = await request.json();
    username = body?.username;
    password = body?.password;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const admin = username && password ? authenticateAdmin(username, password) : null;
  if (!admin) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  let token: string;
  try {
    token = createSessionToken(admin.username);
  } catch (err) {
    console.error("[admin-login]", err);
    return NextResponse.json({ error: "El panel no está configurado (falta ADMIN_SESSION_SECRET en Netlify)." }, { status: 500 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
