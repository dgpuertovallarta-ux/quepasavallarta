/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- se dibuja con next/og (satori), no en el navegador */
// Plantillas de publicación QPV (1080 × 1350) para Facebook/Instagram.
// Compatible con next/og (satori): solo flexbox y estilos en línea — ver node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md
import React from "react";

export const COLORES = { navy: "#0A1F3A", teal: "#14B8B0", red: "#D7262E", amber: "#FFC21A", white: "#FFFFFF" };
export const ANCHO = 1080;
export const ALTO = 1350;

export type Plantilla = "estandar" | "ultimahora" | "tarjeta" | "alerta" | "mapa" | "explicador" | "marco" | "foto";

export type MapaTiles = {
  tiles: { src: string; x: number; y: number }[]; // posiciones en px dentro del área del mapa
  tamTile: number;
  pin: { x: number; y: number };
  overlay?: { src: string; x: number; y: number }[]; // capa de tráfico (TomTom), opcional
};

export type DatosTarjeta = {
  plantilla: Plantilla;
  titulo: string;
  etiqueta: string;          // "SEGURIDAD", "QPV AL VOLANTE", ...
  credito?: string;          // "Foto: SEAPAL Vallarta" / "Imagen de archivo"
  foto?: string;             // url o data URI
  fotoCirculo?: string;      // segundo ángulo para ÚLTIMA HORA
  detalle?: string;          // línea secundaria (tarjeta/alerta/mapa): horario, colonias, retraso
  accion?: string;           // alerta: "Emergencias: 911"
  lugar?: string;            // mapa: "Puente del Ameca"
  mapa?: MapaTiles;
  logo?: string;             // data URI del logo QPV en blanco; si falta, se usa el texto
  texto?: string;            // explicador: párrafo corto; las palabras entre **asteriscos** se resaltan
  lamina?: string;           // explicador: "1/5" para carruseles
  logoAzul?: string;         // explicador (fondo claro): logo QPV en azul
};

const F = { titular: "Archivo Narrow", base: "Archivo" };

// Color de acento por sección para la tarjeta sin foto.
const ACENTOS: Record<string, string> = {
  SEGURIDAD: COLORES.red,
  ACCIDENTE: "#F26B1D",
  "PROTECCIÓN CIVIL": COLORES.amber,
  "QPV AL VOLANTE": COLORES.amber,
  SERVICIOS: "#2E8BFF",
  GOBIERNO: "#8B6CFF",
  COMUNIDAD: COLORES.teal,
  "DENUNCIA CIUDADANA": COLORES.red,
  "PUERTO VALLARTA": COLORES.teal,
};

function fechaCorta() {
  return new Date()
    .toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric" })
    .replace(/\./g, "")
    .toUpperCase();
}

function recortar(t: string, max: number) {
  const s = t.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
}

// Logo QPV (public/qpv-logo-blanco.png, proporción 900×383). Si no se pasa, se usa el texto.
function Logo({ logo, size = 40 }: { logo?: string; size?: number }) {
  if (logo) {
    const h = size * 1.5;
    return <img src={logo} width={Math.round((h * 900) / 383)} height={h} style={{ width: Math.round((h * 900) / 383), height: h }} />;
  }
  return (
    <div style={{ display: "flex", color: COLORES.white, fontFamily: F.titular, fontWeight: 700, fontSize: size * 1.05, letterSpacing: 0.5 }}>QPV</div>
  );
}

function Etiqueta({ texto, fondo = COLORES.teal, color = COLORES.white }: { texto: string; fondo?: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignSelf: "flex-start", background: fondo, color, fontFamily: F.base, fontWeight: 800, fontSize: 28, letterSpacing: 3, padding: "10px 18px" }}>
      {texto}
    </div>
  );
}

// El tamaño del titular se ajusta al largo para que siempre quepa.
function tamTitular(t: string, base: number) {
  const n = t.length;
  if (n <= 50) return base * 1.12;
  if (n <= 75) return base;
  if (n <= 100) return base * 0.85;
  return base * 0.72;
}

