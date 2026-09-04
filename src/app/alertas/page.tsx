import Link from "next/link";
import { NEWS } from "@/lib/data";
import { NewsListItem } from "@/components/cards";

export const metadata = { title: "Alertas — Qué Pasa Vallarta" };

export default function AlertasPage() {
  const urgent = NEWS.filter((n) => n.score >= 80);
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Alertas
      </div>
      <h1 style={{ margin: "0 0 6px" }}>🚨 Alertas</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640, marginBottom: 20 }}>
        Información importante y de alto puntaje (News Score ≥ 80). En producción, estas alertas se envían
        por Push, Email, WhatsApp o Telegram según la preferencia del usuario y sin saturar (ver{" "}
        <code>/docs/ARCHITECTURE.md</code> — sección de alertas).
      </p>
      <div className="panel" style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className="chip chip-demo">Demo</span>
        <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Canales de alerta (mock, no funcionales todavía):
        </span>
        <button className="btn btn-outline btn-sm" disabled>
          🔔 Activar Push
        </button>
        <button className="btn btn-outline btn-sm" disabled>
          ✉️ Email
        </button>
        <button className="btn btn-outline btn-sm" disabled>
          💬 WhatsApp
        </button>
      </div>
      <div className="panel">
        {urgent.map((n) => (
          <NewsListItem n={n} key={n.slug} />
        ))}
      </div>
    </div>
  );
}
