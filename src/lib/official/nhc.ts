import Parser from "rss-parser";

/**
 * Avisos oficiales de ciclones del Centro Nacional de Huracanes (NHC/NOAA)
 * para el Pacífico oriental, en español. Es la misma fuente que alimenta
 * las notas automáticas (ver sources.ts → "nhc-pacifico-oriental"); aquí
 * se lee en vivo para mostrar el aviso vigente en /proteccion-civil.
 */
const FEED_URL = "https://www.nhc.noaa.gov/index-ep-sp.xml";
const LOCAL_COAST = /cabo corrientes|puerto vallarta|vallarta|jalisco|nayarit|punta mita|san blas|islas mar[ií]as|playa p[eé]rula|manzanillo/i;

export type OfficialAdvisory = {
  /** P. ej. "Huracán Simon". */
  system: string;
  /** P. ej. "Aviso público núm. 14a". */
  label: string;
  /** Frase de encabezado del aviso, si se pudo extraer. */
  headline: string | null;
  publishedAt: string | null;
  url: string;
};

const parser = new Parser({ timeout: 6000 });

function sentenceCase(text: string): string {
  const lower = text.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Avisos públicos vigentes que mencionan la costa de Jalisco o Nayarit. Nunca lanza: sin conexión devuelve []. */
export async function getLocalStormAdvisories(): Promise<OfficialAdvisory[]> {
  try {
    const feed = await parser.parseURL(FEED_URL);
    return (feed.items || [])
      .filter((item) => /aviso p[uú]blico/i.test(item.title || ""))
      .filter((item) => LOCAL_COAST.test(`${item.title || ""} ${item.contentSnippet || item.content || ""}`))
      .map((item) => {
        const title = (item.title || "").replace(/\*/g, "").trim();
        const match = title.match(/^(.*?)\s+Aviso P[uú]blico\s+N[uú]mero\s+(\S+)/i);
        const body = item.contentSnippet || "";
        // El aviso abre con una o dos frases entre puntos suspensivos: "...SIMON SE FORTALECE...".
        const lead = body.match(/\.\.\.([^.]{12,220})\.\.\./);
        return {
          system: match ? match[1].trim() : title,
          label: match ? `Aviso público núm. ${match[2]}` : "Aviso público",
          headline: lead ? sentenceCase(lead[1].replace(/\s+/g, " ")) : null,
          publishedAt: item.isoDate || null,
          url: item.link || "https://www.nhc.noaa.gov/?epac",
        };
      });
  } catch {
    return [];
  }
}
