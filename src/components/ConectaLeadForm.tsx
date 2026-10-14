"use client";

import { useState } from "react";
import { showToast } from "./Toast";

export default function ConectaLeadForm() {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setSending(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, page: window.location.pathname }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo enviar.");
      form.reset();
      setDone(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p style={{ fontSize: 15, margin: "10px 0 0" }}>
        <strong>¡Gracias!</strong> Recibimos tus datos; te contactamos muy pronto con las opciones para tu negocio.
      </p>
    );
  }

  return (
    <form style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }} onSubmit={onSubmit}>
      <input name="business" className="search-input-lg" style={{ maxWidth: 240 }} placeholder="Nombre del negocio" required minLength={2} maxLength={160} />
      <input name="contact" className="search-input-lg" style={{ maxWidth: 240 }} placeholder="WhatsApp o correo" required minLength={6} maxLength={160} />
      <textarea name="message" className="search-input-lg" style={{ flexBasis: "100%", minHeight: 70 }} placeholder="¿Qué te interesa? (opcional)" maxLength={2000} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
      <button className="btn btn-primary" type="submit" disabled={sending}>
        {sending ? "Enviando…" : "Solicitar información"}
      </button>
    </form>
  );
}
