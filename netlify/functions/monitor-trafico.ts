import type { Config } from "@netlify/functions";

/**
 * QPV al Volante — revisa el tráfico cada 20 minutos (cabe en el plan
 * gratuito de TomTom: ~2,200 consultas de incidentes y ~15,000 de rutas al mes).
 * Necesita QPV_TOKEN_INTERNO y TOMTOM_API_KEY en las variables de Netlify.
 */
async function monitorTrafico() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL;
  const clave = process.env.QPV_TOKEN_INTERNO;
  if (!siteUrl || !clave) {
    console.error("[monitor-trafico] Falta URL o QPV_TOKEN_INTERNO.");
    return new Response("Sin configuración", { status: 500 });
  }
  try {
    const res = await fetch(`${siteUrl}/api/trafico`, { method: "POST", headers: { "x-qpv-token": clave } });
    console.log("[monitor-trafico]", res.status, await res.text());
    return new Response("OK");
  } catch (err) {
    console.error("[monitor-trafico] Falló:", err);
    return new Response("Error", { status: 500 });
  }
}

export default monitorTrafico;

// 2026-10-27: apagado. El sitio pasó a WordPress (HostGator) y este trabajo lo hace
// el robot de GitHub Actions (.github/workflows/robot.yml). Si se volviera a
// programar aquí, las notas y los posts de Facebook saldrían dobles.
export const config: Config = {};
