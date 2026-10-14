/**
 * Limpieza automática de notas repetidas ya publicadas (2026-10).
 *
 * Pasaba que dos corridas de /api/ingest coincidían y publicaban la misma
 * historia dos veces en el mismo minuto, con títulos distintos. publishArticle
 * ya lo evita con un candado (ver LOCK_PUBLICAR); esto limpia lo que ya salió:
 *   - misma historia (story_id) → se queda la primera, o
 *   - publicadas con menos de 30 min de diferencia y el filtro de duplicados
 *     las ve como el mismo hecho (o con menos de 15 min y mismo tema), o
 *   - título casi igual (parecido >= 0.5) en las últimas 48 h.
 * La repetida pasa a 'discarded' (no se borra) y su enlace redirige a la que
 * se quedó, para que los posts de Facebook que ya la compartieron no den 404.
 * Corre en cada /api/ingest.
 */
import { getStore } from "@netlify/blobs";
import { getPool } from "../db/client";
import { esDuplicada, parecido } from "./dedupe";

const store = () => getStore({ name: "qpv-duplicados", consistency: "strong" });

export async function redireccionDuplicada(slug: string): Promise<string | null> {
  try {
    return ((await store().get("redir/" + slug, { type: "text" })) as string | null) || null;
  } catch {
    return null;
  }
}

type Fila = { slug: string; title: string; excerpt: string | null; story_id: string | null; published_at: string; is_explainer: boolean };

export function encontrarRepetidas(filas: Fila[]): { repetida: string; queda: string; motivo: string }[] {
  const orden = [...filas].sort((a, b) => +new Date(a.published_at) - +new Date(b.published_at));
  const quedan: Fila[] = [];
  const out: { repetida: string; queda: string; motivo: string }[] = [];
  for (const f of orden) {
    let motivo = "";
    let queda: Fila | undefined;
    for (const q of quedan) {
      if (q.is_explainer !== f.is_explainer) continue;
      const minutos = (+new Date(f.published_at) - +new Date(q.published_at)) / 60_000;
      if (f.story_id && f.story_id === q.story_id) {
        motivo = "misma historia";
      } else {
        const r = esDuplicada(
          { titulo: f.title, resumen: f.excerpt ?? undefined },
          [{ id: q.slug, titulo: q.title, resumen: q.excerpt ?? undefined }],
          72
        );
        const soloTitulo = esDuplicada({ titulo: f.title }, [{ id: q.slug, titulo: q.title }], 72);
        const txt = (x: Fila) => `${x.title} ${x.excerpt ?? ""}`;
        if (r.duplicada && minutos <= 30) motivo = "mismo hecho, publicadas a la vez";
        else if (minutos <= 15 && parecido(txt(f), txt(q)) >= 0.25) motivo = "mismo tema, publicadas a la vez";
        else if (soloTitulo.duplicada && soloTitulo.parecido >= 0.5 && minutos <= 48 * 60) motivo = "título casi igual";
      }
      if (motivo) {
        queda = q;
        break;
      }
    }
    if (queda) out.push({ repetida: f.slug, queda: queda.slug, motivo });
    else quedan.push(f);
  }
  return out;
}

/** Quita del sitio las notas repetidas de los últimos 3 días. Nunca lanza. */
export async function limpiarDuplicados(): Promise<string> {
  try {
    const pool = getPool();
    const { rows } = await pool.query<Fila>(
      `select slug, title, excerpt, story_id::text as story_id, published_at, is_explainer
         from articles
        where status = 'published' and published_at > now() - interval '3 days'`
    );
    const repetidas = encontrarRepetidas(rows);
    if (!repetidas.length) return "Sin notas repetidas.";
    const s = store();
    for (const r of repetidas) {
      await pool.query(`update articles set status = 'discarded', updated_at = now() where slug = $1 and status = 'published'`, [r.repetida]);
      await s.set("redir/" + r.repetida, r.queda);
    }
    console.log("[limpiarDuplicados]", JSON.stringify(repetidas));
    return `Quitadas ${repetidas.length} notas repetidas: ${repetidas.map((r) => `${r.repetida} → ${r.queda} (${r.motivo})`).join("; ")}`;
  } catch (err) {
    console.error("[limpiarDuplicados]", err);
    return `Error al limpiar duplicados: ${err instanceof Error ? err.message : "desconocido"}`;
  }
}
