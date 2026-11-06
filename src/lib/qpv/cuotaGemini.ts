/**
 * Cuota de Gemini (2026-11-05).
 *
 * El plan gratuito de Gemini da pocas peticiones al día, pero el límite es POR
 * MODELO: cuando uno se agota, otro modelo gratuito todavía tiene su propia cuota.
 * Por eso cada llamada a la IA pasa por `conGemini`, que prueba los modelos en
 * orden y salta al siguiente cuando uno contesta 429 (cuota agotada) o no existe.
 * Cuando todos están agotados se pausa la IA un rato y se vuelve a probar (la
 * cuota se renueva sola cada día).
 *
 * GEMINI_MODELS (separados por coma) cambia la lista; GEMINI_MODEL, si está,
 * va primero.
 */

const PAUSA_MS = Number(process.env.QPV_PAUSA_CUOTA_MIN || "60") * 60_000;
const NO_EXISTE_MS = 24 * 3_600_000;

const POR_OMISION = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

export function modelosGemini(): string[] {
  const lista = (process.env.GEMINI_MODELS || "").split(",").map((m) => m.trim()).filter(Boolean);
  const base = lista.length ? lista : POR_OMISION;
  const primero = process.env.GEMINI_MODEL?.trim();
  return [...new Set(primero ? [primero, ...base] : base)];
}

const bloqueadoHasta = new Map<string, number>();

/** ¿Este error es de cuota agotada (y no un 503 pasajero)? */
export function esCuotaAgotada(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
}

function noExiste(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b404\b|NOT_FOUND|is not found|not supported for generateContent/i.test(msg);
}

function libre(modelo: string): boolean {
  return Date.now() >= (bloqueadoHasta.get(modelo) ?? 0);
}

/** true cuando ya no queda ningún modelo con cuota (la IA está en pausa). */
export function cuotaAgotada(): boolean {
  return !modelosGemini().some(libre);
}

export class CuotaAgotadaError extends Error {
  constructor() {
    super("Cuota de Gemini agotada en todos los modelos gratuitos: la IA queda en pausa y se reintenta más tarde.");
  }
}

/**
 * Corre `fn` con el primer modelo que tenga cuota; si se agota o no existe,
 * pasa al siguiente. Cualquier otro error se lanza tal cual.
 */
export async function conGemini<T>(fn: (modelo: string) => Promise<T>): Promise<{ valor: T; modelo: string }> {
  for (const modelo of modelosGemini()) {
    if (!libre(modelo)) continue;
    try {
      return { valor: await fn(modelo), modelo };
    } catch (err) {
      if (esCuotaAgotada(err)) {
        bloqueadoHasta.set(modelo, Date.now() + PAUSA_MS);
        console.warn(`[gemini] ${modelo}: cuota agotada, se pasa al siguiente modelo.`);
        continue;
      }
      if (noExiste(err)) {
        bloqueadoHasta.set(modelo, Date.now() + NO_EXISTE_MS);
        console.warn(`[gemini] ${modelo}: no disponible para esta llave, se pasa al siguiente modelo.`);
        continue;
      }
      throw err;
    }
  }
  throw new CuotaAgotadaError();
}
