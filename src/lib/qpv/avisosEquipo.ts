/**
 * Avisos al equipo por WhatsApp cuando llega un reporte ciudadano (2026-10-24).
 *
 * Los números NO aparecen en el sitio ni en el código: se configuran en
 * Netlify (Environment variables), uno por variable, con su llave de
 * CallMeBot (servicio gratuito de avisos por WhatsApp):
 *
 *   REPORTE_AVISO_1 = 5213221234567:1234567     (número con 521 + llave)
 *   REPORTE_AVISO_2 = …
 *   REPORTE_AVISO_3 = …
 *
 * Cada persona activa su llave una sola vez mandando por WhatsApp
 * "I allow callmebot to send me messages" al número de CallMeBot
 * (ver https://www.callmebot.com/blog/free-api-whatsapp-messages/).
 * Nunca lanza: si un aviso falla, el reporte igual queda guardado.
 */
export type AvisoReporte = { tipo: string; lugar: string; resumen: string; foto?: string; mapa?: string; slug: string };

function destinatarios(): { telefono: string; llave: string }[] {
  return [process.env.REPORTE_AVISO_1, process.env.REPORTE_AVISO_2, process.env.REPORTE_AVISO_3]
    .filter(Boolean)
    .map((v) => {
      const [telefono, llave] = String(v).split(":").map((x) => x.trim());
      return { telefono: telefono.replace(/[^\d]/g, ""), llave };
    })
    .filter((d) => d.telefono.length >= 10 && d.llave);
}

export function avisosConfigurados(): number {
  return destinatarios().length;
}

export async function avisarEquipo(r: AvisoReporte, sitio: string): Promise<number> {
  const texto = [
    `📣 *Nuevo reporte ciudadano* (${r.tipo})`,
    `📍 ${r.lugar}`,
    r.resumen.slice(0, 280),
    r.mapa ? `Mapa: ${r.mapa}` : "",
    r.foto ? `Foto: ${r.foto}` : "",
    `Revisar y aprobar: ${sitio}/admin/aprobaciones`,
  ]
    .filter(Boolean)
    .join("\n");
  let enviados = 0;
  await Promise.all(
    destinatarios().map(async (d) => {
      try {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${d.telefono}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(d.llave)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) enviados++;
        else console.error("[avisosEquipo] WhatsApp falló:", res.status);
      } catch (err) {
        console.error("[avisosEquipo] WhatsApp falló:", err instanceof Error ? err.message : err);
      }
    })
  );
  return enviados;
}
