import Link from "next/link";
import { SITE } from "@/lib/data";

const SOCIAL = [
  { label: "Facebook", href: "https://www.facebook.com/quepasavallarta", path: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" },
  { label: "Instagram", href: "https://www.instagram.com/quepasavallarta", path: "M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.3.4.6.2 1 .5 1.5 1 .4.4.7.9 1 1.5.2.5.4 1.2.4 2.3.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.3-.2.6-.5 1-1 1.5-.4.4-.9.7-1.5 1-.5.2-1.2.4-2.3.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.3-.4-.6-.2-1-.5-1.5-1-.4-.4-.7-.9-1-1.5-.2-.5-.4-1.2-.4-2.3C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.3.2-.6.5-1 1-1.5.4-.4.9-.7 1.5-1 .5-.2 1.2-.4 2.3-.4C8.9 2 9.3 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-8.4a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" },
];

export default function Footer({ hasRealContent = false }: { hasRealContent?: boolean }) {
  return (
    <footer className="site-footer surface-dark">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <img src="/brand/logo-transparent.png" alt="Qué Pasa Vallarta" className="brand-logo" />
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 300, margin: "0 0 14px" }}>
              Información clara, útil y confiable para vivir y entender lo que pasa en Puerto Vallarta y el
              municipio.
            </p>
            <div className="footer-social">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} className="icon-link" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
            <h4>Para negocios</h4>
            <Link href="/conecta">Anúnciate</Link>
            <Link href="/conecta">Vallarta Conecta</Link>
            <Link href="/guia">Guía de negocios</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {SITE.name}.{" "}
            {hasRealContent
              ? "Noticias verificadas por el equipo editorial."
              : "Sitio de demostración (MVP) — todos los datos son ficticios."}
          </span>
          <span>
            Hecho en Puerto Vallarta, para Puerto Vallarta. · <Link href="/admin">Panel editorial</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
