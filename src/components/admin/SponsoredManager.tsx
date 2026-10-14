"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SponsoredManager({ items }: { items: { slug: string; sponsor: string; createdAt: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function send(note: string, sponsor: string) {
    const res = await fetch("/api/admin/sponsored", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, sponsor }),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? (json.sponsored ? "Nota marcada como patrocinada." : "Se quitó la marca de patrocinio.") : json.error || "Error");
    router.refresh();
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <strong style={{ fontSize: 14 }}>Notas patrocinadas</strong>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 12px" }}>
        Pega la dirección de una nota pagada: se le pone la etiqueta &ldquo;Patrocinado&rdquo; y el nombre del cliente.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          send(String(f.get("note") || ""), String(f.get("sponsor") || ""));
          e.currentTarget.reset();
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}
      >
        <label className="admin-field" style={{ flex: "1 1 320px" }}>
          Dirección de la nota
          <input name="note" required placeholder="https://quepasavta.com/noticia/…" />
        </label>
        <label className="admin-field">
          Patrocinador
          <input name="sponsor" required maxLength={120} placeholder="Nombre del cliente" />
        </label>
        <button className="btn btn-primary" type="submit">
          Marcar
        </button>
      </form>
      {msg && <p style={{ fontSize: 13, marginTop: 8 }}>{msg}</p>}
      {items.length > 0 && (
        <table className="data-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Nota</th>
              <th>Patrocinador</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.slug}>
                <td>
                  <a href={`/noticia/${i.slug}`} target="_blank" rel="noreferrer">
                    {i.slug}
                  </a>
                </td>
                <td>{i.sponsor}</td>
                <td>
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => send(i.slug, "")}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
