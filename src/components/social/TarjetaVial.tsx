/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- se dibuja con next/og (satori), no en el navegador */
// QPV al Volante — postales de tráfico (1080 × 1350) para Facebook/Instagram.
//   - ReporteVial: postal amarilla de un incidente o vialidad cargada, al momento.
//   - ResumenVial: postal azul con el semáforo de las vialidades (8:00, 14:00, 18:00).
// Compatible con next/og (satori): solo flexbox y estilos en línea.
import React from "react";
import { ANCHO, ALTO, COLORES, SelloPatrocinio } from "./Tarjeta";

const F = { titular: "Archivo Narrow", base: "Archivo" };
// La fuente no trae la flecha "→": se escribe con palabras.
const txt = (t: string) => t.replace(/\s*→\s*/g, " hacia ");
const SEMAFORO = { rojo: COLORES.red, ambar: COLORES.amber, verde: "#1E9E5A" } as const;
export type Semaforo = keyof typeof SEMAFORO;

export type DatosReporteVial = {
  hora: string; // "17:20"
  tipo: string; // "CHOQUE", "TRÁFICO PESADO", "CIERRE"…
  tipoColor?: Semaforo;
  titulo: string;
  lugar?: string;
  datos: { k: string; v: string }[]; // hasta 4
  fuente: string; // "Monitor QPV al Volante · TomTom"
  logoAzul?: string;
};

export type DatosResumenVial = {
  hora: string;
  titulo: string;
  sub: string;
  items: { hora?: string; sem: Semaforo; t: string; d?: string }[]; // hasta 4
  fuente: string;
  logo?: string;
  patrocinio?: { nombre: string; logo?: string };
};

function Logo({ src, color }: { src?: string; color: string }) {
  const h = 90;
  const w = Math.round((h * 900) / 383);
  if (src) return <img src={src} width={w} height={h} style={{ width: w, height: h }} />;
  return <div style={{ display: "flex", color, fontFamily: F.titular, fontWeight: 700, fontSize: 64 }}>QPV</div>;
}

function tamTitular(t: string) {
  const n = t.length;
  if (n <= 32) return 100;
  if (n <= 50) return 88;
  if (n <= 70) return 74;
  return 62;
}

function Ola({ color }: { color: string }) {
  return <div style={{ position: "absolute", right: -160, bottom: -260, width: 900, height: 600, borderRadius: 450, background: color, display: "flex" }} />;
}

export function ReporteVial(d: DatosReporteVial) {
  const navy = COLORES.navy;
  return (
    <div style={{ width: ANCHO, height: ALTO, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: COLORES.amber, color: navy, padding: 72, fontFamily: F.base }}>
      <Ola color="rgba(10,31,58,0.07)" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", background: navy, color: COLORES.amber, fontFamily: F.titular, fontWeight: 700, fontSize: 34, letterSpacing: 2, padding: "12px 22px" }}>QPV AL VOLANTE · REPORTE VIAL</div>
        <div style={{ display: "flex", fontWeight: 900, fontSize: 58 }}>{d.hora}</div>
      </div>
      <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", marginTop: 60, background: SEMAFORO[d.tipoColor ?? "rojo"], color: d.tipoColor === "ambar" ? navy : "#fff", fontWeight: 900, fontSize: 40, letterSpacing: 1.5, padding: "12px 26px" }}>
        <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: d.tipoColor === "ambar" ? navy : "#fff", marginRight: 16 }} />
        {d.tipo}
      </div>
      <div style={{ display: "flex", marginTop: 34, fontWeight: 900, fontSize: tamTitular(d.titulo), lineHeight: 0.98, textTransform: "uppercase" }}>{txt(d.titulo)}</div>
      {d.lugar && (
        <div style={{ display: "flex", marginTop: 30, fontWeight: 800, fontSize: 40, lineHeight: 1.15 }}>
          <div style={{ display: "flex", width: 30, height: 30, borderRadius: 15, background: navy, marginTop: 8, marginRight: 18, flexShrink: 0 }} />
          <div style={{ display: "flex" }}>{txt(d.lugar)}</div>
        </div>
      )}
      {d.datos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 36, borderTop: `5px solid ${navy}`, paddingTop: 22 }}>
          {d.datos.slice(0, 4).map((x) => (
            <div key={x.k} style={{ display: "flex", flexDirection: "column", width: "50%", paddingRight: 30, marginTop: 14 }}>
              <div style={{ display: "flex", fontFamily: F.titular, fontWeight: 700, fontSize: 28, letterSpacing: 2, opacity: 0.75 }}>{x.k.toUpperCase()}</div>
              <div style={{ display: "flex", fontWeight: 900, fontSize: 38, marginTop: 4 }}>{x.v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 64, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Logo src={d.logoAzul} color={navy} />
        <div style={{ display: "flex", maxWidth: 560, textAlign: "right", fontWeight: 800, fontSize: 28, lineHeight: 1.35 }}>{d.fuente}</div>
      </div>
    </div>
  );
}

export function ResumenVial(d: DatosResumenVial) {
  return (
    <div style={{ width: ANCHO, height: ALTO, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: COLORES.navy, color: "#fff", padding: 72, fontFamily: F.base }}>
      <Ola color="rgba(20,184,176,0.08)" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", background: COLORES.amber, color: COLORES.navy, fontFamily: F.titular, fontWeight: 700, fontSize: 34, letterSpacing: 2, padding: "12px 22px" }}>QPV AL VOLANTE</div>
        <div style={{ display: "flex", fontWeight: 900, fontSize: 58 }}>{d.hora}</div>
      </div>
      <div style={{ display: "flex", marginTop: 56, fontWeight: 900, fontSize: 84, lineHeight: 0.98, textTransform: "uppercase" }}>{txt(d.titulo)}</div>
      <div style={{ display: "flex", marginTop: 14, fontWeight: 800, fontSize: 36, color: COLORES.teal }}>{d.sub}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
        {d.items.slice(0, 4).map((x, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", padding: "20px 0", borderTop: "2px solid rgba(255,255,255,0.18)" }}>
            {x.hora && <div style={{ display: "flex", width: 110, flexShrink: 0, fontWeight: 800, fontSize: 32, color: COLORES.amber, marginTop: 3 }}>{x.hora}</div>}
            <div style={{ display: "flex", width: 30, height: 30, borderRadius: 15, background: SEMAFORO[x.sem], flexShrink: 0, marginTop: 8, marginRight: 26 }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontWeight: 900, fontSize: 38, lineHeight: 1.1 }}>{txt(x.t)}</div>
              {x.d && <div style={{ display: "flex", fontWeight: 500, fontSize: 29, opacity: 0.82, marginTop: 6 }}>{x.d}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 64, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Logo src={d.logo} color="#fff" />
        <div style={{ display: "flex", maxWidth: 560, textAlign: "right", fontWeight: 800, fontSize: 28, lineHeight: 1.35, color: "#cfd8e3" }}>{d.fuente}</div>
      </div>
      <SelloPatrocinio p={d.patrocinio} top={1056} right={72} />
    </div>
  );
}
