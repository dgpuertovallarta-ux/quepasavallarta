"use client";

import { useState } from "react";
import Image from "next/image";
import type { PendingArticle } from "@/lib/db/articles";

type ReviewResult = {
  error?: string;
  socialSkipped?: string;
  social?: {
    facebook: { attempted: boolean; ok: boolean; error?: string };
    instagram: { attempted: boolean; ok: boolean; error?: string };
  };
};

function approvalMessage(result: ReviewResult, decision: "approve" | "reject"): string {
  if (result.error) return result.error;
  if (decision === "reject") return "Publicación rechazada; no se publicará en el sitio ni en redes.";
  if (result.socialSkipped) return `Aprobada y publicada en el sitio. ${result.socialSkipped}`;
  const fb = result.social?.facebook;
  const ig = result.social?.instagram;
  if (!fb?.attempted && !ig?.attempted) return "Aprobada y publicada en el sitio. Redes sociales no están configuradas.";
  const destinations = [
    fb?.ok ? "Facebook" : fb?.attempted ? `Facebook: ${fb.error || "falló"}` : null,
    ig?.ok ? "Instagram" : ig?.attempted ? `Instagram: ${ig.error || "falló"}` : null,
  ].filter(Boolean);
  return `Aprobada y publicada en el sitio. Redes: ${destinations.join(" · ") || "sin publicación"}.`;
}

export default function ApprovalQueue({ initialArticles }: { initialArticles: PendingArticle[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(slug: string, decision: "approve" | "reject") {
    setBusySlug(slug);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/review-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, decision }),
      });
      const result = (await response.json()) as ReviewResult;
      if (!response.ok) {
        setError(result.error || "No se pudo procesar la publicación.");
        return;
      }
      setArticles((current) => current.filter((article) => article.slug !== slug));
      setNotice(approvalMessage(result, decision));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión.");
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Revisa la nota y sus fuentes. Al aprobarla se publica en el sitio y se intenta enviar a Facebook e Instagram.
        Cualquiera de los administradores puede aprobar o rechazar cada publicación.
      </p>
      {notice && <p className="chip chip-verified" role="status">{notice}</p>}
      {error && <p style={{ color: "var(--danger)" }} role="alert">{error}</p>}
      {articles.length === 0 ? (
        <p>No hay publicaciones pendientes de aprobación.</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {articles.map((article) => (
            <article key={article.slug} className="panel" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span className="chip">Pendiente de aprobación</span>{" "}
                  <span className="chip">{article.categorySlug}</span>{" "}
                  <span className="score-pill">Score {article.newsScore}</span>
                </div>
                <small style={{ color: "var(--text-muted)" }}>
                  {article.draftedAt ? new Date(article.draftedAt).toLocaleString("es-MX") : "Fecha no disponible"}
                </small>
              </div>
              <h2 style={{ fontSize: 20, margin: "12px 0 6px" }}>{article.title}</h2>
              {article.imageUrl && (
                <Image
                  src={article.imageUrl}
                  alt={`Imagen para: ${article.title}`}
                  width={720}
                  height={405}
                  unoptimized
                  style={{ display: "block", width: "100%", maxWidth: 720, height: "auto", borderRadius: 10, marginBottom: 12 }}
                />
              )}
              {article.excerpt && <p style={{ marginTop: 0, fontWeight: 600 }}>{article.excerpt}</p>}
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Revisar artículo completo y fuentes</summary>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, marginTop: 10 }}>{article.body}</div>
                {article.sourceUrl && (
                  <p style={{ fontSize: 13 }}>
                    Fuente: <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">{article.sourceName || article.sourceUrl}</a>
                  </p>
                )}
              </details>
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" onClick={() => review(article.slug, "approve")} disabled={busySlug !== null}>
                  {busySlug === article.slug ? "Procesando…" : "Aprobar y publicar"}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => review(article.slug, "reject")} disabled={busySlug !== null}>
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
