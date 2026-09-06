export type ParsedArticle = { title: string; excerpt: string; bodyParagraphs: string[] };

/**
 * ¿Es "firstLine" un encabezado de sección? La plantilla del prompt
 * editorial sugiere QUÉ PASÓ / LO QUE SABEMOS / LO QUE DICEN LAS
 * AUTORIDADES / CONTEXTO / QUÉ SIGUE, pero el modelo a veces inventa una
 * variante razonable (p. ej. "LO QUE NO SABEMOS"). En vez de una lista
 * fija, se detecta cualquier línea corta, toda en mayúsculas, seguida de
 * más contenido en el mismo bloque — así no se rompe si el modelo usa
 * una redacción distinta a la esperada.
 */
function looksLikeSectionHeader(firstLine: string, hasMoreLines: boolean): boolean {
  const trimmed = firstLine.trim().replace(/:$/, "");
  if (!hasMoreLines) return false;
  if (trimmed.length === 0 || trimmed.length > 45) return false;
  return trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed);
}

/**
 * Convierte el draft crudo que devuelve la IA (con **TITULAR:**,
 * **BAJADA:** y encabezados de sección en negritas, siguiendo la
 * plantilla de editorialPrompt.ts) en piezas limpias listas para
 * mostrar: título y bajada aparte (nunca duplicados en el cuerpo), y un
 * arreglo de párrafos donde los encabezados de sección quedan marcados
 * como `## ENCABEZADO` (el renderer de /noticia/[slug] los pinta como
 * subtítulo real, no como texto con asteriscos sueltos).
 *
 * Sin dependencias de servidor a propósito — lo usan tanto el pipeline
 * automático (autoPublish.ts) como el botón del panel en el navegador
 * (GenerateArticleButton.tsx).
 */
export function parseArticleDraft(draft: string): ParsedArticle {
  const blocks = draft
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  let title = "";
  let excerpt = "";
  const bodyParagraphs: string[] = [];

  for (const block of blocks) {
    const clean = block.replace(/\*\*/g, "");
    if (/^TITULAR:?/i.test(clean)) {
      title = clean.replace(/^TITULAR:?\s*/i, "").trim();
      continue;
    }
    if (/^BAJADA:?/i.test(clean)) {
      excerpt = clean.replace(/^BAJADA:?\s*/i, "").trim();
      continue;
    }
    const lines = clean.split("\n");
    if (looksLikeSectionHeader(lines[0], lines.length > 1)) {
      const header = lines[0].trim().replace(/:$/, "");
      bodyParagraphs.push(`## ${header}`);
      // El resto del bloque puede venir como varias líneas reales O como
      // una sola línea con viñetas pegadas ("- item uno - item dos"),
      // según cómo lo haya escrito el modelo — se junta todo y se
      // vuelve a partir por el patrón de viñeta, cubra ambos casos.
      const rest = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
      if (rest.startsWith("-")) {
        rest
          .replace(/^-\s*/, "")
          .split(/\s-\s(?=[A-ZÁÉÍÓÚÑ¿])/)
          .map((b) => b.trim())
          .filter(Boolean)
          .forEach((b) => bodyParagraphs.push(`• ${b}`));
      } else if (rest) {
        bodyParagraphs.push(rest);
      }
      continue;
    }
    bodyParagraphs.push(clean.replace(/\s+/g, " ").trim());
  }

  if (!title) title = bodyParagraphs[0] || "Sin título";
  title = title.replace(/^#+\s*/, "").trim(); // nunca dejar pasar un "##" crudo como título
  return { title, excerpt, bodyParagraphs };
}
