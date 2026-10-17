"use client";

import { useState } from "react";

export default function DenunciaForm() {
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviada">("listo");
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEstado("enviando");
    try {
      const r = await fetch("/api/denuncia", { method: "POST", body: new FormData(e.currentTarget) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "No se pudo enviar.");
      setEstado("enviada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
      setEstado("listo");
    }
  }

  if (estado === "enviada") {
    return (
      <div className="denuncia-ok" role="status">
        <strong>Recibimos tu denuncia.</strong>
        <p>Nuestro equipo la revisa antes de publicarla. Si dejaste un contacto, podríamos escribirte para confirmar algún dato. Gracias por ayudar a que Vallarta esté mejor informada.</p>
      </div>
    );
  }

  return (
    <form className="denuncia-form" onSubmit={enviar}>
      <label htmlFor="d-lugar">¿Dónde pasa? *</label>
      <input id="d-lugar" name="lugar" required maxLength={140} placeholder="Ej. Entrada a la autopista en Bucerías, frente a…" />

      <label htmlFor="d-titulo">Resúmelo en una frase</label>
      <input id="d-titulo" name="titulo" maxLength={110} placeholder="Ej. Usan el acotamiento para brincarse la fila" />

      <label htmlFor="d-texto">Cuéntanos qué pasa *</label>
      <textarea id="d-texto" name="texto" required minLength={40} maxLength={3000} rows={6} placeholder="Qué ves, desde cuándo, a qué hora pasa y a quién afecta." />

      <label htmlFor="d-foto">Foto *</label>
      <input
        id="d-foto"
        name="foto"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        onChange={(e) => {
          const f = e.target.files?.[0];
          setVista(f ? URL.createObjectURL(f) : null);
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {vista && <img src={vista} alt="Vista previa de tu foto" className="denuncia-vista" />}
      <p className="denuncia-nota">Sin caras de menores ni datos personales visibles. Máximo 8 MB.</p>

      <div className="denuncia-fila">
        <div>
          <label htmlFor="d-nombre">Tu nombre (no se publica)</label>
          <input id="d-nombre" name="nombre" maxLength={80} />
        </div>
        <div>
          <label htmlFor="d-contacto">WhatsApp o correo (no se publica)</label>
          <input id="d-contacto" name="contacto" maxLength={140} />
        </div>
      </div>
      <input name="web" tabIndex={-1} autoComplete="off" aria-hidden="true" className="denuncia-trampa" />

      {error && <p className="denuncia-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviar denuncia"}
      </button>
      <p className="denuncia-nota">Todas las denuncias pasan por revisión antes de publicarse. Publicamos tu testimonio, nunca tu nombre ni tu contacto.</p>
    </form>
  );
}
