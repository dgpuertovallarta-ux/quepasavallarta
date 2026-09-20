"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AHORA } from "@/lib/data";
import {
  fetchCurrentWeather,
  fetchCurrentAirQuality,
  fetchCurrentWaveHeight,
  type WeatherNow,
  type AirQualityNow,
  type WaveNow,
} from "@/lib/ahora/weather";

/**
 * Solo muestra datos reales (Open-Meteo, sin costo): clima, oleaje y
 * calidad del aire. Tránsito/aeropuerto/cruceros se quitaron por
 * completo — decisión del propietario de no mostrar nada de relleno
 * mientras no exista una fuente real conectada para esos (requieren
 * Google Maps / AviationStack / API de puerto — ver /docs/ARCHITECTURE.md).
 */
export default function AhoraStrip({ compact }: { compact?: boolean }) {
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityNow | null>(null);
  const [wave, setWave] = useState<WaveNow | null>(null);

  useEffect(() => {
    fetchCurrentWeather().then(setWeather);
    fetchCurrentAirQuality().then(setAirQuality);
    fetchCurrentWaveHeight().then(setWave);
  }, []);

  const tiles = Object.entries(AHORA).map(([key, t]) => {
    if (key === "clima" && weather) {
      return { ...t, key, value: `${weather.tempC}°C · ${weather.description}` };
    }
    if (key === "calidadAire" && airQuality) {
      return { ...t, key, value: `${airQuality.aqi} · ${airQuality.label}` };
    }
    if (key === "playas" && wave) {
      return { ...t, key, value: `${wave.heightM} m de oleaje` };
    }
    return { ...t, key };
  });

  return (
    <div className="ahora-strip surface-dark">
      <div className="ahora-strip-head">
        <div className="ahora-strip-title">
          <span className="live-dot" /> VALLARTA AHORA <span className="chip chip-verified">En vivo</span>
        </div>
        {compact && (
          <Link href="/ahora" style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>
            Panel completo →
          </Link>
        )}
      </div>
      <div className="ahora-grid">
        {tiles.map((t) => (
          <div className="ahora-tile" key={t.label}>
            <span className="ahora-tile-label">{t.icon} {t.label}</span>
            <span className="ahora-tile-value">{t.value}</span>
            <span className="ahora-tile-sub">{t.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
