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

const TRAFFIC_STATES = ["Fluido", "Moderado", "Denso"];

export default function AhoraStrip({ compact }: { compact?: boolean }) {
  const [trafficIdx, setTrafficIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityNow | null>(null);
  const [wave, setWave] = useState<WaveNow | null>(null);

  // Clima, calidad del aire y oleaje reales (Open-Meteo, sin API key) —
  // tránsito/aeropuerto/cruceros siguen en demo porque no hay un
  // equivalente gratuito (requieren Google Maps, AviationStack, etc.).
  useEffect(() => {
    fetchCurrentWeather().then(setWeather);
    fetchCurrentAirQuality().then(setAirQuality);
    fetchCurrentWaveHeight().then(setWave);
  }, []);

  // Microinteracción de ejemplo: el dato de tránsito cambia de estado cada
  // cierto tiempo con una transición suave — así se ve cómo se sentiría un
  // dato realmente vivo. Claramente marcado como demo (no hay feed real).
  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setTrafficIdx((i) => (i + 1) % TRAFFIC_STATES.length);
        setFading(false);
      }, 220);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  const tiles = Object.entries(AHORA).map(([key, t]) => {
    if (key === "clima" && weather) {
      return { ...t, key, value: `${weather.tempC}°C · ${weather.description}`, demo: false, sub: "Open-Meteo, en vivo" };
    }
    if (key === "calidadAire" && airQuality) {
      return { ...t, key, value: `${airQuality.aqi} · ${airQuality.label}`, demo: false, sub: "Índice AQI (Open-Meteo), en vivo" };
    }
    if (key === "playas" && wave) {
      return { ...t, key, value: `${wave.heightM} m de oleaje`, demo: false, sub: "Open-Meteo Marine, en vivo" };
    }
    return { ...t, key };
  });
  const anyReal = tiles.some((t) => !t.demo);

  return (
    <div className="ahora-strip surface-dark">
      <div className="ahora-strip-head">
        <div className="ahora-strip-title">
          <span className="live-dot" /> VALLARTA AHORA{" "}
          <span className="chip chip-demo">{anyReal ? "Clima, aire y oleaje en vivo · resto demo" : "Demo — datos de ejemplo"}</span>
        </div>
        {compact && (
          <Link href="/ahora" style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>
            Panel completo →
          </Link>
        )}
      </div>
      <div className="ahora-grid">
        {tiles.map((t) => {
          const isTraffic = t.key === "trafico";
          return (
            <div className="ahora-tile" key={t.label}>
              <span className="ahora-tile-label">{t.icon} {t.label}</span>
              <span className="ahora-tile-value ahora-value-transition">
                <span className={fading && isTraffic ? "" : "ahora-value-fade"} key={isTraffic ? trafficIdx : t.label}>
                  {isTraffic ? TRAFFIC_STATES[trafficIdx] : t.value}
                </span>
              </span>
              <span className="ahora-tile-sub">
                {t.demo && <span className="chip chip-demo">Demo</span>} {t.sub}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
