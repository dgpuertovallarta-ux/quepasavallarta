import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/ingest/sources";
import { fetchSource } from "@/lib/ingest/fetchSource";
import { buildStoryGraph } from "@/lib/ingest/storyGraph";
import { generateArticleDraft, isAiConfigured } from "@/lib/ingest/generateArticle";
import type { IngestedItem } from "@/lib/ingest/types";

/**
 * Endpoint REAL para disparar la redacción con IA de una Story concreta.
 * No hay tabla de Stories persistida todavía (ver /docs/N8N_AUTOMATION.md),
 * así que reconstruye el Story Graph en vivo a partir de las fuentes
 * verificadas y busca el `storyId` pedido — mismo cálculo exacto que ve
 * el panel /admin en "Cola editorial".
 *
 * POST /api/generate-article  body: { "storyId": "story-..." }
 */
export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no está configurada. Ver /docs/ARCHITECTURE.md §8." },
      { status: 501 }
    );
  }

  let storyId: string | undefined;
  try {
    const body = await request.json();
    storyId = body?.storyId;
  } catch {
    return NextResponse.json({ error: "Body inválido — se espera JSON con { storyId }." }, { status: 400 });
  }
  if (!storyId) {
    return NextResponse.json({ error: "Falta storyId en el body." }, { status: 400 });
  }

  const allItems: IngestedItem[] = [];
  for (const source of SOURCES) {
    if (!source.verified) continue;
    try {
      allItems.push(...(await fetchSource(source)));
    } catch {
      // fuente caída en este momento — no bloquea el resto, igual que en el panel.
    }
  }

  const stories = buildStoryGraph(allItems);
  const story = stories.find((s) => s.storyId === storyId);
  if (!story) {
    return NextResponse.json({ error: `No se encontró la historia "${storyId}" en la corrida actual.` }, { status: 404 });
  }

  try {
    const article = await generateArticleDraft(story);
    return NextResponse.json({ article }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido al generar el borrador." }, { status: 422 });
  }
}
