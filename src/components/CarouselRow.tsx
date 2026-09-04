"use client";

import { useRef } from "react";

export default function CarouselRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function scrollByAmount(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 640);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <div className="carousel-wrap">
      <button className="carousel-nav prev" onClick={() => scrollByAmount(-1)} aria-label="Anterior">
        ‹
      </button>
      <div className="carousel-row" ref={ref}>
        {children}
      </div>
      <button className="carousel-nav next" onClick={() => scrollByAmount(1)} aria-label="Siguiente">
        ›
      </button>
    </div>
  );
}
