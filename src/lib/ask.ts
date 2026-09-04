import { NEWS, EXPLICA, getCategoryName, type NewsItem, type ExplicaItem } from "./data";

const STOPWORDS = new Set([
  "que", "el", "la", "los", "las", "de", "en", "hay", "un", "una", "para", "con", "y", "a", "esta",
  "semana", "hoy", "sobre", "qué", "¿", "?",
]);

function tokenize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

export type AskResult =
  | { kind: "noticia"; ref: NewsItem }
  | { kind: "explica"; ref: ExplicaItem };

export function searchAsk(query: string): AskResult[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const pool: { kind: AskResult["kind"]; ref: NewsItem | ExplicaItem; text: string }[] = [
    ...NEWS.map((n) => ({
      kind: "noticia" as const,
      ref: n,
      text: `${n.title} ${n.dek} ${n.body.join(" ")} ${getCategoryName(n.category)}`,
    })),
    ...EXPLICA.map((e) => ({
      kind: "explica" as const,
      ref: e,
      text: `${e.title} ${e.dek} ${e.quePaso} ${e.contexto}`,
    })),
  ];

  const scored = pool
    .map((item) => {
      const hay = tokenize(item.text);
      const hits = tokens.filter((t) => hay.some((h) => h.includes(t) || t.includes(h)));
      return { ...item, hits: hits.length };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  return scored.slice(0, 5) as AskResult[];
}
