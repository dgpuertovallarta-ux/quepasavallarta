/**
 * Ordena y limpia los incidentes de TomTom para el resumen vial (2026-10-26).
 *
 * El propietario notó que el resumen de Facebook salía casi igual siempre
 * (mismo mapa y las mismas 3 vialidades) mientras los cierres y el tráfico
 * pesado que sí se ven en /trafico nunca llegaban a la página. Aquí:
 *  - Se juntan los pares "A → B" y "B → A" del mismo tipo en uno ("ambos sentidos").
 *  - Se limpian los nombres ("Avenida Paraíso (Carretera San Vicente Mezcales)" → "Av. Paraíso").
 *  - Se le pone la zona aproximada (Mezcales, Centro, Bucerías…) por cercanía.
 *  - Se separa lo NUEVO (empezó en las últimas 24 h) de lo que ya lleva días,
 *    para que un cierre de obra de semanas no encabece todos los resúmenes.
 */
import type { Incidente } from "./tomtom";

export type IncidenteResumen = {
  tipo: Incidente["tipo"];
  calle: string;
  hacia?: string;
  ambosSentidos: boolean;
  zona?: string;
  retrasoMin: number;
  nuevo: boolean;
  desde?: string; // "12 oct"
};

const ZONAS: [string, number, number][] = [
  ["Centro", 20.607, -105.235],
  ["Zona Romántica", 20.6, -105.236],
  ["Zona Hotelera", 20.633, -105.232],
  ["Marina Vallarta", 20.66, -105.253],
  ["El Pitillal", 20.648, -105.215],
  ["Las Juntas", 20.687, -105.237],
  ["Ixtapa", 20.705, -105.205],
  ["Nuevo Vallarta", 20.7, -105.295],
  ["Mezcales", 20.74, -105.267],
  ["San Vicente", 20.732, -105.234],
  ["Bucerías", 20.757, -105.334],
  ["La Cruz de Huanacaxtle", 20.748, -105.38],
  ["Mismaloya", 20.531, -105.291],
];

function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = (lat2 - lat1) * 111;
  const dLon = (lon2 - lon1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

export function zonaDe(lat: number, lon: number): string | undefined {
  let mejor: { z: string; d: number } | null = null;
  for (const [z, la, lo] of ZONAS) {
    const d = km(lat, lon, la, lo);
    if (!mejor || d < mejor.d) mejor = { z, d };
  }
  return mejor && mejor.d <= 3 ? mejor.z : undefined;
}

/** "Avenida Paraíso (Carretera San Vicente Mezcales)" → "Av. Paraíso" */
export function limpiarCalle(s?: string): string {
  if (!s) return "";
  let t = s.replace(/\s*\([^)]*\)/g, "").trim();
  t = t.replace(/^MEX-200\s*\/\s*/i, "").replace(/^MEX-200$/i, "Carretera 200");
  t = t
    .replace(/\bAvenida\b/g, "Av.")
    .replace(/\bBoulevard\b/g, "Blvd.")
    .replace(/\bProlongación\b/g, "Prol.")
    .replace(/\bCarretera Puerto Vallarta\s*-\s*Tepic\b/g, "Carretera 200")
    .replace(/\bAv\. Tepic\s*-\s*Puerto Vallarta\b/g, "Carretera 200")
    .replace(/^Calle\s+/, "");
  return t.replace(/\s{2,}/g, " ").trim();
}

const PRIORIDAD: Record<Incidente["tipo"], number> = {
  accidente: 0, inundacion: 1, cierre: 2, congestion: 3, carril: 4, obra: 5, vehiculo: 6, otro: 7,
};

function fechaCorta(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(+d)) return undefined;
  return d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short" }).replace(".", "");
}

export function agruparIncidentes(incs: Incidente[]): IncidenteResumen[] {
  const ahora = Date.now();
  const grupos = new Map<string, IncidenteResumen & { _orden: number }>();
  for (const i of incs) {
    if (i.tipo === "otro") continue;
    const de = limpiarCalle(i.de);
    const a = limpiarCalle(i.a);
    if (!de && !a) continue;
    // Un mismo tramo en sentido contrario es el mismo incidente para el lector.
    const par = [de, a].sort().join("|");
    const clave = `${i.tipo}|${par}`;
    const nuevo = i.inicio ? ahora - new Date(i.inicio).getTime() < 24 * 3_600_000 : false;
    const previo = grupos.get(clave);
    if (previo) {
      if (previo.calle !== de) previo.ambosSentidos = true;
      previo.retrasoMin = Math.max(previo.retrasoMin, i.retrasoMin);
      previo.nuevo = previo.nuevo || nuevo;
      continue;
    }
    // Si "de" y "a" son la misma vía (p. ej. Carretera a Punta de Mita este → oeste), basta una.
    grupos.set(clave, {
      tipo: i.tipo,
      calle: de || a,
      hacia: a && a !== de ? a : undefined,
      ambosSentidos: false,
      zona: zonaDe(i.lat, i.lon),
      retrasoMin: i.retrasoMin,
      nuevo,
      desde: nuevo ? undefined : fechaCorta(i.inicio),
      _orden: PRIORIDAD[i.tipo],
    });
  }
  return [...grupos.values()]
    .sort((x, y) => Number(y.nuevo) - Number(x.nuevo) || x._orden - y._orden || y.retrasoMin - x.retrasoMin)
    .map(({ _orden, ...r }) => (void _orden, r));
}

export const NOMBRE_TIPO: Record<Incidente["tipo"], string> = {
  accidente: "Accidente", cierre: "Cierre", obra: "Obras", congestion: "Tráfico pesado", inundacion: "Inundación",
  carril: "Cierre de carril", vehiculo: "Vehículo descompuesto", otro: "Incidente",
};

const recorta = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** "Blvd. Nayarit y Prol. Independencia" (ambos sentidos) o "Av. Paraíso hacia Carretera 200". */
function tramoDe(r: IncidenteResumen, max = 60): string {
  if (!r.hacia) return recorta(r.calle, max);
  return `${recorta(r.calle, max)} ${r.ambosSentidos ? "y" : "hacia"} ${recorta(r.hacia, max)}`;
}

/** Una línea legible: "Cierre en Av. Alta Vista (Mezcales), ambos sentidos" */
export function lineaIncidente(r: IncidenteResumen): string {
  const tramo = tramoDe(r);
  return [
    `${NOMBRE_TIPO[r.tipo]} en ${tramo}${r.zona ? ` (${r.zona})` : ""}`,
    r.ambosSentidos ? "ambos sentidos" : "",
    r.retrasoMin >= 2 ? `+${r.retrasoMin} min` : "",
  ].filter(Boolean).join(", ");
}

/** Para la postal: renglón principal y detalle. */
export function renglonIncidente(r: IncidenteResumen): { t: string; d: string } {
  const t = tramoDe(r, 30);
  const d = [
    NOMBRE_TIPO[r.tipo],
    r.zona,
    r.ambosSentidos ? "ambos sentidos" : "",
    r.retrasoMin >= 2 ? `+${r.retrasoMin} min` : "",
    r.nuevo ? "nuevo" : r.desde ? `desde el ${r.desde}` : "",
  ].filter(Boolean).join(" · ");
  return { t, d };
}
