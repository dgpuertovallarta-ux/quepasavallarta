"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AHORA } from "@/lib/data";

const TRAFFIC_STATES = ["Fluido", "Moderado", "Denso"];

export default function AhoraStrip({ compact }: { compact?: boolean }) {
  const tiles = Object.values(AHORA);
  const [trafficIdx, setTrafficIdx] = useState(0);
  const [fading, setFading] = useState(false);

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

  return (
    <div className="ahora-strip surface-dark">
      <div className="ahora-strip-head">
        <div className="ahora-strip-title">
          <span className="live-dot" /> VALLARTA AHORA <span className="chip chip-demo">Demo — datos de ejemplo</span>
        </div>
        {compact && (
          <Link href="/ahora" style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>
            Panel completo →
          </Link>
        )}
      </div>
      <div className="ahora-grid">
        {tiles.map((t) => {
          const isTraffic = t === AHORA.trafico;
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
