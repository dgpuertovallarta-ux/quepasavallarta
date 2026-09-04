"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getCategoryName, type NewsItem } from "@/lib/data";
import { PHOTOS } from "@/lib/photos";
import { timeAgo } from "@/lib/format";

const AUTOPLAY_MS = 6500;

export default function HeroCarousel({ items }: { items: NewsItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);

  const count = items.length;

  const goTo = (i: number) => setIndex((i + count) % count);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    const delta = e.clientX - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) next();
    else prev();
  }

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Noticias principales"
    >
      {items.map((n, i) => (
        <article key={n.slug} className={`hero-slide${i === index ? " is-active" : ""}`} aria-hidden={i !== index}>
          <div className="hero-slide-media">
            <Image
              src={PHOTOS[n.image]}
              alt={n.title}
              fill
              sizes="(max-width: 900px) 100vw, 66vw"
              priority={i === 0}
            />
          </div>
          <div className="hero-slide-body">
            {n.breaking ? (
              <span className="chip chip-breaking">Última hora</span>
            ) : (
              <span className="chip">{getCategoryName(n.category)}</span>
            )}
            <h2>
              <Link href={`/noticia/${n.slug}`} style={{ color: "inherit" }}>
                {n.title}
              </Link>
            </h2>
            <p>{n.dek}</p>
            <div className="hero-slide-meta">
              {n.verified && <span className="chip chip-verified">Verificado</span>}
              <span>{timeAgo(n.updatedAt || n.publishedAt)}</span>
            </div>
            <div className="hero-slide-cta">
              <Link href={`/noticia/${n.slug}`} className="btn btn-primary btn-sm link-arrow">
                Leer nota completa <span className="arrow">→</span>
              </Link>
            </div>
          </div>
        </article>
      ))}

      <div className="hero-arrows">
        <button className="hero-arrow" onClick={prev} aria-label="Anterior">
          ‹
        </button>
        <button className="hero-arrow" onClick={next} aria-label="Siguiente">
          ›
        </button>
      </div>

      <div className="hero-controls">
        <div className="hero-dots">
          {items.map((n, i) => (
            <button
              key={n.slug}
              className={`hero-dot${i === index ? " is-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Ir a la noticia ${i + 1}`}
            />
          ))}
        </div>
        <span className="hero-counter">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
