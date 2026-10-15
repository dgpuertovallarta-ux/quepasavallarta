"use client";

/**
 * "Escuchar nota" (2026-10): lee la nota en voz alta con la voz en español
 * del teléfono o la computadora (Web Speech API). Gratis y sin servidor; la
 * voz depende del dispositivo. Si el navegador no tiene voz, el botón no sale.
 */
import { useEffect, useRef, useState } from "react";

type Estado = "listo" | "leyendo" | "pausa";

function elegirVoz(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  return (
    voces.find((v) => v.lang.toLowerCase() === "es-mx" && /natural|premium|enhanced|google/i.test(v.name)) ??
    voces.find((v) => v.lang.toLowerCase() === "es-mx") ??
    voces.find((v) => v.lang.toLowerCase() === "es-us") ??
    voces[0]
  );
}

/** Corta el texto en frases cortas: algunos navegadores se detienen con textos largos. */
function trozos(texto: string): string[] {
  const frases = texto.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*/g) ?? [texto];
  const out: string[] = [];
  let actual = "";
  for (const f of frases) {
    if ((actual + f).length > 220 && actual) {
      out.push(actual.trim());
      actual = "";
    }
    actual += f;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

export default function EscucharNota({ slug, titulo, resumen, parrafos }: { slug?: string; titulo: string; resumen?: string; parrafos: string[] }) {
  const [disponible, setDisponible] = useState(false);
  const [estado, setEstado] = useState<Estado>("listo");
  // Voz de locutor (MP3 generado con ElevenLabs, ver lib/qpv/voz.ts). Si no existe, se usa la voz del dispositivo.
  const [mp3, setMp3] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    fetch(`/api/audio/${slug}`, { method: "HEAD" })
      .then((r) => {
        if (vivo && r.ok) {
          setMp3(`/api/audio/${slug}`);
          setDisponible(true);
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
      audio.current?.pause();
    };
  }, [slug]);
  const minutos = Math.max(1, Math.round([titulo, resumen ?? "", ...parrafos].join(" ").split(/\s+/).length / 160));
  const cola = useRef<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const revisar = () => setDisponible((ya) => ya ||window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith("es")));
    const t = setTimeout(revisar, 0);
    window.speechSynthesis.addEventListener("voiceschanged", revisar);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.removeEventListener("voiceschanged", revisar);
      window.speechSynthesis.cancel();
    };
  }, []);

  function hablarSiguiente() {
    const t = cola.current.shift();
    if (!t) {
      setEstado("listo");
      return;
    }
    const u = new SpeechSynthesisUtterance(t);
    const voz = elegirVoz();
    if (voz) u.voice = voz;
    u.lang = voz?.lang ?? "es-MX";
    u.rate = 1;
    u.onend = hablarSiguiente;
    u.onerror = () => setEstado("listo");
    window.speechSynthesis.speak(u);
  }

  function alternar() {
    if (mp3) {
      if (!audio.current) {
        audio.current = new Audio(mp3);
        audio.current.onended = () => setEstado("listo");
      }
      if (estado === "leyendo") {
        audio.current.pause();
        setEstado("pausa");
      } else {
        void audio.current.play();
        setEstado("leyendo");
      }
      return;
    }
    const s = window.speechSynthesis;
    if (estado === "leyendo") {
      s.pause();
      setEstado("pausa");
      return;
    }
    if (estado === "pausa") {
      s.resume();
      setEstado("leyendo");
      return;
    }
    s.cancel();
    cola.current = trozos([titulo + ".", resumen ?? "", ...parrafos].filter(Boolean).join(" "));
    setEstado("leyendo");
    hablarSiguiente();
  }

  function detener() {
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = 0;
    }
    cola.current = [];
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setEstado("listo");
  }

  if (!disponible) return null;
  return (
    <div className="escuchar-nota" role="group" aria-label="Escuchar la nota">
      <button type="button" className="escuchar-boton" onClick={alternar} aria-pressed={estado === "leyendo"}>
        <span aria-hidden="true" className="escuchar-icono">{estado === "leyendo" ? "❚❚" : "▶"}</span>
        {estado === "leyendo" ? "Pausar" : estado === "pausa" ? "Continuar" : "Escuchar nota"}
        <span className="escuchar-min">· {minutos} min</span>
      </button>
      {estado !== "listo" && (
        <button type="button" className="escuchar-detener" onClick={detener}>
          Detener
        </button>
      )}
    </div>
  );
}
