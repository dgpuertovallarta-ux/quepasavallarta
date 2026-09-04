import { BUSINESSES } from "@/lib/data";
import { scoreClass } from "@/lib/format";
import { SOURCES } from "@/lib/ingest/sources";
import { fetchSource } from "@/lib/ingest/fetchSource";
import { buildStoryGraph } from "@/lib/ingest/storyGraph";
import { isAiConfigured } from "@/lib/ingest/generateArticle";
import GenerateArticleButton from "./GenerateArticleButton";
import type { IngestedItem } from "@/lib/ingest/types";

function StatTile({ n, l }: { n: React.ReactNode; l: string }) {
  return (
    <div className="stat-tile">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

/**
 * Descarga en vivo todas las fuentes reales registradas. Sin caché
 * (cada visita al panel vuelve a consultar) para que el propietario
 * siempre vea el estado real, no una foto vieja del build.
 */
async function fetchAllSources(): Promise<{
  sourceId: string;
  ok: boolean;
  items: IngestedItem[];
  error?: string;
  lastRunAt: string;
}[]> {
  return Promise.all(
    SOURCES.map(async (source) => {
      const lastRunAt = new Date().toISOString();
      if (!source.verified) {
        return { sourceId: source.id, ok: false, items: [], error: "No verificada — ver nota en el registro de fuentes.", lastRunAt };
      }
      try {
        const items = await fetchSource(source);
        return { sourceId: source.id, ok: true, items, lastRunAt };
      } catch (err) {
        return {
          sourceId: source.id,
          ok: false,
          items: [],
          error: err instanceof Error ? err.message : "Error desconocido",
          lastRunAt,
        };
      }
    })
  );
}

function SourcesTable({ results }: { results: Awaited<ReturnType<typeof fetchAllSources>> }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Fuente</th>
          <th>Nivel</th>
          <th>Tipo</th>
          <th>Estado</th>
          <th>Última consulta</th>
        </tr>
      </thead>
      <tbody>
        {SOURCES.map((s) => {
          const r = results.find((x) => x.sourceId === s.id);
          return (
            <tr key={s.id}>
              <td>
                {s.name}
                {s.autoDetectOnly && (
                  <span className="chip" style={{ marginLeft: 6, fontSize: 10.5 }} title={s.note}>
                    solo detección
                  </span>
                )}
              </td>
              <td>NIVEL {s.level}</td>
              <td>{s.type}</td>
              <td>
                {r?.ok ? (
                  <span className="chip chip-verified">OK — {r.items.length} items reales</span>
                ) : (
                  <span className="chip chip-breaking" title={r?.error}>
                    {r?.error?.slice(0, 40) || "Sin datos"}
                  </span>
                )}
              </td>
              <td>{r ? new Date(r.lastRunAt).toLocaleTimeString("es-MX") : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export async function Resumen() {
  const results = await fetchAllSources();
  const allItems = results.flatMap((r) => r.items);
  const pendientes = allItems.filter((i) => i.status === "needs_review").length;
  const urgentes = allItems.filter((i) => i.newsScore >= 90).length;
  const sourcesOk = results.filter((r) => r.ok).length;

  return (
    <>
      <div className="stat-row">
        <StatTile n={allItems.length} l="Historias reales descubiertas ahora" />
        <StatTile n={sourcesOk} l={`Fuentes OK de ${SOURCES.length}`} />
        <StatTile n={pendientes} l="Pendientes de revisión humana" />
        <StatTile n={urgentes} l="Marcadas urgentes" />
        <StatTile n={BUSINESSES.length} l="Negocios en directorio (demo)" />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>¿Está funcionando el sistema?</strong>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Este bloque ya no es una simulación: en cada carga consulta en vivo las fuentes reales
          registradas en <code>src/lib/ingest/sources.ts</code> y calcula su News Score real. Todavía no
          escribe en una base de datos (falta conectar Postgres/Supabase — ver{" "}
          <code>/docs/ARCHITECTURE.md</code>), así que lo que ves aquí es el resultado de la consulta más
          reciente, no un histórico.
        </p>
        <SourcesTable results={results} />
      </div>
    </>
  );
}

export async function Cola() {
  const results = await fetchAllSources();
  const allItems = results.flatMap((r) => r.items);
  const stories = buildStoryGraph(allItems);

  return (
    <div className="panel">
      <strong style={{ fontSize: 13 }}>Cola editorial (Story Graph + News Score) — datos reales, en vivo</strong>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
        Cada fila es una <strong>Story</strong>: si dos o más fuentes cubren el mismo evento, se agrupan
        bajo un solo STORY ID en vez de generar un artículo por fuente (regla &ldquo;no copiamos lo que
        otros publican, investigamos lo que está pasando&rdquo; — ver{" "}
        <code>src/lib/ingest/storyGraph.ts</code> y <code>src/lib/ingest/editorialPrompt.ts</code>). Todo
        lo que viene de fuentes NIVEL A (medios) pasa siempre a revisión humana; nada se copia ni se
        publica automáticamente salvo NIVEL B (oficial) con score alto.
      </p>
      {!isAiConfigured() && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
          El botón &ldquo;Generar borrador (IA)&rdquo; ya está conectado a{" "}
          <code>/api/generate-article</code>, pero devolverá un error hasta que
          configures <code>ANTHROPIC_API_KEY</code> (ver <code>/docs/ARCHITECTURE.md</code> §8).
        </p>
      )}
      {stories.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--danger)" }}>
          No se pudo descargar ninguna fuente en este momento (revisa la pestaña &ldquo;Fuentes y
          automatización&rdquo; para ver el error).
        </p>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Story (título de referencia interno)</th>
            <th>Fuentes</th>
            <th>Categoría (auto)</th>
            <th>Score</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stories.map((story) => (
            <tr key={story.storyId}>
              <td>
                <div>{story.labelSeed}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {story.items.map((it, i) => (
                    <span key={it.link}>
                      {i > 0 && " · "}
                      <a href={it.link} target="_blank" rel="noopener">
                        {it.sourceName}
                      </a>
                    </span>
                  ))}
                </div>
              </td>
              <td>
                {story.sourceCount} ({story.levels.map((l) => `NIVEL ${l}`).join(", ")})
              </td>
              <td>{story.items[0].categoryGuess}</td>
              <td>
                <span className={`score-pill ${scoreClass(story.maxNewsScore)}`}>{story.maxNewsScore}</span>
              </td>
              <td title={story.items[0].statusReason}>
                {!story.hasCorroboration
                  ? "Sin corroborar (solo C/D)"
                  : story.needsReview
                  ? "Revisión humana"
                  : "Publicable"}
              </td>
              <td>
                <GenerateArticleButton storyId={story.storyId} hasCorroboration={story.hasCorroboration} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function Fuentes() {
  const results = await fetchAllSources();
  return (
    <>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Fuentes registradas</strong>
        <SourcesTable results={results} />
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
          Ver <code>src/lib/ingest/sources.ts</code> para agregar o desactivar fuentes — no hace falta
          tocar el resto del código.
        </p>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 13 }}>Pipeline de ingesta real</strong>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          <code>GET /api/ingest</code> ya ejecuta de verdad: descarga las fuentes → normaliza → agrupa en
          Stories (Story Graph) → calcula News Score → clasifica → decide auto-publicable / revisión /
          descarte → intenta persistir en Postgres si <code>DATABASE_URL</code> está configurada. El cron
          real ya existe como código (<code>netlify/functions/scheduled-ingest.ts</code>, cada 30 min) —
          se activa solo al desplegar en Netlify. Lo único que falta para producción real: (1) crear un
          proyecto Postgres (Supabase o Neon) y configurar <code>DATABASE_URL</code>, (2) configurar{" "}
          <code>ANTHROPIC_API_KEY</code> para activar &ldquo;Generar borrador (IA)&rdquo; en la Cola
          editorial, (3) desplegar en Netlify. Ver <code>/docs/ARCHITECTURE.md</code> §8 para el detalle
          exacto de cada variable de entorno.
        </p>
      </div>
    </>
  );
}

export function Roles() {
  const rows: [string, string][] = [
    ["Super Admin", "Control total: configuración, usuarios, integraciones, automatizaciones, editorial, monetización"],
    ["Administrador", "Gestión general según permisos asignados"],
    ["Editor", "Crear, editar, revisar, publicar noticias, administrar categorías"],
    ["Reportero / Colaborador", "Crear noticias y fotos, enviar a revisión (no publica directo)"],
    ["Comercial", "Negocios, clientes, campañas, patrocinios, leads"],
    ["Moderador", "Revisión de contenido y comunidad"],
  ];
  return (
    <div className="panel">
      <strong style={{ fontSize: 13 }}>Roles del sistema (configurable)</strong>
      <table className="data-table">
        <thead>
          <tr>
            <th>Rol</th>
            <th>Permisos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([r, d]) => (
            <tr key={r}>
              <td>
                <strong>{r}</strong>
              </td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
        Detalle completo en <code>/docs/ROLES_PERMISSIONS.md</code>.
      </p>
    </div>
  );
}

export function Comercial() {
  return (
    <>
      <div className="stat-row">
        <StatTile n={BUSINESSES.length} l="Negocios activos" />
        <StatTile n={BUSINESSES.filter((b) => b.featured).length} l="Destacados" />
        <StatTile n="—" l="Leads este mes (conectar CRM)" />
        <StatTile n="—" l="Ingresos (conectar pagos)" />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Negocios en Vallarta Guía / Conecta</strong>
        <table className="data-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Categoría</th>
              <th>Plan</th>
              <th>Destacado</th>
            </tr>
          </thead>
          <tbody>
            {BUSINESSES.map((b) => (
              <tr key={b.slug}>
                <td>{b.name}</td>
                <td>{b.category}</td>
                <td>{b.plan}</td>
                <td>{b.featured ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
