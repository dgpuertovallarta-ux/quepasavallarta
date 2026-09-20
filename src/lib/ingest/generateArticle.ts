import { GoogleGenAI } from "@google/genai";
import { EDITORIAL_SYSTEM_PROMPT, EXPLICA_SYSTEM_PROMPT, buildEditorialUserPrompt } from "./editorialPrompt";
import type { Story } from "./storyGraph";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export type GeneratedArticle = {
  storyId: string;
  model: string;
  draft: string;
  generatedAt: string;
};

function assertCanGenerate(story: Story) {
  if (!isAiConfigured()) {
    throw new Error(
      "GEMINI_API_KEY no está configurada — la redacción con IA está lista " +
        "en el código (editorialPrompt.ts + generateArticle.ts) pero inactiva. " +
        "Ver /docs/ARCHITECTURE.md §8."
    );
  }
  if (!story.hasCorroboration) {
    throw new Error(
      `La historia "${story.labelSeed}" (${story.storyId}) solo tiene fuentes NIVEL C/D ` +
        "— no hay corroboración de un medio (NIVEL A) o fuente oficial (NIVEL B). " +
        "No se redacta como hecho confirmado; requiere investigación humana primero."
    );
  }
}

// El tier gratuito de Gemini a veces devuelve 503 "high demand" — es
// transitorio (congestión del lado de Google, no un error de la
// petición), así que se reintenta una vez antes de darse por vencido.
async function callGemini(systemPrompt: string, story: Story): Promise<GeneratedArticle> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const request = {
    model: MODEL,
    contents: buildEditorialUserPrompt(story),
    config: { systemInstruction: systemPrompt, maxOutputTokens: 4096 },
  };

  let response;
  try {
    response = await client.models.generateContent(request);
  } catch (err) {
    const isOverloaded = err instanceof Error && /503|UNAVAILABLE|high demand/i.test(err.message);
    if (!isOverloaded) throw err;
    await new Promise((r) => setTimeout(r, 2500));
    response = await client.models.generateContent(request);
  }

  const draft = (response.text || "").trim();

  return { storyId: story.storyId, model: MODEL, draft, generatedAt: new Date().toISOString() };
}

/**
 * Genera un borrador de NOTICIA breve llamando a la API de Gemini con el
 * prompt editorial completo (editorialPrompt.ts). Dos guardas duras antes
 * de llamar a la IA, ninguna evitable:
 *
 *  1. Sin GEMINI_API_KEY configurada, lanza error explícito — nunca
 *     inventa un borrador falso.
 *  2. Sin corroboración de una fuente NIVEL A o B (story.hasCorroboration),
 *     se niega a redactar — una Story vista solo por NIVEL C/D es apenas
 *     una señal a investigar, no un hecho publicable.
 *
 * El resultado SIEMPRE es un borrador (`GeneratedArticle`) para revisión
 * humana — esta función nunca publica nada por sí sola.
 */
export async function generateArticleDraft(story: Story): Promise<GeneratedArticle> {
  assertCanGenerate(story);
  // No se bloquea aquí el caso de "resumen interno" a propósito: esta
  // función la usan tanto la auto-publicación (sin humano — ahí SÍ se
  // bloquea, ver autoPublish.ts) como el botón manual del panel, donde
  // un humano pidió explícitamente generar el borrador y debe poder
  // verlo para decidir él mismo. Ver looksLikeInsufficientMaterial.
  return callGemini(EDITORIAL_SYSTEM_PROMPT, story);
}

/**
 * Genera un borrador de "Vallarta Explica" (explicación a fondo, no
 * noticia breve) — mismas guardas duras que generateArticleDraft, con el
 * prompt EXPLICA_SYSTEM_PROMPT (estructura QUÉ PASÓ/POR QUÉ IMPORTA/LO
 * QUE SABEMOS/LO QUE NO SABEMOS/CONTEXTO/QUÉ SIGUE).
 */
export async function generateExplainerDraft(story: Story): Promise<GeneratedArticle> {
  assertCanGenerate(story);
  return callGemini(EXPLICA_SYSTEM_PROMPT, story);
}
