"use client";

import { useLayoutEffect, useState } from "react";
import { SITE } from "@/lib/data";

const SESSION_KEY = "vc_intro_shown";

export default function IntroScreen() {
  // Empieza en null (no decidido) para no renderizar nada distinto entre
  // servidor y cliente antes de comprobar sessionStorage; evita hydration
  // mismatch mostrando la intro solo tras montar en el cliente.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const [reduced, setReduced] = useState(false);

  useLayoutEffect(() => {
    let alreadyShown = true;
    try {
      alreadyShown = !!sessionStorage.getItem(SESSION_KEY);
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) {
      // Necesario: sessionStorage solo existe en el navegador, así que esta
      // decisión no puede tomarse durante el render inicial (SSR) sin causar
      // un hydration mismatch — por eso se resuelve aquí, una sola vez al montar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefersReduced);
    setVisible(true);

    const t = setTimeout(finish, prefersReduced ? 900 : 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    setFadeOut(true);
    setTimeout(() => setVisible(false), reduced ? 0 : 480);
  }

  if (!visible) return null;

  return (
    <div id="intro-screen" className={fadeOut ? "fade-out" : ""} role="presentation">
      <div className="intro-waves">
        <div className="intro-wave" />
      </div>
      <div className="intro-mark">QPV</div>
      <div className="intro-name">{SITE.name}</div>
      <div className="intro-tag">{SITE.tagline}</div>
      <button className="intro-skip" type="button" onClick={finish}>
        Saltar →
      </button>
    </div>
  );
}
