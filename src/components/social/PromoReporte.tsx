/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- se dibuja con next/og (satori), no en el navegador */
// Anuncio "Manda tu reporte ciudadano" para Facebook (1080 × 1350), 2026-10-24.
// Pieza de campaña, no de nota: titular grande, temas con íconos, 3 pasos,
// botón con la dirección y código QR. Solo flexbox y estilos en línea (satori).
import React from "react";
import { ANCHO, ALTO, COLORES, SelloPatrocinio } from "./Tarjeta";

const F = { titular: "Archivo Narrow", base: "Archivo" };
const ROJO = COLORES.red;

export type DatosPromoReporte = { logo?: string; qr?: string; foto?: string; patrocinio?: { nombre: string; logo?: string } };

// Íconos simples (trazos blancos) para cada tema.
const I = {
  bache: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 8L6 56M44 8l14 48" />
      <path d="M32 10v6M32 24v6" />
      <path d="M20 44c4-6 10-8 14-6 5 2 8 1 11 4-2 6-10 8-16 7-5-1-8-2-9-5z" />
    </svg>
  ),
  basura: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18h36M26 18v-6h12v6M18 18l3 36h22l3-36" />
      <path d="M28 28v18M36 28v18" />
    </svg>
  ),
  agua: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 8C24 22 18 30 18 38a14 14 0 0 0 28 0c0-8-6-16-14-30z" />
      <path d="M26 40a6 6 0 0 0 6 6" />
    </svg>
  ),
  luz: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 42c0-6-8-10-8-20a16 16 0 0 1 32 0c0 10-8 14-8 20z" />
      <path d="M25 50h14M28 57h8" />
    </svg>
  ),
  trafico: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 40l5-14a6 6 0 0 1 6-4h22a6 6 0 0 1 6 4l5 14v10H10z" />
      <circle cx="20" cy="44" r="3" />
      <circle cx="44" cy="44" r="3" />
      <path d="M14 50v6M50 50v6" />
    </svg>
  ),
  seguridad: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 6l20 8v16c0 14-9 22-20 28C21 52 12 44 12 30V14z" />
      <path d="M32 22v14M32 42v2" />
    </svg>
  ),
};

const TEMAS: [keyof typeof I, string][] = [
  ["bache", "Baches"],
  ["basura", "Basura"],
  ["agua", "Agua y drenaje"],
  ["luz", "Alumbrado"],
  ["trafico", "Tráfico"],
  ["seguridad", "Inseguridad"],
];

function Camara({ size = 54 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22h12l5-8h14l5 8h12v30H8z" />
      <circle cx="32" cy="36" r="10" />
    </svg>
  );
}

export function PromoReporte(d: DatosPromoReporte) {
  return (
    <div style={{ width: ANCHO, height: ALTO, display: "flex", position: "relative", background: COLORES.navy, overflow: "hidden" }}>
      {d.foto && <img src={d.foto} width={ANCHO} height={ALTO} style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, objectFit: "cover" }} />}
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, display: "flex",
          backgroundImage: `linear-gradient(180deg, rgba(10,31,58,0.55) 0%, rgba(10,31,58,0.88) 38%, rgba(10,31,58,0.97) 100%), radial-gradient(circle at 88% 12%, rgba(215,38,46,0.55), rgba(10,31,58,0) 45%)`,
        }}
      />

      {/* Franja superior */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 112, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", background: ROJO }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Camara size={50} />
          <div style={{ display: "flex", color: "#fff", fontFamily: F.base, fontWeight: 900, fontSize: 38, letterSpacing: 4 }}>REPORTE CIUDADANO</div>
        </div>
        {d.logo ? <img src={d.logo} width={160} height={68} style={{ width: 160, height: 68 }} /> : <div style={{ display: "flex", color: "#fff", fontFamily: F.titular, fontSize: 48 }}>QPV</div>}
      </div>

      {/* Titular */}
      <div style={{ position: "absolute", left: 64, right: 64, top: 160, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", color: "#fff", fontFamily: F.titular, fontWeight: 700, fontSize: 104, lineHeight: 0.98, letterSpacing: -1 }}>¿VISTE ALGO EN</div>
        <div style={{ display: "flex", color: "#fff", fontFamily: F.titular, fontWeight: 700, fontSize: 104, lineHeight: 0.98, letterSpacing: -1 }}>TU COLONIA?</div>
        <div style={{ display: "flex", marginTop: 14 }}>
          <div style={{ display: "flex", background: ROJO, color: "#fff", fontFamily: F.titular, fontWeight: 700, fontSize: 116, lineHeight: 1, padding: "6px 26px 12px" }}>REPÓRTALO.</div>
        </div>
        <div style={{ display: "flex", color: "rgba(255,255,255,0.9)", fontFamily: F.base, fontWeight: 500, fontSize: 36, lineHeight: 1.3, marginTop: 22, maxWidth: 900 }}>
          Mándanos tu foto y lo publicamos para que llegue a las autoridades.
        </div>
        <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontFamily: F.base, fontWeight: 500, fontSize: 26, marginTop: 6 }}>
          Saw something? Send us a photo and we&apos;ll publish it.
        </div>
      </div>

      {/* Temas */}
      <div style={{ position: "absolute", left: 64, right: 64, top: 735, display: "flex", flexWrap: "wrap", gap: 18 }}>
        {TEMAS.map(([k, t]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 16, width: 302, height: 96, padding: "0 20px", background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.18)", borderRadius: 18 }}>
            <div style={{ display: "flex", width: 64, height: 64 }}>{I[k]}</div>
            <div style={{ display: "flex", color: "#fff", fontFamily: F.base, fontWeight: 800, fontSize: 28 }}>{t}</div>
          </div>
        ))}
      </div>

      {/* Pasos */}
      <div style={{ position: "absolute", left: 64, right: 64, top: 965, display: "flex", gap: 18 }}>
        {[
          ["1", "Toma la foto"],
          ["2", "Lo revisamos"],
          ["3", "Sale en QPV y Facebook"],
        ].map(([n, t]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: 29, background: "#fff", color: COLORES.navy, fontFamily: F.titular, fontWeight: 700, fontSize: 36 }}>{n}</div>
            <div style={{ display: "flex", color: "#fff", fontFamily: F.base, fontWeight: 700, fontSize: 27, lineHeight: 1.15, flex: 1 }}>{t}</div>
          </div>
        ))}
      </div>

      {/* Llamado */}
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 54, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 16, background: "#fff", borderRadius: 999, padding: "20px 36px" }}>
            <div style={{ display: "flex", color: COLORES.navy, fontFamily: F.base, fontWeight: 900, fontSize: 44 }}>quepasavta.com/reporte</div>
          </div>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.75)", fontFamily: F.base, fontWeight: 600, fontSize: 25, letterSpacing: 0.5 }}>
            Tu nombre y tu contacto nunca se publican.
          </div>
        </div>
        {d.qr && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", background: "#fff", padding: 12, borderRadius: 16 }}>
              <img src={d.qr} width={150} height={150} style={{ width: 150, height: 150 }} />
            </div>
            <div style={{ display: "flex", color: "#fff", fontFamily: F.base, fontWeight: 800, fontSize: 20, letterSpacing: 2 }}>ESCANEA</div>
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, display: "flex", background: ROJO }} />
      <SelloPatrocinio p={d.patrocinio} top={20} right={236} maxLogo={140} alto={50} />
    </div>
  );
}
