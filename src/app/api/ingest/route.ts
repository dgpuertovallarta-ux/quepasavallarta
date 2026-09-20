import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/ingest/sources";
import { fetchSource } from "@/lib/ingest/fetchSource";
import { buildStoryGraph } from "@/lib/ingest/storyGraph";
import { persistIngestRun } from "@/lib/db/persistIngest";
import { isDatabaseConfigured } from "@/lib/db/client";
import { runAutoPublish } from "@/lib/ingest/autoPublish";
import { runExplicaPublish } from "@/lib/ingest/explicaPublish";
import type { IngestedItem } from "@/lib/ingest/types";

export const maxDuration = 60;

/**
 * Endpoint REAL de ingesta — no es un mock. Descarga en vivo los feeds
 * RSS reales registrados en /src/lib/ingest/sources.ts, los normaliza,
 * agrupa en Stories (Story Graph) y calcula su News Score real. Persiste
 * el resultado en Postgres si DATABASE_URL está configurada.
 *
 * Además, dispara la auto-publicación real (runAutoPublish): decisión
 * explícita del propietario (2026-09) de que las Stories NIVEL A/B con
 * corroboración, sin contenido sensible y con score alto se publiquen
 * solas, sin revisión humana — ver /lib/ingest/autoPublish.ts. Contenido
 * sensible y fuentes NIVEL C/D nunca se auto-publican, sin excepción.
 *
 * Probarlo: GET /api/ingest
 * En producción, este endpoint se llama automáticamente cada 30 min por
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

async function runIngest() {
  const results: { sourceId: string; ok: boolean; items?: IngestedItem[]; error?: string }[] = [];

  for (const source of SOURCES) {
    if (!source.verified) {
      results.push({
        sourceId: source.id,
        ok: false,
        error: `Fuente no verificada todavía: ${source.note}`,
      });
      continue;
    }
    try {
      const items = await fetchSource(source);
      results.push({ sourceId: source.id, ok: true, items });
    } catch (err) {
      results.push({
        sourceId: source.id,
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido al descargar la fuente.",
      });
    }
  }

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

  const autoPublish = await runAutoPublish(stories);
  const explicaPublish = await runExplicaPublish(stories);

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

  return NextResponse.json({ summary, stories, results }, { status: 200 });
}
