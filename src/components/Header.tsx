"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { CATEGORIES } from "@/lib/data";

// Menú principal corto, al estilo de un diario: un acceso "en vivo", tres
// secciones de noticias y Explica. Se eligen, en este orden de
// preferencia, las primeras tres categorías que ya tienen notas — nunca
// se enlaza a una sección vacía. Todo lo demás vive en el menú ("Más").
const PRIMARY_PREFERENCE = ["seguridad", "gobierno", "comunidad", "turismo", "clima", "servicios", "transito", "playas"];
const PRIMARY_FALLBACK = ["gobierno", "comunidad", "turismo"];

const SECTIONS = [
  { href: "/", label: "Inicio" },
  { href: "/ahora", label: "Vallarta Ahora" },
  { href: "/explica", label: "Vallarta Explica" },
  { href: "/agenda", label: "Vive Vallarta" },
  { href: "/guia", label: "Vallarta Guía" },
  { href: "/mi-vallarta", label: "Mi Vallarta" },
  { href: "/pregunta", label: "Pregúntale a Vallarta" },
];

function todayLabel() {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date());
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Header({
  hasRealContent = false,
  activeCategories = [],
}: {
  hasRealContent?: boolean;
  activeCategories?: string[];
}) {
  const pathname = usePathname();
  // Sin datos (sitio en demo o base no disponible) se muestran todas.
  const filterActive = hasRealContent && activeCategories.length > 0;
  const categories = filterActive
    ? CATEGORIES.filter((c) => c.slug === "ultima-hora" || activeCategories.includes(c.slug))
    : CATEGORIES;
  const primarySlugs = filterActive
    ? PRIMARY_PREFERENCE.filter((slug) => activeCategories.includes(slug)).slice(0, 3)
    : PRIMARY_FALLBACK;
  const primary = [
    ...primarySlugs.map((slug) => ({
      href: `/categoria/${slug}`,
      label: CATEGORIES.find((c) => c.slug === slug)?.name || slug,
    })),
    { href: "/explica", label: "Explica" },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  // Re-aplica el tema guardado tras el remount de Strict Mode en desarrollo
  // (el ThemeInitScript ya lo hace antes del primer pintado en producción).
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem("vc_theme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch {}
  }, []);

  // La barra compacta aparece cuando la cabecera completa ya salió de pantalla.
  useEffect(() => {
    function onScroll() {
      setCompact(window.scrollY > 240);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Con el menú abierto: bloquea el scroll del fondo y cierra con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleTheme() {
    // Por defecto (sin atributo) el sitio usa el tema pizarra;
    // data-theme="light" es la alternativa clara que elige el lector.
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("vc_theme", ""); } catch {}
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      try { localStorage.setItem("vc_theme", "light"); } catch {}
    }
  }

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      {primary.map((n) => (
        <Link key={n.href} href={n.href} className={pathname === n.href ? "active" : ""}>
          {n.label}
        </Link>
      ))}
      <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen}>
        Más <ChevronIcon />
      </button>
    </>
  );

  const livePill = (
    <Link href="/ahora" className="live-pill">
      <span className="live-dot" /> Ahora
    </Link>
  );

  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      {!hasRealContent && (
        <div className="demo-banner">
          <strong>Demo</strong> — Este sitio todavía no tiene artículos reales publicados; muestra datos
          ficticios para ilustrar el producto. Ver{" "}
          <Link href="/admin" style={{ color: "inherit", textDecoration: "underline" }}>
            panel editorial
          </Link>
          .
        </div>
      )}

      <header className="site-header">
        <div className="container">
          <div className="masthead">
            <div className="masthead-left">
              <Link href="/buscar" className="icon-link" aria-label="Buscar" title="Buscar">
                <SearchIcon />
              </Link>
              <span className="masthead-date" suppressHydrationWarning>
                {todayLabel()}
              </span>
            </div>
            <Link href="/" className="brand" aria-label="Qué Pasa Vallarta — inicio">
              <img src="/brand/logo-transparent.png" alt="Qué Pasa Vallarta" className="brand-logo" />
            </Link>
            <div className="masthead-right">
              <Link href="/#newsletter" className="btn btn-outline">
                Suscríbete
              </Link>
              <span className="mobile-only">{livePill}</span>
              <Link href="/buscar" className="icon-link mobile-only" aria-label="Buscar">
                <SearchIcon />
              </Link>
              <button
                type="button"
                className="icon-link nav-toggle"
                aria-label="Abrir menú"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <MenuIcon />
              </button>
            </div>
          </div>
          <nav className="primary-nav" aria-label="Navegación principal">
            {livePill}
            {navLinks}
          </nav>
        </div>
      </header>

      <div className={`compact-bar${compact && !menuOpen ? " is-visible" : ""}`} inert={!compact || menuOpen}>
        <div className="container compact-bar-inner">
          <div className="compact-left">
            <Link href="/" className="brand" aria-label="Qué Pasa Vallarta — inicio">
              <img src="/brand/logo-transparent.png" alt="" className="brand-logo" />
            </Link>
            {livePill}
          </div>
          <nav className="compact-nav" aria-label="Navegación principal (barra fija)">
            {navLinks}
          </nav>
          <div className="compact-right">
            <Link href="/#newsletter" className="btn btn-outline btn-sm">
              Suscríbete
            </Link>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="site-menu" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="container">
            <div className="site-menu-head">
              <Link href="/" className="brand" onClick={closeMenu} aria-label="Qué Pasa Vallarta — inicio">
                <img src="/brand/logo-transparent.png" alt="Qué Pasa Vallarta" className="brand-logo" />
              </Link>
              <button type="button" className="icon-link" aria-label="Cerrar menú" onClick={closeMenu} autoFocus>
                <CloseIcon />
              </button>
            </div>
            <div className="site-menu-grid">
              <div>
                <h2>Secciones</h2>
                <nav className="site-menu-list" aria-label="Secciones">
                  {SECTIONS.map((s) => (
                    <Link key={s.href} href={s.href} onClick={closeMenu}>
                      {s.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div>
                <h2>Categorías</h2>
                <nav className="site-menu-cats" aria-label="Categorías">
                  {categories.map((c) => (
                    <Link key={c.slug} href={`/categoria/${c.slug}`} onClick={closeMenu}>
                      {c.name}
                    </Link>
                  ))}
                </nav>
              </div>
              <div>
                <h2>Opciones</h2>
                <div className="site-menu-actions">
                  <Link href="/#newsletter" className="btn btn-primary" onClick={closeMenu}>
                    Suscríbete al boletín
                  </Link>
                  <Link href="/buscar" className="btn btn-outline" onClick={closeMenu}>
                    Buscar
                  </Link>
                  <button type="button" className="btn btn-outline" onClick={toggleTheme}>
                    Cambiar tema claro / oscuro
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
