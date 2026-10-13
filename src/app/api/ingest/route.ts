import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/ingest/sources";
import { fetchSource } from "@/lib/ingest/fetchSource";
import { buildStoryGraph } from "@/lib/ingest/storyGraph";
import { persistIngestRun } from "@/lib/db/persistIngest";
import { isDatabaseConfigured } from "@/lib/db/client";
import { runAutoPublish, type AutoPublishResult } from "@/lib/ingest/autoPublish";
import { runExplicaPublish, type ExplicaPublishResult } from "@/lib/ingest/explicaPublish";
import type { IngestedItem } from "@/lib/ingest/types";

export const maxDuration = 60;

/**
 * Endpoint REAL de ingesta — no es un mock. Descarga en vivo los feeds
 * RSS reales registrados en /src/lib/ingest/sources.ts, los normaliza,
 * agrupa en Stories (Story Graph) y calcula su News Score real. Persiste
 * el resultado en Postgres si DATABASE_URL está configurada.
 *
 * Además, redacta y publica automáticamente notas neutrales corroboradas;
 * las noticias con señales sensibles quedan en la cola de aprobación.
 *
 * Probarlo: GET /api/ingest
 * En producción, este endpoint se llama automáticamente cada 10 min por
 * netlify/functions/scheduled-ingest.ts — ver /docs/N8N_AUTOMATION.md.
 */
export async function GET() {
  try {
    return await runIngest();
  } catch (err) {
    // Red de seguridad: sin esto, cualquier error no previsto tumba toda
    // la función serverless ("Invocation Failed" en Netlify) en vez de
    // responder con un error legible — ya pasó una vez de forma
    // intermitente y costó tiempo diagnosticarlo sin esta traza.
    console.error("[api/ingest] Error no manejado:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido en /api/ingest." },
      { status: 500 }
    );
  }
}

// Reparto del tiempo del request (maxDuration = 60 s). Publicar una nota
// completa (texto + imagen + redes) tarda unos 25-35 s, así que un
// intento nuevo solo puede EMPEZAR mientras todavía quepa uno completo.
const RETRY_WINDOW_MS = 22_000;

async function runIngest() {
  const startedAt = Date.now();
  // Todas las fuentes se consultan al mismo tiempo (antes era una tras
  // otra y la corrida completa llegaba a tardar ~40 s, al filo del
  // límite de tiempo). El orden del resultado es el mismo de SOURCES.
  const results: { sourceId: string; ok: boolean; items?: IngestedItem[]; error?: string }[] = await Promise.all(
    SOURCES.map(async (source) => {
      if (!source.verified) {
        return { sourceId: source.id, ok: false, error: `Fuente no verificada todavía: ${source.note}` };
      }
      try {
        const items = await fetchSource(source);
        return { sourceId: source.id, ok: true, items };
      } catch (err) {
        return {
          sourceId: source.id,
          ok: false,
          error: err instanceof Error ? err.message : "Error desconocido al descargar la fuente.",
        };
      }
    })
  );

  const allItems = results.flatMap((r) => r.items || []);
  const stories = buildStoryGraph(allItems);

  let db: { configured: boolean; persisted: boolean; error?: string };
  if (!isDatabaseConfigured()) {
    db = { configured: false, persisted: false };
  } else {
    try {
      const result = await persistIngestRun(SOURCES, stories);
      db = { configured: true, persisted: result.persisted };
    } catch (err) {
      db = { configured: true, persisted: false, error: err instanceof Error ? err.message : "Error desconocido al persistir." };
    }
  }

  // Una corrida prepara UNA pieza para revisión: una nota o un explicador. Las notas
  // van primero, salvo en la corrida de la hora en punto (minuto 0-9),
  // donde un explicador pendiente tiene preferencia — así "Vallarta
  // Explica" no se queda sin salir en los días en que cada corrida
  // publica una nota, y las notas conservan 5 de cada 6 corridas.
  const retryUntil = startedAt + RETRY_WINDOW_MS;
  const explainerSlot = new Date(startedAt).getUTCMinutes() < 10;
  let autoPublish: AutoPublishResult;
  let explicaPublish: ExplicaPublishResult;
  if (explainerSlot) {
    explicaPublish = await runExplicaPublish(stories, { startBefore: retryUntil });
    const explainerQueued = explicaPublish.ran && explicaPublish.queuedForReview;
    autoPublish = await runAutoPublish(stories, { attemptsUntil: retryUntil, startBefore: explainerQueued ? startedAt : retryUntil });
  } else {
    autoPublish = await runAutoPublish(stories, { attemptsUntil: retryUntil });
    explicaPublish = await runExplicaPublish(stories, { startBefore: autoPublish.queuedForReview + autoPublish.autoPublished > 0 ? startedAt : retryUntil });
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    sourcesQueried: SOURCES.length,
    sourcesOk: results.filter((r) => r.ok).length,
    itemsFound: allItems.length,
    storiesFound: stories.length,
    autoPublishable: allItems.filter((i) => i.status === "auto_publishable").length,
    needsReview: allItems.filter((i) => i.status === "needs_review").length,
    discarded: allItems.filter((i) => i.status === "discard").length,
    db,
    autoPublish,
    explicaPublish,
  };

  // Queda en los registros de la función (Netlify → Logs) para poder ver
  // qué pasó en cada corrida: qué se publicó y qué error dio cada paso.
  console.log(
    "[ingest]",
    JSON.stringify({
      sourcesOk: summary.sourcesOk,
      itemsFound: summary.itemsFound,
      storiesFound: summary.storiesFound,
      autoPublish,
      sourceErrors: results.filter((r) => !r.ok && r.error && !r.error.startsWith("Fuente no verificada")).map((r) => `${r.sourceId}: ${r.error}`),
    })
  );

  return NextResponse.json({ summary, stories, results }, { status: 200 });
}
