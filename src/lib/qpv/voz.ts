/**
 * Voz de locutor para las notas (ElevenLabs, 2026-10).
 * Genera el MP3 de una nota una sola vez y lo guarda en Netlify Blobs
 * ("qpv-audio"); el botón "Escuchar nota" lo reproduce. Sin
 * ELEVENLABS_API_KEY no hace nada y el botón usa la voz del dispositivo.
 *
 * Variables en Netlify:
 *   ELEVENLABS_API_KEY   — clave de la cuenta
 *   ELEVENLABS_VOICE_ID  — la voz elegida (ID que se copia en ElevenLabs → Voices)
 *   QPV_AUDIO_AUTO=1     — generar solo el audio de cada nota nueva (si no, solo a mano)
 */
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "qpv-audio", consistency: "strong" });
const MAX_CARACTERES = 4500; // ~3 min de audio; cuida los créditos

export function vozConfigurada(): boolean {
  return !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID;
}

export async function leerAudio(slug: string): Promise<ArrayBuffer | null> {
  try {
    return (await store().get(slug, { type: "arrayBuffer" })) as ArrayBuffer | null;
  } catch {
    return null;
  }
}

export async function existeAudio(slug: string): Promise<boolean> {
  try {
    return !!(await store().getMetadata(slug));
  } catch {
    return false;
  }
}

/** Texto que se lee: título, resumen y cuerpo, cortado en una frase completa si es muy largo. */
export function textoParaLeer(titulo: string, resumen: string, cuerpo: string[]): string {
  let t = [titulo.replace(/[.\s]+$/, "") + ".", resumen, ...cuerpo].filter(Boolean).join("\n\n").replace(/\*\*/g, "");
  if (t.length > MAX_CARACTERES) {
    const corte = t.lastIndexOf(".", MAX_CARACTERES);
    t = t.slice(0, corte > 0 ? corte + 1 : MAX_CARACTERES);
  }
  return t + "\n\nInformación de Qué Pasa Vallarta.";
}

/** Genera y guarda el audio de una nota. Devuelve un mensaje de resultado. Nunca lanza. */
export async function generarAudio(slug: string, texto: string, opciones: { reemplazar?: boolean } = {}): Promise<string> {
  if (!vozConfigurada()) return "Falta ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID.";
  if (!opciones.reemplazar && (await existeAudio(slug))) return "Ya tenía audio.";
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: texto,
          model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
          language_code: "es",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
        }),
        signal: AbortSignal.timeout(45_000),
      }
    );
    if (!r.ok) return `ElevenLabs respondió ${r.status}: ${(await r.text()).slice(0, 200)}`;
    const audio = await r.arrayBuffer();
    await store().set(slug, audio, { metadata: { creado: new Date().toISOString(), caracteres: texto.length } });
    return `Audio listo (${Math.round(audio.byteLength / 1024)} KB, ${texto.length} caracteres).`;
  } catch (err) {
    return `Error al generar el audio: ${err instanceof Error ? err.message : "desconocido"}`;
  }
}

/**
 * Para /api/ingest: si QPV_AUDIO_AUTO=1, genera el audio de la nota publicada más
 * reciente que todavía no lo tenga (una por corrida, para cuidar tiempo y créditos).
 */
export async function audioDeLaUltimaNota(): Promise<string> {
  if (process.env.QPV_AUDIO_AUTO !== "1" || !vozConfigurada()) return "Audio automático apagado.";
  const { getPublishedArticles } = await import("../db/articles");
  const notas = (await getPublishedArticles(6)).filter((n) => Date.now() - new Date(n.publishedAt).getTime() < 12 * 3_600_000);
  for (const n of notas) {
    if (await existeAudio(n.slug)) continue;
    return `${n.slug}: ${await generarAudio(n.slug, textoParaLeer(n.title, n.dek, n.body))}`;
  }
  return "Sin notas nuevas para audio.";
}
