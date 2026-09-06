"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/data";
import { parseArticleDraft } from "@/lib/ingest/articleFormat";

/**
 * Flujo real "IA redacta, humano revisa": genera un borrador llamando a
 * /api/generate-article (Claude + prompt editorial real), deja los campos
 * EDITABLES para que un humano los revise/corrija, y solo publica de
 * verdad en la portada cuando el humano da click en "Publicar" — nunca
 * automático. Sin ANTHROPIC_API_KEY, o sin corroboración NIVEL A/B de
 * esta Story, el paso de generar devuelve el motivo exacto.
 */
export default function GenerateArticleButton({
  storyId,
  hasCorroboration,
  categoryGuess,
  newsScore,
}: {
  storyId: string;
  hasCorroboration: boolean;
  categoryGuess: string;
  newsScore: number;
}) {
  const [state, setState] = useState<"idle" | "generating" | "review" | "publishing" | "published" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(categoryGuess);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  async function handleGenerate() {
    setState("generating");
    setMessage(null);
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const resBody = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(resBody.error || `Error ${res.status}`);
        return;
      }
      const parsed = parseArticleDraft(resBody.article.draft);
      setTitle(parsed.title);
      setExcerpt(parsed.excerpt);
      setBody(parsed.bodyParagraphs.join("\n\n"));
      setAiModel(resBody.article.model);
      setState("review");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Error de red");
    }
  }

  async function handlePublish() {
    setState("publishing");
    setMessage(null);
    try {
      const res = await fetch("/api/publish-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt, body, categorySlug: category, newsScore, aiModel, storyExternalKey: storyId }),
      });
      const resBody = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(resBody.error || `Error ${res.status}`);
        return;
      }
      setPublishedSlug(resBody.slug);
      setState("published");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Error de red");
    }
  }

  if (state === "published") {
    return (
      <div style={{ fontSize: 12.5 }}>
        <span className="chip chip-verified">Publicado</span>{" "}
        <a href={`/noticia/${publishedSlug}`} target="_blank" rel="noopener">
          Ver artículo →
        </a>
      </div>
    );
  }

  if (state === "review" || state === "publishing") {
    return (
      <div style={{ minWidth: 320, maxWidth: 420, fontSize: 12.5 }}>
        <label style={{ display: "block", marginBottom: 6 }}>
          Titular
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", fontSize: 12.5, padding: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          Bajada
          <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} style={{ width: "100%", fontSize: 12.5, padding: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          Categoría
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", fontSize: 12.5, padding: 4 }}>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          Cuerpo (revisa y corrige antes de publicar)
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} style={{ width: "100%", fontSize: 12, padding: 4, fontFamily: "monospace" }} />
        </label>
        {message && <p style={{ color: "var(--danger)" }}>{message}</p>}
        <button className="btn btn-primary btn-sm" onClick={handlePublish} disabled={state === "publishing" || !title || !body}>
          {state === "publishing" ? "Publicando..." : "Publicar en la portada"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn btn-outline btn-sm"
        onClick={handleGenerate}
        disabled={state === "generating" || !hasCorroboration}
        title={!hasCorroboration ? "Sin corroboración NIVEL A/B — no se puede redactar todavía" : "Genera un borrador real con IA para revisar antes de publicar"}
      >
        {state === "generating" ? "Generando..." : "Generar borrador (IA)"}
      </button>
      {message && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4, maxWidth: 260 }}>{message}</p>}
    </div>
  );
}
