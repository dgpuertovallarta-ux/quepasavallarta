import { getPool, isDatabaseConfigured } from "./client";
import type { Story } from "../ingest/storyGraph";
import type { Source } from "../ingest/sources";

export type PersistResult = {
  persisted: boolean;
  sourcesUpserted: number;
  storiesUpserted: number;
};

/**
 * Persiste una corrida real de ingesta (fuentes + Stories agrupadas) en
 * Postgres. Upsert idempotente por `external_key` — correr esto cada
 * 30 min (ver netlify/functions/scheduled-ingest.ts) no duplica filas,
 * solo actualiza `news_score`/`updated_at` y agrega fuentes nuevas a una
 * Story existente.
 *
 * Si no hay `DATABASE_URL` configurada, no falla: devuelve
 * `persisted: false` para que /api/ingest siga respondiendo en vivo sin
 * base de datos (comportamiento actual, documentado como pendiente en
 * /docs/N8N_AUTOMATION.md).
 */
export async function persistIngestRun(sources: Source[], stories: Story[]): Promise<PersistResult> {
  if (!isDatabaseConfigured()) {
    return { persisted: false, sourcesUpserted: 0, storiesUpserted: 0 };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const s of sources) {
      await client.query(
        `insert into sources (external_key, name, type, url, trust_level, level, auto_detect_only, active, allow_image_extraction, last_run_at, last_status)
         values ($1,$2,$3,$4,$5,$6,$7,true,$8, now(), $9)
         on conflict (external_key) do update set
           name = excluded.name,
           url = excluded.url,
           trust_level = excluded.trust_level,
           level = excluded.level,
           auto_detect_only = excluded.auto_detect_only,
           allow_image_extraction = excluded.allow_image_extraction,
           last_run_at = now(),
           last_status = excluded.last_status`,
        [s.id, s.name, s.type, s.url || null, s.trustLevel, s.level, s.autoDetectOnly, s.allowImageExtraction, s.verified ? "ok" : "no_verificada"]
      );
    }

    for (const story of stories) {
      const storyRes = await client.query<{ id: string }>(
        `insert into stories (external_key, title, status, news_score, updated_at)
         values ($1,$2,'developing',$3, now())
         on conflict (external_key) do update set
           title = excluded.title,
           news_score = excluded.news_score,
           updated_at = now()
         returning id`,
        [story.storyId, story.labelSeed, story.maxNewsScore]
      );
      const storyDbId = storyRes.rows[0].id;

      for (const item of story.items) {
        await client.query(
          `insert into story_sources (story_id, source_id, raw_content, url, external_item_url, captured_at)
           select $1, s.id, $2, $3, $3, now()
           from sources s where s.external_key = $4
           on conflict (story_id, source_id, url) do nothing`,
          [storyDbId, `${item.title}\n\n${item.excerpt}`, item.link, item.sourceId]
        );
      }
    }

    await client.query("commit");
    return { persisted: true, sourcesUpserted: sources.length, storiesUpserted: stories.length };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
