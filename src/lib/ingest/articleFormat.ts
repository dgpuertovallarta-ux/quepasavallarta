export type ParsedArticle = { title: string; excerpt: string; bodyParagraphs: string[] };

/**
 * El prompt editorial le pide a la IA que, si el material es
 * insuficiente, devuelva un "resumen interno" en vez de un artículo
 * completo (ver editorialPrompt.ts). Se usa para: (1) en autoPublish.ts,
 * nunca publicar eso solo, sin excepción; (2) en el flujo manual del
 * panel, mostrar una advertencia clara sin bloquear la revisión — un
 * humano decide si investiga más o descarta la Story.
 */
export function looksLikeInsufficientMaterial(draft: string): boolean {
  return /RESUMEN\s+INTERNO|INVESTIGACI[OÓ]N\s+PENDIENTE|no\s+hay\s+suficiente\s+informaci[oó]n/i.test(draft.slice(0, 200));
}

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

// Línea que solo es un separador markdown ("---", "***", "___").
const SEPARATOR_RE = /^(?:[-*_]\s*){3,}$/;
// Eco del identificador interno que va en el prompt ("STORY ID: story-…").
// El modelo a veces lo repite al inicio del borrador — nunca es contenido.
const STORY_ID_RE = /^[`*#\s]*STORY\s*ID\b\s*:?/i;

/** ¿El título no sirve para mostrarse? (vacío, separador o el identificador interno de la historia). */
export function isBadTitle(title: string): boolean {
  const t = (title || "").trim();
  return !t || t === "Sin título" || STORY_ID_RE.test(t) || SEPARATOR_RE.test(t);
}

/** Quita marcas de markdown en línea (**negritas**, *cursivas*, `código`) dejando solo el texto. */
export function stripInlineMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[\s(¿¡"“|])\*(?!\s)([^*]+?)\*(?=$|[\s).,;:!?"”|])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isShoutedHeader(p: string): boolean {
  const t = p.replace(/:$/, "").trim();
  if (t.length === 0 || t.length > 60 || /[.]$/.test(t)) return false;
  return t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3,}/.test(t);
}

/**
 * Limpia los párrafos del cuerpo de una nota para mostrarlos: quita
 * separadores y el eco del STORY ID, convierte encabezados en mayúsculas
 * sueltos en `## ENCABEZADO`, parte listas que vienen pegadas en una sola
 * línea ("* uno * dos", "1. uno 2. dos") y elimina asteriscos de markdown.
 * Se aplica tanto al redactar (parseArticleDraft) como al leer notas ya
 * guardadas (db/articles.ts), para corregir también las publicadas antes.
 */
export function sanitizeParagraphs(paragraphs: string[]): string[] {
  const out: string[] = [];
  for (const raw of paragraphs) {
    const p = (raw || "").trim();
    if (!p || SEPARATOR_RE.test(p) || STORY_ID_RE.test(p)) continue;
    if (p.startsWith("## ")) {
      const header = stripInlineMarkdown(p.slice(3)).replace(/:$/, "");
      if (header) out.push(`## ${header}`);
      continue;
    }
    if (/^[*•-]\s+\S/.test(p)) {
      p.replace(/^[*•-]\s+/, "")
        .split(/\s[*•]\s+(?=\S)|\s-\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“])/)
        .map((item) => stripInlineMarkdown(item))
        .filter(Boolean)
        .forEach((item) => out.push(`• ${item}`));
      continue;
    }
    if (/^1[.)]\s+\S/.test(p)) {
      p.split(/\s(?=\d{1,2}[.)]\s+[A-ZÁÉÍÓÚÑ¿¡"“])/)
        .map((item) => stripInlineMarkdown(item))
        .filter(Boolean)
        .forEach((item) => out.push(item));
      continue;
    }
    const text = stripInlineMarkdown(p);
    if (!text) continue;
    out.push(isShoutedHeader(text) ? `## ${text.replace(/:$/, "")}` : text);
  }
  return out;
}

const isPlainParagraph = (p: string | undefined): p is string => !!p && !p.startsWith("## ") && !p.startsWith("• ");

/**
 * Deja una nota lista para mostrarse: cuerpo limpio (sanitizeParagraphs)
 * y, si el título guardado no sirve (p. ej. "STORY ID: …"), lo recupera
 * del primer párrafo del cuerpo — que es donde el modelo puso el titular
 * real cuando no usó la etiqueta TITULAR — y hace lo mismo con la bajada.
 * Si no hay de dónde sacarlo, devuelve título vacío para que quien llama
 * decida no publicarla o no listarla.
 */
export function repairArticle(input: ParsedArticle): ParsedArticle {
  const body = sanitizeParagraphs(input.bodyParagraphs);
  let title = stripInlineMarkdown(input.title).replace(/^(?:#{1,6}\s*)+/, "").trim();
  let excerpt = stripInlineMarkdown(input.excerpt);

  if (isBadTitle(title)) {
    title = "";
    const first = body[0];
    if (isPlainParagraph(first) && first.length <= 220) {
      title = first.replace(/\.$/, "");
      body.shift();
      const next = body[0];
      if (!excerpt && isPlainParagraph(next) && next.length <= 420 && (body[1] === undefined || body[1].startsWith("## "))) {
        excerpt = next;
        body.shift();
      }
    }
  }
  // El titular o la bajada nunca se repiten como primer párrafo del cuerpo.
  while (body.length && (body[0] === title || body[0] === excerpt)) body.shift();
  return { title, excerpt, bodyParagraphs: body };
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
    // Gemini a veces devuelve encabezados con varios "#" apilados (p. ej.
    // "## ### QUÉ PASÓ") en vez de un solo nivel — se limpian todos los
    // marcadores de encabezado markdown al inicio de línea antes de
    // detectar si es un encabezado de sección, para no dejarlos pasar
    // crudos al título ni al cuerpo.
    const clean = block
      .replace(/\*\*/g, "")
      .replace(/^(?:#{1,6}\s*)+/gm, "")
      // El eco del STORY ID y los separadores "---" nunca son contenido.
      .split("\n")
      .filter((line) => !STORY_ID_RE.test(line) && !SEPARATOR_RE.test(line.trim()))
      .join("\n")
      .trim();
    if (!clean) continue;
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

  // Si el modelo no usó la etiqueta TITULAR, repairArticle toma el titular
  // (y la bajada) de los primeros párrafos; si aun así no hay un título
  // utilizable lo deja vacío — autoPublish/explicaPublish no publican eso.
  return repairArticle({ title, excerpt, bodyParagraphs });
}
