import { NextResponse } from "next/server";
import { verifyGithubOidc } from "@/lib/hurricane/githubOidc";
import { assemble, getVideo, publishToFacebook, savePart, validKey } from "@/lib/hurricane/videos";

/**
 * Recepción de los videos automáticos de ciclón (GitHub Actions →
 * .github/workflows/hurricane-video.yml).
 *
 *   GET  ?key=ep212026-018            → ¿ya existe / ya se publicó?
 *   POST ?key=…&part=N  (cuerpo MP4)  → guarda una parte (≤ 2 MB)
 *   POST ?key=…&action=publish  JSON  → une partes, guarda y publica en Facebook
 *
 * Los POST solo se aceptan con el token OIDC de GitHub de este repositorio.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 26;

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!validKey(key)) return NextResponse.json({ error: "key inválida" }, { status: 400 });
  const row = await getVideo(key).catch(() => null);
  return NextResponse.json({ key, exists: !!row, status: row?.status ?? null, published: row?.status === "published" });
}

export async function POST(request: Request) {
  const auth = await verifyGithubOidc(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!validKey(key)) return NextResponse.json({ error: "key inválida" }, { status: 400 });

  try {
    if (url.searchParams.get("action") === "publish") {
      const body = (await request.json()) as { parts?: number; caption?: string; title?: string };
      const parts = Number(body.parts);
      if (!Number.isInteger(parts) || parts < 1 || parts > 20) return NextResponse.json({ error: "parts inválido" }, { status: 400 });
      const existing = await getVideo(key);
      const videoUrl = existing?.videoUrl || (await assemble(key, parts, String(body.caption || ""), String(body.title || "")));
      const fb = await publishToFacebook(key);
      return NextResponse.json({ ok: true, videoUrl, facebook: fb });
    }
    const part = Number(url.searchParams.get("part"));
    if (!Number.isInteger(part) || part < 0 || part > 19) return NextResponse.json({ error: "part inválido" }, { status: 400 });
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 2.5 * 1024 * 1024) return NextResponse.json({ error: "tamaño de parte inválido" }, { status: 400 });
    await savePart(key, part, bytes);
    return NextResponse.json({ ok: true, part, bytes: bytes.byteLength });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
