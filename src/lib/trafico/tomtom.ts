// Cliente de TomTom (plan gratuito, sin tarjeta): incidentes y tiempos de ruta con tráfico.
// Cuotas mensuales gratis: Incidents 2,500 · Routing 20,000. Con 1 consulta de incidentes cada 20 min
// (~2,200/mes) y 7 corredores cada 20 min (~15,100/mes) se queda dentro del plan gratuito.
import { BBOX_VALLARTA, type Corredor } from "./corredores";

const KEY = () => {
  const k = process.env.TOMTOM_API_KEY;
  if (!k) throw new Error("Falta TOMTOM_API_KEY");
  return k;
};

export type Incidente = {
  id: string;
  tipo: "accidente" | "cierre" | "obra" | "congestion" | "inundacion" | "carril" | "vehiculo" | "otro";
  descripcion: string;
  de?: string;
  a?: string;
  retrasoMin: number;
  magnitud: number;           // 0 desconocido · 1 menor · 2 moderado · 3 mayor · 4 indefinido (cierres)
  lat: number;
  lon: number;
  inicio?: string;
};

type TomTomIncidente = {
  geometry?: { type?: string; coordinates?: number[] | number[][] };
  properties?: {
    id?: string | number; iconCategory?: number; magnitudeOfDelay?: number; events?: { description?: string }[];
    startTime?: string; from?: string; to?: string; delay?: number;
  };
};
type TomTomRuta = { routes?: { summary?: { travelTimeInSeconds?: number; noTrafficTravelTimeInSeconds?: number; trafficDelayInSeconds?: number } }[] };

const CATEGORIAS: Record<number, Incidente["tipo"]> = {
  1: "accidente", 6: "congestion", 7: "carril", 8: "cierre", 9: "obra", 11: "inundacion", 14: "vehiculo",
};

export async function incidentes(): Promise<Incidente[]> {
  const fields = "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,from,to,length,delay}}}";
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${KEY()}&bbox=${BBOX_VALLARTA}` +
    `&fields=${encodeURIComponent(fields)}&language=es-ES&timeValidityFilter=present`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TomTom incidentes ${r.status}`);
  const j = (await r.json()) as { incidents?: TomTomIncidente[] };
  return (j.incidents ?? []).map((i) => {
    const p = i.properties ?? {};
    const g = i.geometry?.coordinates ?? [];
    const coords = (i.geometry?.type === "Point" ? g : g[Math.floor(g.length / 2)]) as number[] | undefined;
    return {
      id: String(p.id),
      tipo: CATEGORIAS[p.iconCategory ?? 0] ?? "otro",
      descripcion: (p.events ?? []).map((e) => e.description).filter(Boolean).join(" · "),
      de: p.from, a: p.to,
      retrasoMin: Math.round((p.delay ?? 0) / 60),
      magnitud: p.magnitudeOfDelay ?? 0,
      lon: coords?.[0], lat: coords?.[1],
      inicio: p.startTime,
    } as Incidente;
  }).filter((x) => Number.isFinite(x.lat));
}

export type EstadoCorredor = {
  id: string;
  nombre: string;
  minutos: number;        // con tráfico ahora
  minutosLibre: number;   // sin tráfico
  retrasoMin: number;
  nivel: "fluido" | "lento" | "pesado";
};

export async function medirCorredor(c: Corredor): Promise<EstadoCorredor> {
  const ruta = `${c.origen[0]},${c.origen[1]}:${c.destino[0]},${c.destino[1]}`;
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${ruta}/json?key=${KEY()}&traffic=true&computeTravelTimeFor=all&routeType=fastest&travelMode=car`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TomTom ruta ${c.id} ${r.status}`);
  const s = ((await r.json()) as TomTomRuta).routes?.[0]?.summary ?? {};
  const minutos = Math.round((s.travelTimeInSeconds ?? 0) / 60);
  const minutosLibre = Math.round((s.noTrafficTravelTimeInSeconds ?? s.travelTimeInSeconds ?? 0) / 60);
  const retrasoSeg = s.trafficDelayInSeconds ?? Math.max(0, (s.travelTimeInSeconds ?? 0) - (s.noTrafficTravelTimeInSeconds ?? s.travelTimeInSeconds ?? 0));
  const retrasoMin = Math.max(0, Math.round(retrasoSeg / 60));
  const nivel = retrasoMin >= c.umbralMin ? "pesado" : retrasoMin >= Math.ceil(c.umbralMin / 2) ? "lento" : "fluido";
  return { id: c.id, nombre: c.nombre, minutos, minutosLibre, retrasoMin, nivel };
}
