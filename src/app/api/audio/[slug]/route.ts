import { NextResponse } from "next/server";
import { leerAudio, generarAudio, textoParaLeer, existeAudio } from "@/lib/qpv/voz";
import { getPublishedArticleBySlug } from "@/lib/db/articles";

export const maxDuration = 60;

/** GET: el MP3 de la nota (404 si todavía no tiene). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const audio = await leerAudio(slug);
  if (!audio) return NextResponse.json({ error: "Sin audio" }, { status: 404 });
  return new NextResponse(audio, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400", "Content-Length": String(audio.byteLength) },
  });
}

/** POST: genera (o rehace con ?rehacer=1) el audio de una nota. Solo con la clave interna. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const clave = process.env.QPV_TOKEN_INTERNO;
  if (!clave || req.headers.get("x-qpv-token") !== clave) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { slug } = await params;
  const n = await getPublishedArticleBySlug(slug);
  if (!n) return NextResponse.json({ error: "Nota no encontrada." }, { status: 404 });
  const rehacer = new URL(req.url).searchParams.get("rehacer") === "1";
  const resultado = await generarAudio(slug, textoParaLeer(n.title, n.dek, n.body), { reemplazar: rehacer });
  return NextResponse.json({ resultado, url: `/api/audio/${slug}` });
}

/** HEAD: ¿la nota ya tiene audio? (lo usa el botón "Escuchar nota"). */
export async function HEAD(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return new NextResponse(null, { status: (await existeAudio(slug)) ? 200 : 404 });
}
