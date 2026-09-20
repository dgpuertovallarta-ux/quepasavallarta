import { NextResponse } from "next/server";
import { checkCredentials } from "@/lib/auth/credentials";
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

  if (!username || !password || !checkCredentials(username, password)) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
