import type { IngestedItem } from "./types";
import { SOURCES } from "./sources";

/**
 * Story Graph — agrupa items de distintas fuentes que cubren el MISMO
 * evento real bajo un solo STORY ID, en vez de crear un artículo por
 * cada fuente que lo menciona (regla del propietario: "no crear cinco
 * artículos por cinco fuentes del mismo evento"). Ver
 * /docs/N8N_AUTOMATION.md, sección "Story Graph".
 *
 * No usa IA: es clustering por similitud de texto (Jaccard sobre
 * palabras significativas del título/resumen) + cercanía temporal.
 * Es deliberadamente simple porque no hay API de IA conectada todavía
 * (requiere ANTHROPIC_API_KEY) — cuando exista, este es el punto exacto
 * donde se puede sustituir por un clustering semántico más fino; la
 * forma de una Story (un STORY ID, varias fuentes, se actualiza en el
 * tiempo, nunca se duplica) no cambia.
 */

export type Story = {
  storyId: string;
  /** Título representativo INTERNO para identificar la historia en el panel — NUNCA el titular publicado (ese lo escribe la redacción/IA, 100% original). */
  labelSeed: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  items: IngestedItem[];
  sourceIds: string[];
  sourceCount: number;
  /** Niveles (A/B/C/D) que ya cubren esta historia — ver sources.ts. */
  levels: string[];
  /** true si al menos una fuente NIVEL A o B (periodística/oficial) cubre la historia — condición mínima para redactarla. */
  hasCorroboration: boolean;
  maxNewsScore: number;
  needsReview: boolean;
};

const SOURCE_LEVEL_BY_ID = new Map(SOURCES.map((s) => [s.id, s.level]));

const STOPWORDS = new Set([
  "de", "la", "el", "en", "y", "a", "que", "del", "los", "las", "un", "una", "con", "por", "para", "se", "su",
  "es", "al", "lo", "como", "mas", "sin", "sobre", "entre", "tras", "este", "esta", "estos", "estas", "fue",
  "the", "and", "of", "in", "to", "for", "on", "with", "an", "is", "are", "at", "by", "from", "as", "it", "its", "after", "over",
]);

function normalizeTokens(text: string): Set<string> {
  const stripped = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const words = stripped.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Umbral calibrado para títulos cortos de noticias reales: dos titulares
// distintos sobre el mismo evento suelen compartir 3-5 palabras clave.
const SIMILARITY_THRESHOLD = 0.34;
const MAX_HOURS_APART = 72;

function hoursApart(a: string | null, b: string | null): number {
  if (!a || !b) return 0; // si falta fecha, no penalizar por tiempo
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "historia"
  );
}

/**
 * Agrupa una lista de IngestedItem (de cualquier número de fuentes) en
 * Stories. Unión por similitud de título+resumen y cercanía temporal —
 * union-find clásico sobre pares similares.
 */
export function buildStoryGraph(items: IngestedItem[]): Story[] {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const tokenSets = items.map((it) => normalizeTokens(`${it.title} ${it.excerpt}`));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hoursApart(items[i].publishedAt, items[j].publishedAt) > MAX_HOURS_APART) continue;
      if (jaccard(tokenSets[i], tokenSets[j]) >= SIMILARITY_THRESHOLD) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const usedIds = new Set<string>();
  const stories: Story[] = [];

  for (const indices of groups.values()) {
    const groupItems = indices
      .map((i) => items[i])
      .sort((a, b) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return ta - tb;
      });

    const first = groupItems[0];
    const dates = groupItems.map((it) => it.publishedAt).filter((d): d is string => !!d);
    const firstSeenAt = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : first.discoveredAt;
    const lastUpdatedAt = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : first.discoveredAt;

    let storyId = `story-${slugify(first.title)}`;
    let suffix = 2;
    while (usedIds.has(storyId)) {
      storyId = `story-${slugify(first.title)}-${suffix}`;
      suffix++;
    }
    usedIds.add(storyId);

    const sourceIds = Array.from(new Set(groupItems.map((it) => it.sourceId)));
    const levels = Array.from(new Set(sourceIds.map((id) => SOURCE_LEVEL_BY_ID.get(id) || "?")));

    stories.push({
      storyId,
      labelSeed: first.title,
      firstSeenAt,
      lastUpdatedAt,
      items: groupItems,
      sourceIds,
      sourceCount: sourceIds.length,
      levels,
      hasCorroboration: levels.includes("A") || levels.includes("B"),
      maxNewsScore: Math.max(...groupItems.map((it) => it.newsScore)),
      needsReview: groupItems.some((it) => it.status === "needs_review"),
    });
  }

  return stories.sort((a, b) => b.maxNewsScore - a.maxNewsScore);
}
