/**
 * Freno de cuota de Gemini (2026-11-05).
 *
 * El plan gratuito de Gemini da muy pocas peticiones al día. Cuando se acaban,
 * Google contesta 429 RESOURCE_EXHAUSTED y el robot seguía pidiendo (redacción,
 * traducción, búsqueda de fotos), gastando reintentos y llenando el registro de
 * errores sin publicar nada. Ahora, al primer 429 de cuota se deja de llamar a
 * Gemini por un rato y se vuelve a probar después (la cuota se renueva sola).
 */

const PAUSA_MS = Number(process.env.QPV_PAUSA_CUOTA_MIN || "60") * 60_000;
let agotadaHasta = 0;

/** ¿Este error es de cuota agotada (y no un 503 pasajero)? */
export function esCuotaAgotada(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
}

export function marcarCuotaAgotada(): void {
  if (Date.now() >= agotadaHasta) {
    console.warn(
      `[gemini] cuota agotada: se pausa la IA ${Math.round(PAUSA_MS / 60_000)} min. ` +
        "Si pasa seguido, hay que activar la facturación de la llave de Gemini (plan de pago)."
    );
  }
  agotadaHasta = Date.now() + PAUSA_MS;
}

/** true mientras dura la pausa por cuota agotada. */
export function cuotaAgotada(): boolean {
  return Date.now() < agotadaHasta;
}
