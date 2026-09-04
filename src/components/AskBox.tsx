"use client";

import { useState } from "react";
import Link from "next/link";
import { searchAsk, type AskResult } from "@/lib/ask";
import { getCategoryName } from "@/lib/data";
import { timeAgo } from "@/lib/format";

const SUGGESTIONS = [
  "¿Qué pasó hoy en Puerto Vallarta?",
  "¿Hay tráfico?",
  "¿Qué eventos hay esta semana?",
  "¿Qué dicen las autoridades sobre seguridad?",
  "¿Qué pasa con el clima?",
];

export default function AskBox({ initialQuery }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<AskResult[]>(initialQuery ? searchAsk(initialQuery) : []);
  const [searched, setSearched] = useState(!!initialQuery);

  function run(q: string) {
    setQuery(q);
    setResults(searchAsk(q));
    setSearched(true);
  }

  return (
    <>
      <div className="ask-box">
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>
          💬 Pregúntale a Vallarta <span className="chip chip-demo" style={{ verticalAlign: "middle" }}>Demo</span>
        </h1>
        <p style={{ opacity: 0.85, maxWidth: 640, margin: 0 }}>
          Búsqueda de palabras clave sobre el contenido de este sitio de demostración —{" "}
          <strong>no es un modelo de IA conectado</strong>. En producción, esta función usará únicamente
          información disponible en la plataforma, nunca inventará datos, y siempre distinguirá hechos,
          declaraciones oficiales, versiones e información no confirmada. Ver <code>/docs/ARCHITECTURE.md</code>.
        </p>
        <div className="ask-input-row">
          <input
            className="ask-input"
            placeholder="Escribe tu pregunta sobre Puerto Vallarta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(query)}
          />
          <button className="btn btn-primary" onClick={() => run(query)}>
            Preguntar
          </button>
        </div>
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ask-suggestion" onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {searched && (
        <div className="ask-answer">
          {results.length === 0 ? (
            <div className="ask-fact">
              <div className="ask-fact-label">Sin resultados</div>
              <p>
                No encontré información sobre eso dentro del contenido de demostración disponible. En
                producción, Pregúntale a Vallarta solo responde con información que existe en la
                plataforma y siempre muestra sus fuentes — nunca inventa datos.
              </p>
            </div>
          ) : (
            results.map((r) =>
              r.kind === "noticia" ? (
                <div className="ask-fact" key={r.ref.slug}>
                  <div className="ask-fact-label">
                    {r.ref.verified ? "Hecho confirmado" : "Información sin confirmar oficialmente"} ·{" "}
                    {getCategoryName(r.ref.category)}
                  </div>
                  <p>
                    <Link href={`/noticia/${r.ref.slug}`}>
                      <strong>{r.ref.title}</strong>
                    </Link>
                    <br />
                    {r.ref.dek}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Fuente: {r.ref.sources[0]?.label || "N/D"} · {timeAgo(r.ref.updatedAt)}
                  </p>
                </div>
              ) : (
                <div className="ask-fact" key={r.ref.slug}>
                  <div className="ask-fact-label">Contexto — Vallarta Explica</div>
                  <p>
                    <Link href={`/explica/${r.ref.slug}`}>
                      <strong>{r.ref.title}</strong>
                    </Link>
                    <br />
                    {r.ref.quePaso}
                  </p>
                </div>
              )
            )
          )}
        </div>
      )}
    </>
  );
}
