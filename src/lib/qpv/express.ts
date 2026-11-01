/**
 * Notas «express» (pedido del propietario, 2026-10-31): las que hablan de
 * ciertas personas salen sin esperar.
 *
 *   - Ingesta: se redactan antes que las demás, aunque solo las reporte una
 *     fuente, y se publican directo en el sitio (no pasan a Reportes).
 *   - Cola de Facebook: entran como urgentes (no esperan los 40 min entre
 *     publicaciones ni el horario de 7 a 23 h).
 *   - Solo las positivas o neutrales. Si la nota trae señales de crítica
 *     (denuncia, polémica, protesta…) siempre va a Reportes para revisión.
 *
 * Para agregar o quitar nombres sin tocar el código: variable
 * QPV_EXPRESS en el flujo del robot, separados por coma.
 */

const POR_OMISION = ["Diego Franco"];

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function nombres(): string[] {
  const extra = (process.env.QPV_EXPRESS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return (extra.length ? extra : POR_OMISION).map(sinAcentos);
}

/** ¿El texto menciona a alguna de las personas «express»? */
export function mencionaExpress(texto: string): boolean {
  const t = sinAcentos(texto).replace(/\s+/g, " ");
  return nombres().some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}\\b`).test(t));
}

// Señales de una nota crítica o negativa. Esas NO salen express: van a
// Reportes para que la redacción las revise antes de publicar. El robot no
// cambia el tono de ninguna nota; solo decide qué tan rápido sale.
const NEGATIVAS = [
  "denuncia", "acusa", "acusacion", "critica", "polemic", "escandalo", "investigacion", "investigan",
  "corrupcion", "demanda", "protesta", "manifestacion", "cuestiona", "senala", "fraude", "irregular",
  "desvio", "sancion", "multa", "detenid", "abuche", "rechaz", "reclam", "inconform", "crisis",
  "falla", "deuda", "opacidad", "conflicto", "renuncia", "destitu", "queja", "molestia", "abandono",
  "negligencia", "nepotismo", "viola", "ilegal", "amenaza", "agresion", "pelea", "exige", "exigen",
];

/** Menciona a una persona «express» y no trae señales de nota negativa. */
export function esExpress(texto: string): boolean {
  if (!mencionaExpress(texto)) return false;
  const t = sinAcentos(texto);
  return !NEGATIVAS.some((p) => new RegExp(`\\b${p}`).test(t));
}
