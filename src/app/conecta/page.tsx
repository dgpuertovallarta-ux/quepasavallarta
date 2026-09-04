import Link from "next/link";
import { BUSINESS_PLANS } from "@/lib/data";
import ConectaLeadForm from "@/components/ConectaLeadForm";

export const metadata = { title: "Vallarta Conecta — para negocios" };

export default function ConectaPage() {
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Vallarta Conecta
      </div>
      <div className="article-head">
        <span className="chip chip-sponsor">Para negocios</span>
        <h1>💼 Vallarta Conecta</h1>
        <p className="article-dek">
          Visibilidad, audiencia y leads reales en Puerto Vallarta. No vendemos &ldquo;un banner&rdquo;:
          vendemos resultados medibles.
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 30 }}>
        {BUSINESS_PLANS.map((p) => (
          <div className="panel" key={p.id}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{p.name}</h3>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 12px" }}>{p.desc}</p>
            <span className="chip chip-demo">Precio: configurable</span>
          </div>
        ))}
      </div>

      <div className="panel" style={{ maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>¿Qué incluye un perfil Vallarta Conecta?</h3>
        <ul style={{ fontSize: 14.5, color: "var(--text)", lineHeight: 1.8 }}>
          <li>Ficha con logo, fotos, ubicación en mapa, horarios y descripción</li>
          <li>Botón directo de WhatsApp y llamada</li>
          <li>Aparición en Vallarta Guía y, en planes superiores, en Home / Agenda</li>
          <li>Estadísticas de impresiones, clics y contactos generados</li>
          <li>Posibilidad de contenido patrocinado (&ldquo;Vallarta Presenta&rdquo;) y patrocinio de sección</li>
        </ul>
      </div>

      <div className="panel" style={{ maxWidth: 720, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>¿Te interesa? Escríbenos</h3>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Este formulario es una demostración de interfaz — en producción se conecta al CRM comercial (ver{" "}
          <code>/docs/MONETIZATION.md</code>).
        </p>
        <ConectaLeadForm />
      </div>
    </div>
  );
}
