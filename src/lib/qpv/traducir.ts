/**
 * Traducción al inglés del titular para las tarjetas de redes (2026-10-24):
 * Vallarta tiene mucho público extranjero. Va en chico debajo del titular.
 * Usa la misma IA de la redacción (Gemini). Nunca lanza: sin IA o si falla,
 * la tarjeta sale solo en español.
 */
import { GoogleGenAI } from "@google/genai";
import { conGemini, cuotaAgotada, CuotaAgotadaError } from "./cuotaGemini";


export function titularEnIngles(titulo: string): Promise<string | null> {
  return traducir(titulo, "headline");
}

/** Texto del post (una o dos oraciones) en inglés. */
export function postEnIngles(texto: string): Promise<string | null> {
  return traducir(texto, "post");
}

// Las traducciones se guardan para no pedirlas dos veces (tarjeta y post usan la misma).
const cache = new Map<string, string>();

async function traducir(titulo: string, tipo: "headline" | "post"): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY || !titulo.trim()) return null;
  const clave = `${tipo}:${titulo}`;
  if (cache.has(clave)) return cache.get(clave)!;
  if (cuotaAgotada()) return null;
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // 2026-10-25: a veces salía sin inglés. El modelo "piensa" antes de contestar y
  // con un límite de salida chico se acababa el espacio sin dar la traducción;
  // ahora hay espacio de sobra, más tiempo y un segundo intento.
  for (let intento = 0; intento < 2; intento++) {
    try {
      const { valor: res } = await conGemini((model) => Promise.race([
        client.models.generateContent({
          model,
          contents: titulo,
          config: {
            systemInstruction:
              (tipo === "headline"
                ? "Translate this Mexican local-news headline from Puerto Vallarta into natural, concise US English news style. "
                : "Translate this short Mexican local-news Facebook post from Puerto Vallarta into natural US English news style, same length. ") +
              "Keep place names in Spanish (Malecón, Río Cuale, Bahía de Banderas). Do not add facts. " +
              "Reply with the translation only, no quotes, no emojis, no hashtags.",
            maxOutputTokens: 4096,
            temperature: 0.2,
          },
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), 12000)),
      ]));
      let t = (res.text || "").trim().replace(/^["“']|["”']$/g, "");
      if (tipo === "headline") t = t.split("\n")[0].trim();
      else t = t.replace(/\s*\n+\s*/g, " ").trim();
      // 2026-11-05: salió en Facebook "EN: Sentence 2:*" (el modelo dejó notas de
      // su razonamiento en vez de la traducción). Eso se descarta.
      const basura = /\bsentence\s*\d|^\s*(en|english|translation)\s*:|\*\s*$|^\s*\*/i.test(t);
      if (t && !basura && t.length <= (tipo === "headline" ? 220 : 900) && t.toLowerCase() !== titulo.toLowerCase()) {
        cache.set(clave, t);
        return t;
      }
      console.error(`[traducir] respuesta vacía o rara (${tipo}, intento ${intento + 1})`);
    } catch (err) {
      if (err instanceof CuotaAgotadaError) return null;
      console.error(`[traducir] falló (${tipo}, intento ${intento + 1}):`, err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}
