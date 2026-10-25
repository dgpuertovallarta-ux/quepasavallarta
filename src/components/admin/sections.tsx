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
import { estadoColaRedes } from "@/lib/qpv/colaRedes";
import { publicacionesDelMes, mesActual, RUTAS_SECCION, type SeccionPatrocinio } from "@/lib/business/patrocinios";
import { vistasDelMes } from "@/lib/business/db";
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
        // Ninguna fuente puede trabar el panel: máximo 6 s cada una.
        const items = await Promise.race([
          fetchSource(source),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("La fuente tardó demasiado en responder.")), 6000)),
        ]);
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
  // 2026-10-25: la portada del panel ya no consulta las 27 fuentes en vivo
  // (tardaba tanto que el panel se quedaba cargando). Solo datos propios, al instante.
  const [pendingApprovals, cola] = await Promise.all([
    getPendingArticles().catch(() => []),
    estadoColaRedes().catch(() => []),
  ]);
  const reportes = pendingApprovals.filter((a) => /^(reporte|denuncia) ciudadan/i.test(a.title)).length;
  const hoy = new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
  const fbHoy = cola.filter((x) => x.estado === "publicada" && x.publicadaEn && new Date(x.publicadaEn).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }) === hoy);
  const enCola = cola.filter((x) => x.estado === "pendiente").length;
  const tokenMalo = cola.some((x) => x.estado === "pendiente" && /token de facebook inválido/i.test(x.resultado ?? ""));

  return (
    <>
      <div className="stat-row">
        <StatTile n={pendingApprovals.length} l="Publicaciones por aprobar" />
        <StatTile n={reportes} l="Reportes ciudadanos nuevos" />
        <StatTile n={fbHoy.length} l="Publicadas hoy en Facebook" />
        <StatTile n={enCola} l="Esperando turno para Facebook" />
        <StatTile n={REAL_BUSINESSES.length} l="Negocios en la Guía" />
      </div>
      {tokenMalo && (
        <div className="panel" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
          <strong style={{ color: "var(--danger)" }}>La llave de Facebook no funciona.</strong>
          <p style={{ fontSize: 13.5, margin: "6px 0 0" }}>Las notas se quedan esperando hasta que se ponga una llave nueva en Netlify (FB_PAGE_ACCESS_TOKEN).</p>
        </div>
      )}
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Últimas publicaciones en Facebook</strong>
        {fbHoy.length === 0 && <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Todavía no sale nada hoy.</p>}
        <ul style={{ fontSize: 13.5, margin: "8px 0 0", paddingLeft: 18 }}>
          {fbHoy
            .sort((a, b) => b.publicadaEn!.localeCompare(a.publicadaEn!))
            .slice(0, 12)
            .map((x) => (
              <li key={x.id} style={{ marginBottom: 4 }}>
                {new Date(x.publicadaEn!).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" })} · {x.title}
              </li>
            ))}
        </ul>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
          La automatización revisa fuentes cada 10 minutos. Para ver el estado de cada fuente, entra a «Fuentes y automatización».
          {!isDatabaseConfigured() && " Falta configurar DATABASE_URL para guardar y compartir la cola."}
        </p>
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

/** Reportes ciudadanos (/reporte): solo los reportes, con los datos privados del ciudadano. */
export async function Reportes() {
  const todos = await getPendingArticles();
  const reportes = todos.filter((a) => /^(reporte|denuncia) ciudadan/i.test(a.title));
  const store = getStore({ name: "qpv-denuncias", consistency: "strong" });
  const datos = await Promise.all(
    reportes.map(async (a) => ({ a, d: (await store.get(a.slug, { type: "json" }).catch(() => null)) as { nombre?: string; contacto?: string; lugar?: string; tipo?: string; mapa?: string; recibida?: string } | null }))
  );
  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 13 }}>Reportes ciudadanos por revisar ({reportes.length})</strong>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 10px" }}>
          Llegan desde quepasavta.com/reporte. Al aprobar, el reporte sale en el sitio y en Facebook con su foto. Nombre, contacto y
          ubicación exacta nunca se publican.
        </p>
        {datos.length === 0 && <p style={{ fontSize: 13.5 }}>No hay reportes nuevos.</p>}
        <ul style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
          {datos.map(({ a, d }) => (
            <li key={a.slug} style={{ marginBottom: 6 }}>
              <b>{a.title.replace(/^(reporte|denuncia) ciudadan[oa]:\s*/i, "")}</b>
              {d?.tipo ? ` · ${d.tipo}` : ""} · {d?.lugar ?? "sin lugar"} · {d?.nombre || "sin nombre"} · {d?.contacto || "sin contacto"}
              {d?.recibida ? ` · ${new Date(d.recibida).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" })}` : ""}
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
      {reportes.length > 0 && (
        <div className="panel">
          <strong style={{ fontSize: 13 }}>Aprobar o rechazar</strong>
          <ApprovalQueue initialArticles={reportes} />
        </div>
      )}
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

const SECCION_DE_SLOT: Record<string, { s: SeccionPatrocinio; t: string }> = {
  "pat-trafico": { s: "trafico", t: "QPV al Volante (tráfico)" },
  "pat-huracanes": { s: "huracanes", t: "Videos de huracán" },
  "pat-clima": { s: "clima", t: "Clima" },
  "pat-reportes": { s: "reportes", t: "Reporte Ciudadano" },
};

async function PatrociniosPanel({ ads }: { ads: Awaited<ReturnType<typeof getAllAds>> }) {
  const pats = ads.filter((a) => a.slot.startsWith("pat-"));
  const filas = await Promise.all(
    pats.map(async (a) => {
      const sec = SECCION_DE_SLOT[a.slot];
      const [pubs, vistas] = await Promise.all([publicacionesDelMes(a.id), vistasDelMes(sec ? RUTAS_SECCION[sec.s] : [])]);
      return { a, sec, pubs: pubs.n, vistas };
    })
  );
  return (
    <div className="panel">
      <strong style={{ fontSize: 13 }}>Patrocinios «Presentado por» — resultados de {mesActual()}</strong>
      {filas.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Todavía no hay patrocinios. Agrégalos abajo en «Banners y patrocinios».</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Patrocinador</th>
              <th>Sección</th>
              <th>Publicaciones en Facebook (mes)</th>
              <th>Visitas a la sección (mes)</th>
              <th>Clics al patrocinador</th>
              <th>Estado</th>
              <th>Reporte</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ a, sec, pubs, vistas }) => (
              <tr key={a.id}>
                <td>{a.advertiser}</td>
                <td>{sec?.t ?? a.slot}</td>
                <td>{pubs}</td>
                <td>{sec?.s === "huracanes" ? "— (va en los videos)" : vistas}</td>
                <td>{a.clicks}</td>
                <td>{a.active && (!a.endsAt || a.endsAt >= new Date().toISOString().slice(0, 10)) ? "Activo" : "Pausado / vencido"}</td>
                <td>
                  <a href={`/admin/reporte-patrocinio/${a.id}`} target="_blank" rel="noreferrer">Ver reporte</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
      <PatrociniosPanel ads={ads} />
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Banners y patrocinios «Presentado por»</strong>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 10px" }}>
          Para un patrocinio de sección elige en «Dónde» una opción «Presentado por» y sube el <b>logo</b> del cliente (PNG con fondo
          transparente de preferencia). Sale en la sección del sitio y en sus publicaciones automáticas de Facebook.
        </p>
        <AdManager ads={ads} />
      </div>
      <div className="panel">
        <strong style={{ fontSize: 13 }}>Notas patrocinadas</strong>
        <SponsoredManager items={sponsored} />
      </div>
    </>
  );
}
