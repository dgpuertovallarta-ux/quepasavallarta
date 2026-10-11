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

// Nombres propios que el aviso trae en mayúsculas y hay que devolver con su inicial.
const PROPER_NOUNS: [RegExp, string][] = [
  [/\bm[eé]xico\b/g, "México"],
  [/\bjalisco\b/g, "Jalisco"],
  [/\bnayarit\b/g, "Nayarit"],
  [/\bcolima\b/g, "Colima"],
  [/\bmanzanillo\b/g, "Manzanillo"],
  [/\bcabo corrientes\b/g, "Cabo Corrientes"],
  [/\bpuerto vallarta\b/g, "Puerto Vallarta"],
  [/\bbaja california\b/g, "Baja California"],
  [/\bpac[ií]fico\b/g, "Pacífico"],
];

/** "CATEGORIA 4 SIMON A LA DERIVA" → "Categoría 4 Simon a la deriva" (el aviso viene todo en mayúsculas). */
function sentenceCase(text: string, stormName: string): string {
  let out = text.toLowerCase().trim();
  for (const [pattern, proper] of PROPER_NOUNS) out = out.replace(pattern, proper);
  if (stormName) {
    const name = stormName.toLowerCase();
    out = out.split(" ").map((w) => (w === name ? stormName : w)).join(" ");
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
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
        const system = match ? match[1].trim() : title;
        const stormName = system.split(" ").pop() || "";
        return {
          system,
          label: match ? `Aviso público núm. ${match[2]}` : "Aviso público",
          headline: lead ? sentenceCase(lead[1].replace(/\s+/g, " "), stormName) : null,
          publishedAt: item.isoDate || null,
          url: item.link || "https://www.nhc.noaa.gov/?epac",
        };
      });
  } catch {
    return [];
  }
}
