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
  const maxExcerpt = source.maxExcerpt || 240;

  return (feed.items || [])
    .filter((item) => {
      if (source.titleInclude && !source.titleInclude.test(item.title || "")) return false;
      if (source.mustMention) {
        const fullText = `${item.title || ""} ${item.contentSnippet || item.content || ""}`;
        if (!source.mustMention.test(fullText)) return false;
      }
      return true;
    })
    // Un agregador ordena por relevancia, no por fecha: aquí interesa lo más nuevo.
    .sort((a, b) => (source.aggregator ? +new Date(b.isoDate || 0) - +new Date(a.isoDate || 0) : 0))
    .slice(0, 20)
    .map((item) => {
      let title = item.title?.trim() || "(sin título)";
      let sourceName = source.name;
      if (source.aggregator) {
        // Google Noticias titula "Titular - Medio": se separa el medio
        // para que quede registrado quién publicó cada titular.
        const cut = title.lastIndexOf(" - ");
        if (cut > 20) {
          sourceName = `${title.slice(cut + 3).trim()} (vía Google Noticias)`;
          title = title.slice(0, cut).trim();
        }
      }
      // En un agregador el "resumen" solo repite el titular: no aporta nada.
      const rawExcerpt = source.aggregator ? "" : (item.contentSnippet || item.content || "").trim();
      const excerpt = rawExcerpt.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").slice(0, maxExcerpt);
      const publishedAt = item.isoDate || item.pubDate || null;
      const score = computeNewsScore({ source, publishedAt, title });
      const { status, reason } = decideStatus({ source, score, title, excerpt });

      return {
        sourceId: source.id,
        sourceName,
        trustLevel: source.trustLevel,
        title,
        link: item.link || source.url,
        publishedAt,
        excerpt,
        categoryGuess: guessCategory(`${title} ${excerpt.slice(0, 400)}`),
        newsScore: score,
        status,
        statusReason: reason,
        discoveredAt: now,
      };
    });
}
