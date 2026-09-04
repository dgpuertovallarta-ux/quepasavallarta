import Link from "next/link";
import { SITE } from "@/lib/data";

const SOCIAL = [
  { label: "Facebook", href: "#", path: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" },
  { label: "Instagram", href: "#", path: "M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.3.4.6.2 1 .5 1.5 1 .4.4.7.9 1 1.5.2.5.4 1.2.4 2.3.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.3-.2.6-.5 1-1 1.5-.4.4-.9.7-1.5 1-.5.2-1.2.4-2.3.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.3-.4-.6-.2-1-.5-1.5-1-.4-.4-.7-.9-1-1.5-.2-.5-.4-1.2-.4-2.3C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.3.2-.6.5-1 1-1.5.4-.4.9-.7 1.5-1 .5-.2 1.2-.4 2.3-.4C8.9 2 9.3 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-8.4a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" },
  { label: "X", href: "#", path: "M4 3h4.4l4 5.7L17.1 3H21l-6.8 8.4L21 21h-4.4l-4.4-6.2L6.9 21H3l7.2-8.8L4 3Z" },
  { label: "YouTube", href: "#", path: "M22 12s0-3.2-.4-4.7a2.9 2.9 0 0 0-2-2C17.9 5 12 5 12 5s-5.9 0-7.6.3a2.9 2.9 0 0 0-2 2C2 8.8 2 12 2 12s0 3.2.4 4.7c.2 1 1 1.7 2 2C6.1 19 12 19 12 19s5.9 0 7.6-.3a2.9 2.9 0 0 0 2-2C22 15.2 22 12 22 12ZM10 15.5v-7l6 3.5-6 3.5Z" },
];

export default function Footer() {
  return (
    <footer className="site-footer surface-dark">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <h4 style={{ fontSize: 16, color: "var(--text)", marginBottom: 8 }}>
              Qué Pasa <span style={{ color: "var(--accent)" }}>Vallarta</span>
            </h4>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", maxWidth: 280, marginBottom: 14 }}>
              Información clara, útil y confiable para vivir y entender lo que pasa en Puerto Vallarta y el
              municipio.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="icon-btn"
                  style={{ width: 34, height: 34 }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
          <div className="footer-col">
            <h4>Secciones</h4>
            <Link href="/categoria/ultima-hora">Última Hora</Link>
            <Link href="/categoria/turismo">Puerto Vallarta</Link>
            <Link href="/categoria/jalisco">Jalisco</Link>
            <Link href="/categoria/mexico">México</Link>
            <Link href="/explica">Explica</Link>
            <Link href="/agenda">Vive Vallarta</Link>
            <Link href="/guia">Guía</Link>
          </div>
          <div className="footer-col">
            <h4>Herramientas</h4>
            <Link href="/ahora">Vallarta Ahora</Link>
            <Link href="/mi-vallarta">Mi Zona</Link>
            <Link href="/alertas">Alertas</Link>
            <Link href="/agenda">Agenda</Link>
            <Link href="/pregunta">Pregúntale a Vallarta</Link>
          </div>
          <div className="footer-col">
            <h4>Empresa</h4>
            <Link href="/admin">Quiénes somos</Link>
            <Link href="/conecta">Anúnciate</Link>
            <Link href="/conecta">Vallarta Conecta</Link>
            <span style={{ display: "block", padding: "4px 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Contacto (demo)
            </span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {SITE.name}. Sitio de demostración (MVP) — todos los datos son ficticios.</span>
          <span>Hecho en Puerto Vallarta, para Puerto Vallarta.</span>
        </div>
      </div>
    </footer>
  );
}
