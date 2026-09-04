"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { SITE, CATEGORIES, NEWS, AHORA } from "@/lib/data";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/ahora", label: "Vallarta Ahora" },
  { href: "/explica", label: "Vallarta Explica" },
  { href: "/agenda", label: "Vive Vallarta" },
  { href: "/guia", label: "Vallarta Guía" },
  { href: "/mi-vallarta", label: "Mi Vallarta" },
  { href: "/pregunta", label: "Pregúntale a Vallarta" },
];

const TICKER_ITEMS = [...NEWS]
  .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  .slice(0, 5);

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  // Re-aplica el tema guardado tras el remount de Strict Mode en desarrollo
  // (el ThemeInitScript ya lo hace antes del primer pintado en producción).
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem("vc_theme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch {}
  }, []);

  useEffect(() => {
    function onScroll() {
      setCompact(window.scrollY > 48);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme() {
    // Por defecto (sin atributo) el sitio usa el tema claro editorial;
    // data-theme="dark" es la alternativa opcional que elige el lector.
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("vc_theme", ""); } catch {}
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      try { localStorage.setItem("vc_theme", "dark"); } catch {}
    }
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <div className="demo-banner">
        <strong>Demo</strong> — Este sitio muestra datos ficticios para ilustrar el producto. Ninguna
        noticia, cifra o negocio es real. Ver{" "}
        <Link href="/admin" style={{ color: "inherit", textDecoration: "underline" }}>
          panel editorial
        </Link>
        .
      </div>
      <header className={`site-header${compact ? " is-compact" : ""}`}>
        <div className="header-top surface-dark">
          <div className="container header-top-inner">
            <div className="header-top-left">
              <Link href={`/noticia/${TICKER_ITEMS[0].slug}`} className="chip chip-breaking" style={{ textDecoration: "none" }}>
                <span className="live-dot" style={{ marginRight: 6 }} />
                ÚLTIMA HORA
              </Link>
              <div className="ticker-marquee">
                <div className="ticker-track">
                  {[...TICKER_ITEMS, ...TICKER_ITEMS].map((n, i) => (
                    <Link key={n.slug + i} href={`/noticia/${n.slug}`}>
                      {n.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="header-top-links">
              <button className="icon-btn" style={{ width: 30, height: 30, fontSize: 13 }} aria-label="Buscar" title="Buscar" onClick={() => router.push("/buscar")}>
                🔎
              </button>
              <span className="weather-chip">{AHORA.clima.icon} Clima {AHORA.clima.value}</span>
              <Link href="/admin">Panel editorial</Link>
              <Link href="/#newsletter" className="btn btn-primary btn-sm">Suscríbete</Link>
            </div>
          </div>
        </div>
        <div className="container">
          <div className="header-main">
            <Link href="/" className="brand" style={{ textDecoration: "none" }}>
              <span className="brand-mark">QPV</span>
              <span>
                <span className="brand-name" style={{ display: "block" }}>
                  Qué Pasa <span>Vallarta</span>
                </span>
                <span className="brand-tag">{SITE.tagline}</span>
              </span>
            </Link>
            <nav className={`main-nav${navOpen ? " open" : ""}`} aria-label="Navegación principal">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={pathname === n.href ? "active" : ""}
                  onClick={() => setNavOpen(false)}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="header-actions">
              {compact && (
                <span
                  className="chip chip-verified"
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                  title="Contenido en vivo"
                >
                  <span className="live-dot" /> En vivo
                </span>
              )}
              <button
                className="icon-btn"
                aria-label="Cambiar tema"
                title="Cambiar tema"
                onClick={toggleTheme}
                suppressHydrationWarning
              >
                ◐
              </button>
              <button
                className="icon-btn nav-toggle"
                aria-label="Abrir menú"
                title="Menú"
                onClick={() => setNavOpen((v) => !v)}
              >
                ☰
              </button>
            </div>
          </div>
          <nav className="category-bar" aria-label="Categorías">
            {CATEGORIES.slice(0, 12).map((c) => (
              <Link key={c.slug} href={`/categoria/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}
