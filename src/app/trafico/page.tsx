import Link from "next/link";
import { ultimaInstantanea } from "@/lib/trafico/monitor";
import { CENTRO_MAPA } from "@/lib/trafico/corredores";

export const metadata = {
  title: "QPV al Volante — Tráfico en Puerto Vallarta en vivo",
  description:
    "Cómo está el puente del Ameca, la Medina Ascencio y la carretera 200 en este momento: tiempos de traslado, accidentes, cierres y obras en Puerto Vallarta y Bahía de Banderas.",
};
// El monitor mide cada 20 minutos; la página se rehace cada minuto.
export const revalidate = 60;

const COLOR = { fluido: "#1E9E5A", lento: "#E0A100", pesado: "#D7262E" } as const;
const NIVEL = { fluido: "Fluido", lento: "Lento", pesado: "Pesado" } as const;
const TIPO: Record<string, string> = {
  accidente: "Accidente", cierre: "Cierre", obra: "Obras", congestion: "Tráfico pesado", inundacion: "Inundación",
  carril: "Cierre de carril", vehiculo: "Vehículo descompuesto", otro: "Incidente",
};

export default async function TraficoPage() {
  const s = await ultimaInstantanea();
  const wa = process.env.QPV_WHATSAPP_REPORTES;
  const hora = s?.actualizado
    ? new Date(s.actualizado).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / QPV al Volante
      </div>
      <span className="card-kicker">QPV al Volante</span>
      <h1 style={{ margin: "4px 0 6px" }}>Así está el tráfico en Vallarta ahora</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 680, marginBottom: 22 }}>
        {hora
          ? `Actualizado a las ${hora} h. Se revisa cada 20 minutos.`
          : "El monitor de tráfico se está activando; en unos minutos verás aquí los tiempos de cada vialidad."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <section aria-label="Mapa de tráfico en vivo">
          <iframe
            src={`https://embed.waze.com/es/iframe?zoom=${CENTRO_MAPA.zoom}&lat=${CENTRO_MAPA.lat}&lon=${CENTRO_MAPA.lon}`}
            title="Mapa de tráfico en vivo de Waze"
            style={{ width: "100%", height: 460, border: 0, borderRadius: 12 }}
            allowFullScreen
            loading="lazy"
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Mapa en vivo: Waze</p>
        </section>

        <section aria-label="Corredores e incidentes">
          <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Vialidades principales</h2>
          {!s?.corredores.length && <p style={{ color: "var(--text-muted)" }}>Sin mediciones por ahora.</p>}
          {s?.corredores.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border, rgba(127,127,127,.25))" }}>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, background: COLOR[c.nivel], flex: "none" }} />
              <span style={{ flex: 1 }}>{c.nombre}</span>
              <strong>{c.minutos} min</strong>
              <span style={{ color: COLOR[c.nivel], fontWeight: 700, minWidth: 60, textAlign: "right" }}>
                {c.retrasoMin > 0 ? `+${c.retrasoMin}` : NIVEL[c.nivel]}
              </span>
            </div>
          ))}

          <h2 style={{ fontSize: 20, margin: "24px 0 8px" }}>Incidentes</h2>
          {!s?.incidentes.length && <p style={{ color: "var(--text-muted)" }}>No hay incidentes reportados.</p>}
          {s?.incidentes.slice(0, 12).map((i) => (
            <div key={i.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border, rgba(127,127,127,.25))" }}>
              <strong style={{ color: i.tipo === "accidente" || i.tipo === "cierre" ? COLOR.pesado : undefined }}>{TIPO[i.tipo] ?? "Incidente"}</strong>
              {i.de && <span> · {i.de}{i.a && i.a !== i.de ? ` → ${i.a}` : ""}</span>}
              {i.retrasoMin > 0 && <span style={{ color: "var(--text-muted)" }}> · +{i.retrasoMin} min</span>}
            </div>
          ))}

          {wa && (
            <a
              className="btn btn-primary"
              style={{ display: "block", textAlign: "center", marginTop: 20 }}
              href={`https://wa.me/${wa}?text=${encodeURIComponent("Reporte QPV al Volante: ")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Envía tu reporte de tráfico por WhatsApp
            </a>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
            Tiempos e incidentes: TomTom Traffic. Pueden tener unos minutos de retraso. Emergencias: 911.
          </p>
        </section>
      </div>
    </div>
  );
}
