import Anthropic from "@anthropic-ai/sdk";
import { EDITORIAL_SYSTEM_PROMPT, buildEditorialUserPrompt } from "./editorialPrompt";
import type { Story } from "./storyGraph";

const MODEL = "claude-sonnet-5";

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type GeneratedArticle = {
  storyId: string;
  model: string;
  draft: string;
  generatedAt: string;
};

/**
 * Genera un borrador de artículo real llamando a la API de Claude con el
 * prompt editorial completo (editorialPrompt.ts). Dos guardas duras antes
 * de llamar a la IA, ninguna evitable:
 *
 *  1. Sin ANTHROPIC_API_KEY configurada, lanza error explícito — nunca
 *     inventa un borrador falso.
 *  2. Sin corroboración de una fuente NIVEL A o B (story.hasCorroboration),
 *     se niega a redactar — una Story vista solo por NIVEL C/D es apenas
 *     una señal a investigar, no un hecho publicable.
 *
 * El resultado SIEMPRE es un borrador (`GeneratedArticle`) para revisión
 * humana — esta función nunca publica nada por sí sola.
 */
export async function generateArticleDraft(story: Story): Promise<GeneratedArticle> {
  if (!isAiConfigured()) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada — la redacción con IA está lista " +
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: EDITORIAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildEditorialUserPrompt(story) }],
  });

  const draft = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return { storyId: story.storyId, model: MODEL, draft, generatedAt: new Date().toISOString() };
}
