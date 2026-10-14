// Arma el mapa de la tarjeta a partir de tiles (TomTom si hay llave, si no OpenStreetMap).
// Los tiles se descargan aquí y se pasan como data URI, así la tarjeta no depende de servidores externos al dibujarse.
import type { MapaTiles } from "@/components/social/Tarjeta";

const UA = "QuePasaVallarta/1.0 (+https://quepasavta.com)";

function lonLatATile(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

async function aDataUri(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return `data:${r.headers.get("content-type") ?? "image/png"};base64,${b.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function armarMapa(lat: number, lon: number, zoom = 16, opciones: { ancho?: number; alto?: number; trafico?: boolean } = {}): Promise<MapaTiles> {
  const ancho = opciones.ancho ?? 1080;
  const alto = opciones.alto ?? 760;
  const tam = 256;
  const key = process.env.TOMTOM_API_KEY;
  const c = lonLatATile(lon, lat, zoom);
  // el punto queda un poco arriba del centro para dejar aire al titular
  const pin = { x: ancho / 2, y: alto * 0.48 };
  const x0 = c.x - pin.x / tam;
  const y0 = c.y - pin.y / tam;
  const tiles: MapaTiles["tiles"] = [];
  const overlay: NonNullable<MapaTiles["overlay"]> = [];
  const trabajos: Promise<void>[] = [];
  for (let tx = Math.floor(x0); tx < x0 + ancho / tam; tx++) {
    for (let ty = Math.floor(y0); ty < y0 + alto / tam; ty++) {
      const x = Math.round((tx - x0) * tam), y = Math.round((ty - y0) * tam);
      const base = key
        ? `https://api.tomtom.com/map/1/tile/basic/main/${zoom}/${tx}/${ty}.png?key=${key}&language=es-ES`
        : `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      trabajos.push(aDataUri(base).then((src) => { if (src) tiles.push({ src, x, y }); }));
      if (key && opciones.trafico) {
        const flujo = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${zoom}/${tx}/${ty}.png?key=${key}&thickness=8`;
        trabajos.push(aDataUri(flujo).then((src) => { if (src) overlay.push({ src, x, y }); }));
      }
    }
  }
  await Promise.all(trabajos);
  return { tiles, tamTile: tam, pin, overlay: overlay.length ? overlay : undefined };
}

// Geocodifica "colonia, Puerto Vallarta" con Nominatim (1 consulta por segundo como máximo; se debe cachear).
export async function geocodificar(lugar: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(`${lugar}, Puerto Vallarta, Jalisco, México`);
  // Caja de búsqueda: Bahía de Banderas (Jalisco + Nayarit)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&viewbox=-105.60,20.95,-105.10,20.40&bounded=1`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es" } });
    const j = (await r.json()) as { lat: string; lon: string }[];
    return j[0] ? { lat: +j[0].lat, lon: +j[0].lon } : null;
  } catch {
    return null;
  }
}
