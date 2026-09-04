import Parser from "rss-parser";
import { type Source } from "./sources";
import { type IngestedItem } from "./types";
import { guessCategory, computeNewsScore, decideStatus } from "./classify";

const parser = new Parser({ timeout: 10000 });

/**
 * Descarga y normaliza un feed RSS REAL. Sin datos de ejemplo: si el
 * feed falla o no responde, esta función lanza el error real (no lo
 * disfraza con contenido de relleno) para que quede visible en el
 * panel de "Fuentes y automatización".
 */
export async function fetchSource(source: Source): Promise<IngestedItem[]> {
  if (source.type !== "rss") {
    throw new Error(`Fuente "${source.id}" no es de tipo RSS todavía (tipo: ${source.type}). No implementado.`);
  }

  const feed = await parser.parseURL(source.url);
  const now = new Date().toISOString();

  return (feed.items || []).slice(0, 20).map((item) => {
    const title = item.title?.trim() || "(sin título)";
    const excerpt = (item.contentSnippet || item.content || "").trim().slice(0, 240);
    const publishedAt = item.isoDate || item.pubDate || null;
    const score = computeNewsScore({ source, publishedAt, title });
    const { status, reason } = decideStatus({ source, score, title, excerpt });

    return {
      sourceId: source.id,
      sourceName: source.name,
      trustLevel: source.trustLevel,
      title,
      link: item.link || source.url,
      publishedAt,
      excerpt,
      categoryGuess: guessCategory(`${title} ${excerpt}`),
      newsScore: score,
      status,
      statusReason: reason,
      discoveredAt: now,
    };
  });
}
