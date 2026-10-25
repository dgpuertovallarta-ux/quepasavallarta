import { REAL_BUSINESSES } from "@/lib/data";
import { getSiteStats, getLeads, getAllAds, getSponsoredList } from "@/lib/business/db";
import AdManager from "./AdManager";
import SponsoredManager from "./SponsoredManager";
import { scoreClass } from "@/lib/format";
import { SOURCES } from "@/lib/ingest/sources";
import { fetchSource } from "@/lib/ingest/fetchSource";
import { buildStoryGraph, isAutoPublishEligible } from "@/lib/ingest/storyGraph";
import { isAiConfigured } from "@/lib/ingest/generateArticle";
import { getPendingArticles } from "@/lib/db/articles";
import { getStore } from "@netlify/blobs";
import { getConfiguredAdmins } from "@/lib/auth/credentials";
import { isDatabaseConfigured } from "@/lib/db/client";
import ApprovalQueue from "./ApprovalQueue";
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
  const pendingApprovals = await getPendingArticles();
  const urgentes = allItems.filter((i) => i.newsScore >= 90).length;
  const sourcesOk = results.filter((r) => r.ok).length;

  return (
    <>
      <div className="stat-row">
        <StatTile n={allItems.length} l="Historias reales descubiertas ahora" />
        <StatTile n={sourcesOk} l={`Fuentes OK de ${SOURCES.length}`} />
        <StatTile n={pendientes} l="Pendientes de revisión humana" />
        <StatTile n={pendingApprovals.length} l="Publicaciones por aprobar" />
        <StatTile n={urgentes} l="Marcadas urgentes" />
        <StatTile n={REAL_BUSINESSES.length} l="Negocios en la Guía" />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>¿Está funcionando el sistema?</strong>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          La automatización revisa fuentes cada 10 minutos. Las notas confiables y corroboradas se
          publican automáticamente; las que requieren revisión quedan en la cola para los administradores.
          {!isDatabaseConfigured() && " Falta configurar DATABASE_URL para guardar y compartir la cola."}
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
        otros publican, investigamos lo que está pasando&rdquo;). Las notas confiables se publican automáticamente;
        las sensibles o que requieren revisión quedan en Aprobaciones. El botón permite generar y enviar
        una nota a esa misma cola.
      </p>
      {!isAiConfigured() && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
          El botón &ldquo;Generar borrador (IA)&rdquo; ya está conectado a{" "}
          <code>/api/generate-article</code>, pero devolverá un error hasta que
          configures <code>GEMINI_API_KEY</code> (ver <code>/docs/ARCHITECTURE.md</code> §8).
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
                  : isAutoPublishEligible(story)
                  ? "Puede pasar a aprobación"
                  : "Revisión humana"}
              </td>
              <td>
                <GenerateArticleButton
                  storyId={story.storyId}
                  hasCorroboration={story.hasCorroboration}
                  categoryGuess={story.items[0].categoryGuess}
                  newsScore={story.maxNewsScore}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function Aprobaciones() {
  const articles = await getPendingArticles();
  // Datos privados de los reportes ciudadanos pendientes (nunca se publican).
  const reportes = articles.filter((a) => /^(reporte|denuncia) ciudadan/i.test(a.title));
  const store = getStore({ name: "qpv-denuncias", consistency: "strong" });
  const privados = await Promise.all(
    reportes.map(async (a) => ({ a, d: (await store.get(a.slug, { type: "json" }).catch(() => null)) as { nombre?: string; contacto?: string; lugar?: string; tipo?: string; mapa?: string; recibida?: string } | null }))
  );
  return (
    <>
      {privados.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13 }}>Reportes ciudadanos por revisar — datos privados del ciudadano ({privados.length})</strong>
          <ul style={{ fontSize: 13.5, margin: "8px 0 0", paddingLeft: 18 }}>
            {privados.map(({ a, d }) => (
              <li key={a.slug} style={{ marginBottom: 6 }}>
                <b>{a.title.replace(/^(reporte|denuncia) ciudadan[oa]:\s*/i, "")}</b>
                {d?.tipo ? ` · ${d.tipo}` : ""} · {d?.lugar ?? "sin lugar"} · {d?.nombre || "sin nombre"} · {d?.contacto || "sin contacto"}
                {d?.mapa && (
                  <>
                    {" · "}
                    <a href={d.mapa} target="_blank" rel="noreferrer">ver mapa</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Publicaciones pendientes ({articles.length})</strong>
        <ApprovalQueue initialArticles={articles} />
      </div>
    </>
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
          Stories (Story Graph) → calcula News Score → clasifica → publica notas confiables y prepara las demás para revisión →
          intenta persistir en Postgres si <code>DATABASE_URL</code> está configurada. El cron
          real ya existe como código (<code>netlify/functions/scheduled-ingest.ts</code>, cada 10 min) —
          se activa solo al desplegar en Netlify. Para activar la cola hay que configurar las variables
          necesarias, aplicar <code>database/migrations/002_admin_approvals.sql</code> y desplegar.
          Ver <code>ADMIN_SETUP.md</code> para las cuentas y variables requeridas.
        </p>
      </div>
    </>
  );
}

export function Roles() {
  const admins = getConfiguredAdmins();
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
      <strong style={{ fontSize: 13 }}>Administradores con acceso ({admins.length}/3)</strong>
      {admins.length > 0 ? (
        <ul>{admins.map((admin) => <li key={admin.username}>{admin.displayName}</li>)}</ul>
      ) : (
        <p style={{ color: "var(--danger)" }}>No hay cuentas de administrador configuradas.</p>
      )}
      {admins.length < 3 && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Faltan cuentas por configurar. Define ADMIN_USER_3 y ADMIN_PASSWORD_3 en el entorno privado del sitio.
        </p>
      )}
      <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Las tres cuentas tienen el mismo permiso para aprobar o rechazar publicaciones.
      </p>
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

const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export async function Estadisticas() {
  const stats = await getSiteStats(30);
  const max = Math.max(1, ...stats.daily.map((d) => d.views));
  return (
    <>
      <div className="stat-row">
        <StatTile n={stats.totals.today.toLocaleString("es-MX")} l="Visitas hoy" />
        <StatTile n={stats.totals.todayVisitors.toLocaleString("es-MX")} l="Personas hoy" />
        <StatTile n={stats.totals.views.toLocaleString("es-MX")} l="Visitas (30 días)" />
        <StatTile n={stats.totals.visitors.toLocaleString("es-MX")} l="Personas distintas (30 días)" />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Visitas por día — últimos 30 días</strong>
        {stats.daily.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
            Todavía no hay datos. El contador empieza a sumar desde hoy (solo tú lo ves aquí).
          </p>
        ) : (
          <>
            <div className="stats-bars">
              {stats.daily.map((d) => (
                <div key={d.day} style={{ height: `${(d.views / max) * 100}%` }} title={`${fmtDay(d.day)}: ${d.views} visitas, ${d.visitors} personas`} />
              ))}
            </div>
            <div className="stats-axis">
              <span>{fmtDay(stats.daily[0].day)}</span>
              <span>{fmtDay(stats.daily[stats.daily.length - 1].day)}</span>
            </div>
          </>
        )}
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Páginas más vistas (30 días)</strong>
        <table className="data-table">
          <thead>
            <tr>
              <th>Página</th>
              <th>Visitas</th>
            </tr>
          </thead>
          <tbody>
            {stats.topPages.map((p) => (
              <tr key={p.path}>
                <td>
                  <a href={p.path} target="_blank" rel="noopener">{p.path}</a>
                </td>
                <td>{p.views.toLocaleString("es-MX")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
          Estos números son privados. Úsalos para tu media kit y para los reportes a anunciantes.
        </p>
      </div>
    </>
  );
}

export async function Comercial() {
  const [leads, ads, sponsored] = await Promise.all([getLeads(100), getAllAds(), getSponsoredList()]);
  const now = new Date();
  const monthLeads = leads.filter((l) => {
    const d = new Date(l.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const activeAds = ads.filter((a) => a.active && (!a.endsAt || a.endsAt >= now.toISOString().slice(0, 10))).length;
  return (
    <>
      <div className="stat-row">
        <StatTile n={monthLeads} l="Interesados este mes" />
        <StatTile n={activeAds} l="Banners activos" />
        <StatTile n={ads.reduce((s, a) => s + a.clicks, 0)} l="Clics en banners" />
        <StatTile n={sponsored.length} l="Notas patrocinadas" />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Interesados en anunciarse (formulario Anúnciate)</strong>
        {leads.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Aún no llegan solicitudes.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Negocio</th>
                <th>Contacto</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}</td>
                  <td>{l.business}</td>
                  <td>{l.contact}</td>
                  <td>{l.message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Banners</strong>
        <AdManager ads={ads} />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Notas patrocinadas</strong>
        <SponsoredManager items={sponsored} />
      </div>
    </>
  );
}
