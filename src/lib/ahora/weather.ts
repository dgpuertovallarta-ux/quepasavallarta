/**
 * Clima y calidad del aire REALES para Puerto Vallarta, vía Open-Meteo
 * (open-meteo.com) — API pública, gratuita, sin necesidad de cuenta ni
 * API key. Se llama directo desde el navegador (Open-Meteo permite CORS).
 *
 * El resto de los widgets de "Vallarta Ahora" (tránsito, aeropuerto,
 * cruceros, oleaje) siguen en demo porque no existe un equivalente
 * gratuito/sin cuenta — requieren una API de pago o con registro que el
 * propietario tendría que contratar (Google Maps, AviationStack, etc.).
 */

const PV_LAT = 20.6534;
const PV_LON = -105.2253;

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina",
  51: "Llovizna ligera",
  53: "Llovizna",
  55: "Llovizna intensa",
  56: "Llovizna helada",
  57: "Llovizna helada intensa",
  61: "Lluvia ligera",
  63: "Lluvia",
  65: "Lluvia intensa",
  66: "Lluvia helada",
  67: "Lluvia helada intensa",
  71: "Nieve ligera",
  73: "Nieve",
  75: "Nieve intensa",
  80: "Chubascos ligeros",
  81: "Chubascos",
  82: "Chubascos fuertes",
  95: "Tormenta eléctrica",
  96: "Tormenta con granizo",
  99: "Tormenta fuerte con granizo",
};

export type WeatherNow = { tempC: number; description: string };

export async function fetchCurrentWeather(): Promise<WeatherNow | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${PV_LAT}&longitude=${PV_LON}&current=temperature_2m,weather_code&timezone=America%2FMexico_City`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== "number") return null;
    return { tempC: Math.round(temp), description: WEATHER_CODE_LABELS[code] ?? "—" };
  } catch {
    return null;
  }
}

export type AirQualityNow = { aqi: number; label: string };

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Buena";
  if (aqi <= 100) return "Moderada";
  if (aqi <= 150) return "Dañina (sensibles)";
  if (aqi <= 200) return "Dañina";
  return "Muy dañina";
}

export async function fetchCurrentAirQuality(): Promise<AirQualityNow | null> {
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${PV_LAT}&longitude=${PV_LON}&current=us_aqi&timezone=America%2FMexico_City`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const aqi = data?.current?.us_aqi;
    if (typeof aqi !== "number") return null;
    return { aqi: Math.round(aqi), label: aqiLabel(aqi) };
  } catch {
    return null;
  }
}
