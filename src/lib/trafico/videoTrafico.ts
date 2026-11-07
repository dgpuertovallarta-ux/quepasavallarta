/**
 * Videos de tráfico «QPV al Volante» (2026-11-06).
 *
 * El robot arma los datos (corredores medidos con TomTom e incidentes) y lanza el
 * flujo de GitHub `traffic-video.yml`, que genera el video vertical con voz y mapa
 * (scripts/traffic-video/generate.py) y lo publica como reel en Facebook.
 *
 *   - Resumen: a las 7, 14 y 18 h, en lugar de la postal azul.
 *   - Urgente: accidente nuevo cerca de un corredor principal (máx. uno por hora,
 *     de 6 a. m. a 11 p. m., una sola vez por incidente).
 *
 * QPV_TRAFICO_VIDEO=0 vuelve a la postal y apaga los urgentes.
 */
import { CORREDORES } from "./corredores";
import type { EstadoCorredor, Incidente } from "./tomtom";
import { agruparIncidentes, limpiarCalle, renglonIncidente } from "./resumen";

export const VIDEO_TRAFICO_ACTIVO = process.env.QPV_TRAFICO_VIDEO !== "0";

const KM_CERCA = 1.2;
const MIN_ENTRE_URGENTES = 60;

async function lanzar(datos: unknown): Promise<boolean> {
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    console.warn("[videoTrafico] falta REPO/GH_TOKEN: no se puede lanzar el video");
    return false;
  }
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/traffic-video.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "QPV-Robot" },
    body: JSON.stringify({ ref: "main", inputs: { datos: JSON.stringify(datos) } }),
  }).catch((e) => {
    console.warn("[videoTrafico] no se pudo lanzar:", e);
    return null;
  });
  if (!r?.ok) console.warn("[videoTrafico] GitHub contestó", r?.status, await r?.text().catch(() => ""));
  return !!r?.ok;
}

function corredoresDatos(corredores: EstadoCorredor[]) {
  return corredores.map((c) => {
    const def = CORREDORES.find((x) => x.id === c.id);
    return { ...c, origen: def?.origen, destino: def?.destino };
  });
}

/** Video del resumen de las 7, 14 y 18 h. Devuelve false si no se pudo lanzar (sale la postal). */
export async function lanzarVideoResumen(corredores: EstadoCorredor[], incs: Incidente[]): Promise<boolean> {
  const agrupados = agruparIncidentes(incs).filter((r) => r.tipo !== "vehiculo");
  const elegidos = [...agrupados.filter((r) => r.nuevo), ...agrupados.filter((r) => !r.nuevo)].slice(0, 3);
  const incidentes = [
    ...elegidos.map((r) => {
      const { t, d } = renglonIncidente(r);
      return { tipo: r.tipo, calle: r.calle, texto: d ? `${t} · ${d}` : t };
    }),
  ];
  // Puntos en el mapa: los accidentes y cierres con coordenadas (TomTom).
  const puntos = incs
    .filter((i) => ["accidente", "cierre", "obra", "inundacion"].includes(i.tipo))
    .slice(0, 8)
    .map((i) => ({ tipo: i.tipo, calle: limpiarCalle(i.de) || "", texto: "", lat: i.lat, lon: i.lon }));
  return lanzar({
    tipo: "resumen",
    hora: new Date().toISOString(),
    corredores: corredoresDatos(corredores),
    incidentes: [...incidentes, ...puntos.map((p) => ({ ...p, soloMapa: true }))],
  });
}

// ---------------------------------------------------------------- urgentes

function kmAlSegmento(lat: number, lon: number, a: [number, number], b: [number, number]): number {
  const k = 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const px = lon * k * cos, py = lat * k;
  const ax = a[1] * k * cos, ay = a[0] * k, bx = b[1] * k * cos, by = b[0] * k;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function corredorCercano(i: Incidente): string | null {
  for (const c of CORREDORES) if (kmAlSegmento(i.lat, i.lon, c.origen, c.destino) <= KM_CERCA) return c.id;
  return null;
}

/** Accidente que amerita video urgente (o null). */
export function accidenteUrgente(incs: Incidente[], yaAvisado: (id: string) => boolean): Incidente | null {
  const ahora = Date.now();
  const cand = incs
    .filter((i) => i.tipo === "accidente")
    .filter((i) => !i.inicio || ahora - new Date(i.inicio).getTime() < 90 * 60_000)
    .filter((i) => i.magnitud >= 2 || i.retrasoMin >= 3)
    .filter((i) => corredorCercano(i) && !yaAvisado(i.id))
    .sort((a, b) => b.retrasoMin - a.retrasoMin || b.magnitud - a.magnitud);
  return cand[0] ?? null;
}

let ultimoUrgente = 0;

export function puedeLanzarUrgente(horaLocal: number, ultimoGuardado?: string): boolean {
  if (horaLocal < 6 || horaLocal >= 23) return false;
  const ultimo = Math.max(ultimoUrgente, ultimoGuardado ? new Date(ultimoGuardado).getTime() : 0);
  return Date.now() - ultimo >= MIN_ENTRE_URGENTES * 60_000;
}

export async function lanzarVideoUrgente(i: Incidente): Promise<boolean> {
  ultimoUrgente = Date.now();
  const calle = limpiarCalle(i.de) || limpiarCalle(i.a) || "una vialidad de Vallarta";
  const cruce = i.de && i.a ? limpiarCalle(i.a) : "";
  return lanzar({
    tipo: "urgente",
    hora: new Date().toISOString(),
    corredores: [],
    incidentes: [],
    urgente: {
      id: String(i.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || String(Date.now()),
      etiqueta: "ACCIDENTE",
      tipoTexto: "accidente",
      calle,
      cruce: cruce && cruce !== calle ? cruce : "",
      retrasoMin: i.retrasoMin || 0,
      lat: i.lat,
      lon: i.lon,
    },
  });
}
