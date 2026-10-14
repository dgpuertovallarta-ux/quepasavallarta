"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Ad } from "@/lib/business/db";

const SLOT_LABELS: Record<string, string> = {
  home: "Portada",
  article: "Dentro de las notas",
  section: "Secciones",
};

export default function AdManager({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ads", { method: "POST", body: new FormData(form) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo guardar.");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(ad: Ad) {
    await fetch("/api/admin/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ad.id, active: !ad.active }),
    });
    router.refresh();
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <strong style={{ fontSize: 14 }}>Banners</strong>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 12px" }}>
        Sube la imagen del anunciante y elige dónde aparece. Medidas recomendadas: portada 1940 × 250 px, notas y
        secciones 1456 × 180 px. Se cuentan los clics para el reporte. En Protección Civil y en notas de emergencia
        nunca se muestran banners.
      </p>
      <form onSubmit={onCreate} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label className="admin-field">
          Anunciante
          <input name="advertiser" required maxLength={120} placeholder="BYD Puerto Vallarta" />
        </label>
        <label className="admin-field">
          Enlace al hacer clic
          <input name="link" required placeholder="https://… o wa.me/52…" />
        </label>
        <label className="admin-field">
          Dónde
          <select name="slot" defaultValue="home">
            <option value="home">Portada</option>
            <option value="article">Dentro de las notas</option>
            <option value="section">Secciones</option>
          </select>
        </label>
        <label className="admin-field">
          Termina (opcional)
          <input name="endsAt" type="date" />
        </label>
        <label className="admin-field">
          Imagen
          <input name="image" type="file" accept="image/png,image/jpeg,image/gif,image/webp" required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Agregar banner"}
        </button>
      </form>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}

      {ads.length > 0 && (
        <table className="data-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Banner</th>
              <th>Anunciante</th>
              <th>Dónde</th>
              <th>Termina</th>
              <th>Clics</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => (
              <tr key={ad.id} style={{ opacity: ad.active ? 1 : 0.55 }}>
                <td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ad.imageUrl} alt="" style={{ height: 36, maxWidth: 220, objectFit: "contain", display: "block" }} />
                </td>
                <td>
                  {ad.advertiser}
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", wordBreak: "break-all" }}>{ad.linkUrl}</div>
                </td>
                <td>{SLOT_LABELS[ad.slot] || ad.slot}</td>
                <td>{ad.endsAt || "—"}</td>
                <td>{ad.clicks}</td>
                <td>
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => toggle(ad)}>
                    {ad.active ? "Pausar" : "Reactivar"}
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