function Titular({ texto, base = 92 }: { texto: string; base?: number }) {
  return (
    <div style={{ display: "flex", color: COLORES.white, fontFamily: F.titular, fontWeight: 700, fontSize: tamTitular(texto, base), lineHeight: 1.02, letterSpacing: -0.5 }}>
      {texto}
    </div>
  );
}

const Credito = ({ t, style = {} }: { t?: string; style?: React.CSSProperties }) =>
  t ? <div style={{ display: "flex", color: "rgba(255,255,255,0.72)", fontFamily: F.base, fontWeight: 500, fontSize: 22, letterSpacing: 1, ...style }}>{t}</div> : null;

const Pie = ({ logo, barra = COLORES.teal, credito }: { logo?: string; barra?: string; credito?: string }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 64px 36px 64px" }}>
      <Logo logo={logo} />
      <Credito t={credito ?? "quepasavta.com"} style={{ fontSize: 24 }} />
    </div>
    <div style={{ display: "flex", height: 8, background: barra }} />
  </div>
);

// Texto con palabras resaltadas tipo marcatextos: "La **TSA cobra 45 dólares** si no..."
function Resaltado({ texto, size, color, peso, fondo, colorResalte = COLORES.navy, familia = F.base }: { texto: string; size: number; color: string; peso: number; fondo: string; colorResalte?: string; familia?: string }) {
  const partes: { w: string; on: boolean }[] = [];
  texto.split("**").forEach((seg, i) => {
    const on = i % 2 === 1;
    seg.split(/\s+/).filter(Boolean).forEach((w, j) => {
      // la puntuación pegada (¿?.,:) se une a la palabra anterior para que nunca empiece renglón
      if (j === 0 && !on && /^[?.,:;!)]+$/.test(w) && partes.length) partes[partes.length - 1].w += w;
      else if (j === 0 && !on && /^[?.,:;!)]/.test(w) && partes.length) {
        const m = w.match(/^[?.,:;!)]+/)![0];
        partes[partes.length - 1].w += m;
        partes.push({ w: w.slice(m.length), on });
      } else partes.push({ w, on });
    });
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", fontFamily: familia, fontWeight: peso, fontSize: size, lineHeight: 1.15 }}>
      {partes.map((p, i) => (
        <span key={i} style={{ display: "flex", color: p.on ? colorResalte : color, background: p.on ? fondo : "transparent", padding: p.on ? `0 ${size * 0.14}px` : "0", marginRight: p.on && partes[i + 1]?.on ? 0 : size * 0.26, marginBottom: 6 }}>{p.w}</span>
      ))}
    </div>
  );
}

