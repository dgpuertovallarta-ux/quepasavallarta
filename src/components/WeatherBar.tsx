"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SITE } from "@/lib/data";
import {
  fetchCurrentWeather,
  fetchCurrentAirQuality,
  fetchCurrentWaveHeight,
  type WeatherNow,
  type AirQualityNow,
  type WaveNow,
} from "@/lib/ahora/weather";

function todayLabel() {
  const label = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function aqiTone(aqi: number) {
  if (aqi <= 50) return "";
  if (aqi <= 100) return " mid";
  return " bad";
}

/**
 * Franja de clima de la portada — una sola línea con los mismos datos
 * reales de "Vallarta Ahora" (Open-Meteo): temperatura, estado del
 * tiempo, oleaje y calidad del aire. Lleva al panel completo en /ahora.
 */
export default function WeatherBar() {
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [air, setAir] = useState<AirQualityNow | null>(null);
  const [wave, setWave] = useState<WaveNow | null>(null);

  useEffect(() => {
    fetchCurrentWeather().then(setWeather);
    fetchCurrentAirQuality().then(setAir);
    fetchCurrentWaveHeight().then(setWave);
  }, []);

  return (
    <Link href="/ahora" className="weather-bar" aria-label="Clima en Puerto Vallarta — ver Vallarta Ahora">
      <div className="weather-bar-place">
        <strong suppressHydrationWarning>{todayLabel()}</strong>
        <span>{SITE.city}</span>
      </div>
      <div className="weather-bar-temp">{weather ? `${weather.tempC}°` : "—"}</div>
      <div className="weather-bar-detail">
        <strong>{weather ? weather.description : "Clima ahora"}</strong>
        <span>Oleaje {wave ? `${wave.heightM} m` : "—"}</span>
      </div>
      <div className="weather-bar-air">
        <div className="weather-bar-air-label">
          <strong>Calidad del aire</strong>
          <span>Índice US AQI</span>
        </div>
        <div className="weather-bar-aqi">
          <b>{air ? air.aqi : "—"}</b>
          {air && <span className={`aqi-pill${aqiTone(air.aqi)}`}>{air.label}</span>}
        </div>
      </div>
    </Link>
  );
}
