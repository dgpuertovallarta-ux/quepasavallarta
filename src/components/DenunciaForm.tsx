"use client";

import { useState } from "react";

export default function DenunciaForm() {
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviada">("listo");
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [ubic, setUbic] = useState<{ lat: number; lon: number } | null>(null);
  const [ubicMsg, setUbicMsg] = useState<string | null>(null);

  function usarUbicacion() {
    if (!navigator.geolocation) return setUbicMsg("Tu teléfono no permite compartir ubicación.");
    setUbicMsg("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUbic({ lat: p.coords.latitude, lon: p.coords.longitude });
        setUbicMsg("Ubicación agregada ✓ (solo la ve nuestro equipo)");
      },
      () => setUbicMsg("No se pudo obtener la ubicación. Escribe la dirección arriba."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

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
        <strong>Recibimos tu reporte.</strong>
        <p>Nuestro equipo lo revisa antes de publicarlo. Si dejaste un contacto, podríamos escribirte para confirmar algún dato. Gracias por ayudar a que Vallarta esté mejor informada.</p>
      </div>
    );
  }

  return (
    <form className="denuncia-form" onSubmit={enviar}>
      <label htmlFor="d-tipo">¿Qué quieres reportar? *</label>
      <select id="d-tipo" name="tipo" required defaultValue="">
        <option value="" disabled>Escoge una opción</option>
        <option value="bache">Bache o calle dañada</option>
        <option value="basura">Basura</option>
        <option value="agua">Agua o drenaje</option>
        <option value="luz">Alumbrado o luz</option>
        <option value="transito">Tráfico o vialidad</option>
        <option value="seguridad">Inseguridad</option>
        <option value="abuso">Abuso en vía pública</option>
        <option value="otro">Otro</option>
      </select>

      <label htmlFor="d-lugar">¿Dónde pasa? *</label>
      <input id="d-lugar" name="lugar" required maxLength={140} placeholder="Ej. Entrada a la autopista en Bucerías, frente a…" />
      <button type="button" className="btn denuncia-ubic" onClick={usarUbicacion}>📍 Usar mi ubicación</button>
      {ubicMsg && <p className="denuncia-nota">{ubicMsg}</p>}
      {ubic && (
        <>
          <input type="hidden" name="lat" value={ubic.lat} />
          <input type="hidden" name="lon" value={ubic.lon} />
        </>
      )}

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
        {estado === "enviando" ? "Enviando…" : "Enviar reporte"}
      </button>
      <p className="denuncia-nota">Todos los reportes pasan por revisión antes de publicarse. Publicamos tu testimonio y tu foto, nunca tu nombre, tu contacto ni tu ubicación exacta.</p>
    </form>
  );
}
