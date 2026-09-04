import Link from "next/link";

const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "cola", label: "Cola editorial" },
  { id: "fuentes", label: "Fuentes y automatización" },
  { id: "roles", label: "Usuarios y roles" },
  { id: "comercial", label: "Comercial / Leads" },
];

export default function AdminShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Panel editorial{" "}
        <span className="chip chip-verified" style={{ marginLeft: 6 }}>
          Resumen / Cola / Fuentes — datos reales, en vivo
        </span>
      </div>
      <h1 style={{ margin: "0 0 6px" }}>Panel editorial</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 700, marginBottom: 18 }}>
        Resumen, Cola editorial y Fuentes ya consultan el pipeline de ingesta real en cada visita (fuentes
        RSS reales → Story Graph → News Score → clasificación) — no son datos de ejemplo. Lo que todavía no
        está conectado: publicación con un clic (falta autenticación de editor) y persistencia en base de
        datos sin <code>DATABASE_URL</code> configurada. Roles y Comercial siguen siendo vistas de
        referencia. Ver <code>/docs/ARCHITECTURE.md</code> §8 para activar lo que falta.
      </p>
      <div className="admin-shell panel" style={{ padding: 0 }}>
        <div className="admin-side">
          {SECTIONS.map((s) => (
            <Link key={s.id} href={s.id === "resumen" ? "/admin" : `/admin/${s.id}`} className={s.id === active ? "active" : ""}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}
