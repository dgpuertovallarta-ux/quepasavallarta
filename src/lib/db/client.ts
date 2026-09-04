import { Pool } from "pg";

/**
 * Cliente Postgres real (Supabase/Neon/cualquier Postgres administrado) —
 * no un mock. Sin `DATABASE_URL` configurada, el pipeline de ingesta
 * sigue funcionando (solo no persiste) — ver /docs/ARCHITECTURE.md §8
 * para cómo obtener una cadena de conexión real.
 */

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está configurada. Crea un proyecto en Supabase o Neon, " +
        "aplica /docs/DATABASE_SCHEMA.sql y /docs/DATABASE_MIGRATIONS/001_ingest_pipeline_keys.sql, " +
        "y agrega la cadena de conexión como variable de entorno DATABASE_URL " +
        "(ver /docs/ARCHITECTURE.md §8)."
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}
