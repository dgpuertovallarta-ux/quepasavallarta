"use client";

import { useState } from "react";

/**
 * Botón real: llama a POST /api/generate-article, que a su vez llama de
 * verdad a la API de Claude (si ANTHROPIC_API_KEY está configurada) con
 * el prompt editorial completo. Sin la key, o sin corroboración NIVEL A/B
 * de esta Story, el endpoint devuelve el motivo exacto — nunca se inventa
 * un borrador falso en el frontend.
 */
export default function GenerateArticleButton({ storyId, hasCorroboration }: { storyId: string; hasCorroboration: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setMessage(null);
    setDraft(null);
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(body.error || `Error ${res.status}`);
        return;
      }
      setState("done");
      setDraft(body.article.draft);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Error de red");
    }
  }

  return (
    <div>
      <button
        className="btn btn-outline btn-sm"
        onClick={handleClick}
        disabled={state === "loading" || !hasCorroboration}
        title={!hasCorroboration ? "Sin corroboración NIVEL A/B — no se puede redactar todavía" : "Genera un borrador real con IA (revisión humana obligatoria antes de publicar)"}
      >
        {state === "loading" ? "Generando..." : "Generar borrador (IA)"}
      </button>
      {message && (
        <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4, maxWidth: 260 }}>{message}</p>
      )}
      {draft && (
        <details style={{ marginTop: 6 }} open>
          <summary style={{ fontSize: 11.5, cursor: "pointer" }}>Borrador generado — revisión humana pendiente</summary>
          <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", maxWidth: 420, marginTop: 4 }}>{draft}</pre>
        </details>
      )}
    </div>
  );
}
