import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/ingest/sources";
import { fetchSource } from "@/lib/ingest/fetchSource";
import { buildStoryGraph } from "@/lib/ingest/storyGraph";
import { persistIngestRun } from "@/lib/db/persistIngest";
import { isDatabaseConfigured } from "@/lib/db/client";
import type { IngestedItem } from "@/lib/ingest/types";

/**
 * Endpoint REAL de ingesta — no es un mock. Al llamarlo, descarga en
 * vivo los feeds RSS reales registrados en /src/lib/ingest/sources.ts,
 * los normaliza y calcula su News Score real.
 *
 * Todavía NO escribe en una base de datos (no hay una conectada aún —
 * ver /docs/ARCHITECTURE.md). Por ahora devuelve el resultado en la
 * respuesta para poder probar el pipeline de punta a punta con datos
 * reales. En cuanto exista Postgres (Supabase/Neon), este endpoint
 * pasa a hacer INSERT en `stories`/`articles` en vez de solo responder.
 *
 * Probarlo: GET /api/ingest
 * En producción, este endpoint se llama automáticamente por cron
 * (Netlify Scheduled Functions o similar) — ver /docs/N8N_AUTOMATION.md.
 */
export async function GET() {
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
  };

  return NextResponse.json({ summary, stories, results }, { status: 200 });
}
