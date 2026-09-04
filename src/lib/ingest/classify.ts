/**
 * Clasificación y News Score reales — ver /docs/N8N_AUTOMATION.md.
 * Esto NO es un mock: procesa el título/resumen real que llega del feed.
 * Es deliberadamente simple (palabras clave) porque todavía no hay una
 * API de IA conectada (requiere ANTHROPIC_API_KEY del usuario) — en
 * cuanto exista, este archivo es el punto exacto donde se sustituye la
 * heurística por una llamada real a Claude para clasificar/redactar.
 */
import type { Source } from "./sources";

// Categorías que SIEMPRE requieren revisión humana, sin importar el score
// (sección "Publicación automática vs. revisión humana" del brief).
// IMPORTANTE: algunas fuentes reales (p. ej. Vallarta Daily News) publican
// en inglés, así que cada categoría necesita palabras clave en ambos
// idiomas — un detector solo en español deja pasar contenido sensible
// real sin marcar.
const SENSITIVE_KEYWORDS: { category: string; words: string[] }[] = [
  {
    category: "seguridad",
    words: [
      "homicidio", "muerte", "muere", "asesinato", "balacera", "detenido", "arrestado", "narco", "crimen", "violencia", "robo", "asalto", "policía", "policia", "delito", "tiroteo",
      "homicide", "murder", "killed", "shooting", "shot", "crime", "arrested", "police", "assault", "robbery", "violence", "cartel", "gang",
    ],
  },
  { category: "politica", words: ["elección", "candidato", "partido", "alcalde electo", "campaña política", "election", "candidate", "political party", "mayor-elect"] },
  { category: "comunidad", words: ["desaparecido", "desaparecida", "busqueda", "búsqueda", "missing person", "disappeared", "search for"] },
  { category: "salud", words: ["hospital", "brote", "epidemia", "enfermedad", "outbreak", "epidemic", "disease", "surgery", "cirugía", "cancer", "cáncer"] },
];

// Palabras clave en español E inglés — las fuentes reales conectadas
// hasta ahora incluyen medios que publican en inglés (PVDN).
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  seguridad: ["homicidio", "muerte", "muere", "asesinato", "balacera", "detenido", "arrestado", "narco", "crimen", "violencia", "robo", "asalto", "policía", "policia", "delito", "tiroteo", "homicide", "murder", "killed", "shooting", "shot", "crime", "arrested", "police", "assault", "robbery", "violence", "cartel"],
  transito: ["tráfico", "trafico", "vialidad", "carril", "accidente", "choque", "circulación", "traffic", "crash", "road", "tunnel", "lane"],
  clima: ["lluvia", "huracán", "huracan", "tormenta", "clima", "temperatura", "rain", "hurricane", "storm", "weather", "flood"],
  turismo: ["turista", "turismo", "hotel", "ocupación hotelera", "vuelo", "aeropuerto", "tourist", "tourism", "flight", "airport"],
  playas: ["playa", "oleaje", "bandera azul", "beach", "swell", "coastal"],
  cultura: ["festival", "arte", "cultural", "exposición", "música", "exhibit", "music", "gallery", "painting"],
  deportes: ["torneo", "deportivo", "maratón", "futbol", "fútbol", "tournament", "marathon", "soccer"],
  gobierno: ["ayuntamiento", "cabildo", "alcalde", "municipio", "presupuesto", "city hall", "council", "mayor", "municipal", "budget"],
  economia: ["renta", "precio", "inflación", "económico", "negocio", "rent", "price", "inflation", "economic", "business"],
  servicios: ["basura", "recolección", "agua", "luz", "drenaje", "trash", "garbage", "pickup", "water service", "power outage"],
};

// Compara por PALABRA COMPLETA, no por subcadena — evitar el tipo de bug
// donde una palabra clave corta (p. ej. "art") hace falso positivo dentro
// de otra palabra que la contiene (p. ej. "Vallarta"). Las frases con
// espacio sí se comparan como subcadena (mucho menor riesgo de colisión).
function textContainsKeyword(lowerText: string, keyword: string): boolean {
  if (keyword.includes(" ")) return lowerText.includes(keyword);
  const words = lowerText.split(/[^a-záéíóúñü0-9]+/i);
  return words.includes(keyword);
}

export function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => textContainsKeyword(lower, w))) return category;
  }
  return "comunidad";
}

export function isSensitive(text: string): { sensitive: boolean; category: string | null } {
  const lower = text.toLowerCase();
  for (const { category, words } of SENSITIVE_KEYWORDS) {
    if (words.some((w) => textContainsKeyword(lower, w))) return { sensitive: true, category };
  }
  return { sensitive: false, category: null };
}

/**
 * News Score 0-100 — combina: confiabilidad de la fuente (trust_level),
 * actualidad (qué tan reciente es el item) y una señal simple de
 * relevancia (longitud/calidad del título). Igual que en el brief:
 * 90-100 urgente · 80-89 publicable · 60-79 revisión · 0-59 descartar.
 */
export function computeNewsScore(params: { source: Source; publishedAt: string | null; title: string }): number {
  const { source, publishedAt, title } = params;

  // Confiabilidad de la fuente: trust_level 1 (oficial) = 40 pts, baja 8 pts por nivel.
  const trustScore = Math.max(0, 40 - (source.trustLevel - 1) * 8);

  // Actualidad: hasta 40 pts si es de la última hora, decae con el tiempo.
  let freshnessScore = 20;
  if (publishedAt) {
    const ageMin = (Date.now() - new Date(publishedAt).getTime()) / 60000;
    if (ageMin <= 60) freshnessScore = 40;
    else if (ageMin <= 180) freshnessScore = 32;
    else if (ageMin <= 60 * 24) freshnessScore = 24;
    else freshnessScore = 12;
  }

  // Señal simple de sustancia: títulos muy cortos suelen ser menos noticiosos.
  const substanceScore = title.length >= 40 ? 20 : title.length >= 20 ? 14 : 8;

  return Math.min(100, Math.round(trustScore + freshnessScore + substanceScore));
}

export function decideStatus(params: {
  source: Source;
  score: number;
  title: string;
  excerpt: string;
}): { status: "auto_publishable" | "needs_review" | "discard"; reason: string } {
  const { source, score, title, excerpt } = params;
  const { sensitive, category } = isSensitive(`${title} ${excerpt}`);

  if (sensitive) {
    return { status: "needs_review", reason: `Categoría sensible detectada (${category}) — requiere revisión humana sin importar el score.` };
  }
  if (source.trustLevel >= 3) {
    return { status: "needs_review", reason: "Fuente no oficial (medio de terceros) — redacción y publicación siempre requieren revisión humana." };
  }
  if (score < 60) {
    return { status: "discard", reason: `News Score ${score} < 60 — no se publica.` };
  }
  if (score >= 80 && source.trustLevel === 1) {
    return { status: "auto_publishable", reason: `News Score ${score} y fuente oficial — cumple el umbral de publicación automática.` };
  }
  return { status: "needs_review", reason: `News Score ${score} en rango de revisión (60-79) o fuente no oficial.` };
}
