import type { Config } from "@netlify/functions";

/**
 * Cron real (Netlify Scheduled Function) — llama a /api/ingest cada
 * 30 minutos en producción. Netlify inyecta automáticamente `URL` con el
 * dominio real del sitio desplegado; no hace falta configurarlo a mano.
 *
 * Esto reemplaza el "falta programar un cron" que hasta ahora estaba
 * documentado como pendiente en /docs/N8N_AUTOMATION.md — en cuanto el
 * sitio esté desplegado en Netlify con este archivo presente, Netlify lo
 * detecta y lo programa solo (no requiere n8n para esto).
 */
async function scheduledIngest() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL;
  if (!siteUrl) {
    console.error("[scheduled-ingest] Falta la variable de entorno URL/DEPLOY_URL (Netlify la inyecta en producción).");
    return new Response("Sin URL de sitio configurada", { status: 500 });
  }

  try {
    const res = await fetch(`${siteUrl}/api/ingest`);
    const body = (await res.json().catch(() => null)) as { summary?: unknown } | null;
    console.log("[scheduled-ingest] Ejecutado:", res.status, JSON.stringify(body?.summary));
    return new Response("OK");
  } catch (err) {
    console.error("[scheduled-ingest] Falló la llamada a /api/ingest:", err);
    return new Response("Error al ejecutar la ingesta programada", { status: 500 });
  }
}

export default scheduledIngest;

export const config: Config = {
  schedule: "*/30 * * * *",
};
