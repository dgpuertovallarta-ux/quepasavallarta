"use client";

import { useState } from "react";
import LatestList from "./LatestList";
import { getCategoryName, type NewsItem } from "@/lib/data";

/**
 * Pestañas por categoría para la lista "Lo último": en vez de una sola
 * lista larga (o corta y con espacio vacío cuando hay pocas noticias),
 * organiza el mismo contenido real por categoría — solo muestra pestañas
 * de categorías que de verdad tienen al menos una noticia, así nunca se
 * ve una pestaña vacía.
 */
export default function CategoryTabs({ items }: { items: NewsItem[] }) {
  const categories = Array.from(new Set(items.map((n) => n.category)));
  const [active, setActive] = useState("todas");
  const filtered = active === "todas" ? items : items.filter((n) => n.category === active);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          className={`filter-chip${active === "todas" ? " active" : ""}`}
          onClick={() => setActive("todas")}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            className={`filter-chip${active === c ? " active" : ""}`}
            onClick={() => setActive(c)}
          >
            {getCategoryName(c)}
          </button>
        ))}
      </div>
      <LatestList items={filtered.slice(0, 10)} />
    </div>
  );
}
