"use client";

import { useEffect, useRef, useState } from "react";
import type { PageReel } from "@/lib/social/reels";

function shortAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 60) return `hace ${Math.max(diffMin, 1)} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Carrusel compacto de los reels de la página de Facebook. Cada reel se
 * ve aquí mismo en una ventana (reproductor oficial de Facebook) y tiene
 * enlace para abrirlo en Facebook.
 */
export default function ReelsCarousel({ reels, pageUrl }: { reels: PageReel[]; pageUrl: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<PageReel | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function scrollByAmount(dir: 1 | -1) {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 600), behavior: "smooth" });
  }

  return (
    <>
      <div className="carousel-wrap">
        <button className="carousel-nav prev" onClick={() => scrollByAmount(-1)} aria-label="Reels anteriores">
          ‹
        </button>
        <div className="carousel-row reels-row" ref={rowRef}>
          {reels.map((r) => (
            <button key={r.id} type="button" className="reel-card" onClick={() => setOpen(r)} aria-label={`Ver reel: ${r.description || "sin descripción"}`}>
              <span className="reel-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumbnail || ""} alt="" loading="lazy" referrerPolicy="no-referrer" />
                <span className="reel-play">
                  <PlayIcon />
                </span>
              </span>
              {r.description && <span className="reel-caption">{r.description}</span>}
              {r.createdAt && <span className="reel-time">{shortAgo(r.createdAt)}</span>}
            </button>
          ))}
          <a className="reel-card reel-more" href={pageUrl} target="_blank" rel="noopener noreferrer">
            <span className="reel-thumb">
              <span>Ver todos en Facebook →</span>
            </span>
          </a>
        </div>
        <button className="carousel-nav next" onClick={() => scrollByAmount(1)} aria-label="Más reels">
          ›
        </button>
      </div>

      {open && (
        <div className="reel-modal" role="dialog" aria-modal="true" aria-label="Reel" onClick={() => setOpen(null)}>
          <div className="reel-modal-box" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="reel-modal-close" onClick={() => setOpen(null)} aria-label="Cerrar">
              ×
            </button>
            <iframe
              src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(open.url)}&show_text=false&width=360`}
              title={open.description || "Reel de Qué Pasa Vallarta"}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
            <a href={open.url} target="_blank" rel="noopener noreferrer" className="reel-modal-link">
              Ver en Facebook
            </a>
          </div>
        </div>
      )}
    </>
  );
}
