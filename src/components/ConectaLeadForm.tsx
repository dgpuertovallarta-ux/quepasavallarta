"use client";

import { showToast } from "./Toast";

export default function ConectaLeadForm() {
  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        showToast("Demo: lead capturado (no se envía a ningún servidor real).");
        (e.target as HTMLFormElement).reset();
      }}
    >
      <input className="search-input-lg" style={{ maxWidth: 220 }} placeholder="Nombre del negocio" required />
      <input className="search-input-lg" style={{ maxWidth: 220 }} placeholder="WhatsApp" required />
      <button className="btn btn-primary" type="submit">
        Solicitar información
      </button>
    </form>
  );
}