export function Tarjeta(d: DatosTarjeta) {
  const base: React.CSSProperties = { width: ANCHO, height: ALTO, display: "flex", position: "relative", background: COLORES.navy, overflow: "hidden" };

  if (d.plantilla === "estandar") {
    return (
      <div style={base}>
        {d.foto && <img src={d.foto} width={ANCHO} height={ALTO} style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, objectFit: "cover" }} />}
        <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(6,16,32,0) 35%, rgba(6,16,32,0.8) 62%, rgba(6,16,32,0.97) 100%)" }} />
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 160, display: "flex", flexDirection: "column", gap: 24 }}>
          <Etiqueta texto={d.etiqueta} />
          <Titular texto={d.titulo} />
          <Credito t={d.credito} />
        </div>
        <Pie logo={d.logo} />
      </div>
    );
  }

  if (d.plantilla === "ultimahora") {
    const altoFoto = 830;
    return (
      <div style={{ ...base, background: "#111" }}>
        {d.foto && <img src={d.foto} width={ANCHO} height={altoFoto} style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: altoFoto, objectFit: "cover" }} />}
        <div style={{ position: "absolute", left: 0, right: 0, top: altoFoto, height: 8, display: "flex", background: COLORES.red }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: altoFoto + 8, bottom: 0, display: "flex", background: COLORES.navy }} />
        {d.fotoCirculo && (
          <div style={{ position: "absolute", right: 56, top: altoFoto - 330, width: 300, height: 300, borderRadius: 150, overflow: "hidden", border: "10px solid #fff", display: "flex" }}>
            <img src={d.fotoCirculo} width={300} height={300} style={{ width: 300, height: 300, objectFit: "cover" }} />
          </div>
        )}
        <div style={{ position: "absolute", left: 64, top: 40, display: "flex" }}><Logo logo={d.logo} size={34} /></div>
        <div style={{ position: "absolute", left: 64, right: 64, top: altoFoto + 48, display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ display: "flex", width: 70, height: 6, background: COLORES.red }} />
            <div style={{ display: "flex", color: COLORES.white, fontFamily: F.base, fontWeight: 900, fontSize: 44, letterSpacing: 4 }}>ÚLTIMA HORA</div>
            <div style={{ display: "flex", flexGrow: 1, height: 6, background: COLORES.red }} />
          </div>
          <Titular texto={d.titulo} base={70} />
        </div>
        <Credito t={d.credito} style={{ position: "absolute", right: 64, bottom: 34 }} />
      </div>
    );
  }

  if (d.plantilla === "tarjeta") {
    // Tarjeta tipográfica (nota sin foto propia, 2026-10): nunca foto de otro medio.
    // Color de acento según la sección, titular grande y el dato clave abajo.
    const acento = ACENTOS[d.etiqueta] ?? COLORES.teal;
    const detalle = d.detalle ? recortar(d.detalle, 170) : "";
    return (
      <div style={{ ...base, backgroundImage: `radial-gradient(circle at 90% 8%, ${acento}40, rgba(10,31,58,0) 50%), radial-gradient(circle at 0% 100%, rgba(20,184,176,0.18), rgba(10,31,58,0) 45%)` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 22, height: ALTO, display: "flex", background: acento }} />
        <div style={{ position: "absolute", left: 92, right: 72, top: 84, display: "flex", alignItems: "center", gap: 22 }}>
          <Etiqueta texto={d.etiqueta} fondo={acento} color={acento === COLORES.amber ? COLORES.navy : COLORES.white} />
          <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontFamily: F.base, fontWeight: 800, fontSize: 26, letterSpacing: 3 }}>{fechaCorta()}</div>
        </div>
        <div style={{ position: "absolute", left: 92, right: 72, top: 200, bottom: 190, display: "flex", flexDirection: "column", justifyContent: "center", gap: 46 }}>
          <div style={{ display: "flex", width: 120, height: 10, background: acento }} />
          <Titular texto={d.titulo} base={110} />
          {detalle && (
            <div style={{ display: "flex", borderLeft: `6px solid ${acento}`, paddingLeft: 28, color: "rgba(255,255,255,0.88)", fontFamily: F.base, fontWeight: 500, fontSize: 36, lineHeight: 1.35 }}>
              {detalle}
            </div>
          )}
        </div>
        <div style={{ position: "absolute", left: 92, bottom: 128, display: "flex", color: COLORES.white, fontFamily: F.base, fontWeight: 800, fontSize: 26, letterSpacing: 2 }}>
          NOTA COMPLETA EN QUEPASAVTA.COM
        </div>
        <Pie logo={d.logo} barra={acento} credito={d.credito ?? " "} />
      </div>
    );
  }

  if (d.plantilla === "alerta") {
    return (
      <div style={base}>
        {d.foto && <img src={d.foto} width={ANCHO} height={ALTO} style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, objectFit: "cover" }} />}
        <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(6,16,32,0.1) 20%, rgba(6,16,32,0.85) 60%, rgba(6,16,32,0.97) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 110, display: "flex", alignItems: "center", gap: 22, padding: "0 64px", background: COLORES.amber }}>
          <svg width="58" height="52" viewBox="0 0 58 52"><path d="M29 2 L56 50 H2 Z" fill={COLORES.navy} /><rect x="26" y="18" width="6" height="17" fill={COLORES.amber} /><rect x="26" y="39" width="6" height="6" fill={COLORES.amber} /></svg>
          <div style={{ display: "flex", color: COLORES.navy, fontFamily: F.base, fontWeight: 900, fontSize: 42, letterSpacing: 3 }}>ALERTA · {d.etiqueta}</div>
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 160, display: "flex", flexDirection: "column", gap: 26 }}>
          <Titular texto={d.titulo} base={94} />
          {d.detalle && <div style={{ display: "flex", color: COLORES.white, fontFamily: F.base, fontWeight: 500, fontSize: 32 }}>{d.detalle}</div>}
          {d.accion && <div style={{ display: "flex", alignSelf: "flex-start", background: COLORES.amber, color: COLORES.navy, fontFamily: F.base, fontWeight: 800, fontSize: 30, padding: "10px 18px" }}>{d.accion}</div>}
        </div>
        <Pie logo={d.logo} barra={COLORES.amber} credito={d.credito} />
      </div>
    );
  }

  if (d.plantilla === "explicador") {
    // Estilo explicador (referencia AJ+): fondo claro, foto encuadrada y palabras clave resaltadas. Ideal para carruseles.
    const crema = "#F4EFE4";
    return (
      <div style={{ ...base, background: crema }}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 64, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", background: COLORES.navy, color: COLORES.white, fontFamily: F.base, fontWeight: 800, fontSize: 26, letterSpacing: 3, padding: "8px 16px" }}>{d.etiqueta}</div>
          {d.lamina && <div style={{ display: "flex", color: COLORES.navy, fontFamily: F.base, fontWeight: 800, fontSize: 28 }}>{d.lamina}</div>}
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, top: 150, display: "flex" }}>
          <Resaltado texto={d.titulo} size={tamTitular(d.titulo.replace(/\*/g, ""), 76)} color={COLORES.navy} peso={700} fondo={COLORES.amber} familia={F.titular} />
        </div>
        {d.foto && (
          <div style={{ position: "absolute", left: 64, right: 64, top: 520, height: 470, display: "flex", overflow: "hidden", border: `6px solid ${COLORES.navy}` }}>
            <img src={d.foto} width={940} height={460} style={{ width: 940, height: 460, objectFit: "cover" }} />
          </div>
        )}
        {d.texto && (
          <div style={{ position: "absolute", left: 64, right: 64, top: d.foto ? 1020 : 560, display: "flex" }}>
            <Resaltado texto={d.texto} size={34} color={COLORES.navy} peso={500} fondo={COLORES.amber} />
          </div>
        )}
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {d.logoAzul ? <img src={d.logoAzul} width={141} height={60} style={{ width: 141, height: 60 }} /> : <div style={{ display: "flex", color: COLORES.navy, fontFamily: F.titular, fontWeight: 700, fontSize: 36 }}>QPV</div>}
          {d.credito && <div style={{ display: "flex", color: "rgba(10,31,58,0.6)", fontFamily: F.base, fontWeight: 500, fontSize: 22 }}>{d.credito}</div>}
        </div>
      </div>
    );
  }

  if (d.plantilla === "foto") {
    // Foto real arriba y franja azul QPV abajo con sección y titular (2026-10).
    const altoFoto = 860;
    const colorSeccion = d.etiqueta === "DENUNCIA CIUDADANA" || d.etiqueta === "SEGURIDAD" || d.etiqueta === "ALERTA" || d.etiqueta === "ÚLTIMA HORA" ? COLORES.red : d.etiqueta === "QPV AL VOLANTE" || d.etiqueta === "TRÁNSITO" ? COLORES.amber : COLORES.teal;
    const texto = colorSeccion === COLORES.amber ? COLORES.navy : COLORES.white;
    return (
      <div style={base}>
        {d.foto && <img src={d.foto} width={ANCHO} height={altoFoto} style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: altoFoto, objectFit: "cover" }} />}
        <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: 220, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(6,16,32,0.55), rgba(6,16,32,0))" }} />
        <div style={{ position: "absolute", left: 56, top: 44, display: "flex" }}><Logo logo={d.logo} size={40} /></div>
        {d.credito && (
          <div style={{ position: "absolute", right: 24, top: altoFoto - 44, display: "flex", background: "rgba(6,16,32,0.6)", color: "rgba(255,255,255,0.85)", fontFamily: F.base, fontWeight: 500, fontSize: 20, padding: "5px 12px" }}>{d.credito}</div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, top: altoFoto, height: 10, display: "flex", background: colorSeccion }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: altoFoto + 10, bottom: 0, display: "flex", background: COLORES.navy, backgroundImage: "radial-gradient(circle at 92% 110%, rgba(20,184,176,0.22), rgba(10,31,58,0) 55%)" }} />
        <div style={{ position: "absolute", left: 64, right: 64, top: altoFoto + 44, display: "flex", flexDirection: "column", gap: 22 }}>
          <Etiqueta texto={d.etiqueta} fondo={colorSeccion} color={texto} />
          <Titular texto={d.titulo} base={78} />
        </div>
        <div style={{ position: "absolute", right: 64, bottom: 40, display: "flex", color: "rgba(255,255,255,0.7)", fontFamily: F.base, fontWeight: 800, fontSize: 24, letterSpacing: 1 }}>quepasavta.com</div>
      </div>
    );
  }

  if (d.plantilla === "marco") {
    // Estilo marco (referencia Uno TV): foto completa, marco blanco fino, franja de color lateral, titular en mayúsculas.
    return (
      <div style={base}>
        {d.foto && <img src={d.foto} width={ANCHO} height={ALTO} style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, objectFit: "cover" }} />}
        <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(6,16,32,0) 45%, rgba(6,16,32,0.88) 78%)" }} />
        <div style={{ position: "absolute", left: 40, top: 40, right: 76, bottom: 40, display: "flex", border: "3px solid rgba(255,255,255,0.9)" }} />
        <div style={{ position: "absolute", right: 0, top: 0, width: 36, height: ALTO, display: "flex", background: COLORES.teal }} />
        <div style={{ position: "absolute", left: 88, right: 130, bottom: 150, display: "flex", color: COLORES.white, fontFamily: F.titular, fontWeight: 700, fontSize: tamTitular(d.titulo, 78), lineHeight: 1.02, textTransform: "uppercase" }}>{d.titulo}</div>
        <div style={{ position: "absolute", left: 88, bottom: 76, display: "flex" }}><Logo logo={d.logo} size={30} /></div>
        <Credito t={d.credito} style={{ position: "absolute", right: 130, bottom: 84 }} />
      </div>
    );
  }

  // mapa
  const altoMapa = 760;
  const m = d.mapa;
  return (
    <div style={base}>
      <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: altoMapa, display: "flex", overflow: "hidden", background: "#dfe3e8" }}>
        {m?.tiles.map((t, i) => (
          <img key={"t" + i} src={t.src} width={m.tamTile} height={m.tamTile} style={{ position: "absolute", left: t.x, top: t.y, width: m.tamTile, height: m.tamTile }} />
        ))}
        {m?.overlay?.map((t, i) => (
          <img key={"o" + i} src={t.src} width={m.tamTile} height={m.tamTile} style={{ position: "absolute", left: t.x, top: t.y, width: m.tamTile, height: m.tamTile }} />
        ))}
        <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: altoMapa, display: "flex", background: "rgba(10,31,58,0.12)" }} />
        {m && (
          <div style={{ position: "absolute", left: m.pin.x - 60, top: m.pin.y - 60, width: 120, height: 120, borderRadius: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(215,38,46,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, display: "flex", background: COLORES.red, border: "8px solid #fff" }} />
          </div>
        )}
        {d.lugar && (
          <div style={{ position: "absolute", left: 64, top: 56, display: "flex", background: COLORES.white, color: COLORES.navy, fontFamily: F.base, fontWeight: 800, fontSize: 30, padding: "12px 20px" }}>
            {d.lugar}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: altoMapa, height: 8, display: "flex", background: COLORES.red }} />
      <div style={{ position: "absolute", left: 64, right: 64, top: altoMapa + 50, display: "flex", flexDirection: "column", gap: 22 }}>
        <Etiqueta texto={d.etiqueta} fondo={d.etiqueta === "QPV AL VOLANTE" ? COLORES.amber : COLORES.teal} color={d.etiqueta === "QPV AL VOLANTE" ? COLORES.navy : COLORES.white} />
        <Titular texto={d.titulo} base={72} />
        {d.detalle && <div style={{ display: "flex", color: COLORES.teal, fontFamily: F.base, fontWeight: 800, fontSize: 32 }}>{d.detalle}</div>}
      </div>
      <Pie logo={d.logo} credito={d.credito} />
    </div>
  );
}
