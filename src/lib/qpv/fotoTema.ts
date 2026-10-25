/**
 * Foto del TEMA de la nota para el fondo de la tarjeta sin foto (2026-10-24).
 *
 * El propietario pidió que la foto tenga que ver con lo que dice la nota:
 * si es un choque, un choque; si es San Pancho, San Pancho — no un atardecer.
 * 1. La IA lee titular + resumen y propone qué buscar (lugar concreto y/o
 *    el hecho: "car crash", "landslide", "San Pancho Nayarit beach"…).
 * 2. Se busca en Wikimedia Commons (fotos de uso libre, con autor y licencia).
 * Nunca lanza: si algo falla, devuelve null y se usa el banco de archivo.
 */
import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const UA = "QuePasaVallartaBot/1.0 (https://quepasavta.com; contacto via sitio)";
const LICENCIAS_OK = /^(cc0|public domain|pd|cc by(-sa)? ?[0-9.]*|cc-by(-sa)?-[0-9.]+)/i;

export type FotoTema = { url: string; credito: string; busqueda: string };

async function busquedas(titulo: string, resumen: string): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await Promise.race([
      client.models.generateContent({
        model: MODEL,
        contents: `Titular: ${titulo}\nResumen: ${resumen}`,
        config: {
          systemInstruction:
            "Eres editor de fotografía de un noticiero local de Puerto Vallarta. Necesitamos una foto de ARCHIVO (Wikimedia Commons) " +
            "que muestre de qué trata la nota. Devuelve 2 o 3 búsquedas cortas en inglés, de la más específica a la más general, una por línea, sin numerar. " +
            "Si la nota es de un HECHO (choque, incendio, inundación, deslave, detención, obra, apagón, dengue, cierre de calle…), la primera búsqueda es el hecho " +
            "(ej. 'car crash street', 'house fire firefighters', 'flooded street', 'mosquito aedes'). " +
            "Si trata de un LUGAR concreto (San Pancho, Sayulita, Bucerías, Mismaloya, Punta de Mita, Río Cuale, Ixtapa…), incluye el lugar " +
            "(ej. 'San Pancho Nayarit beach'). Nunca atardeceres ni paisajes genéricos si no tienen que ver. Solo las búsquedas.",
          maxOutputTokens: 2048,
          temperature: 0.2,
        },
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
    ]);
    return (res.text || "")
      .split("\n")
      .map((l) => l.replace(/^[-*\d.)\s"']+|["']$/g, "").trim())
      .filter((l) => l.length > 2 && l.length < 60)
      .slice(0, 3);
  } catch {
    return [];
  }
}

const sinHtml = (s?: string) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

type Pagina = {
  title: string;
  index?: number;
  imageinfo?: { thumburl?: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value?: string }> }[];
};

async function commons(q: string): Promise<FotoTema | null> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12" +
    `&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) return null;
  const j = (await r.json()) as { query?: { pages?: Record<string, Pagina> } };
  const paginas = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of paginas) {
    const ii = p.imageinfo?.[0];
    if (!ii?.thumburl || !/jpe?g|png|webp/.test(ii.mime) || ii.width < 700 || ii.height < 450) continue;
    const md = ii.extmetadata ?? {};
    const licencia = sinHtml(md.LicenseShortName?.value);
    if (!LICENCIAS_OK.test(licencia)) continue;
    if (/logo|map|mapa|diagram|chart|flag|bandera|coat of arms|escudo|poster|screenshot/i.test(p.title)) continue;
    const autor = sinHtml(md.Artist?.value).slice(0, 40);
    return { url: ii.thumburl, credito: `Foto de archivo · ${autor ? `${autor} · ` : ""}${licencia} · Wikimedia`, busqueda: q };
  }
  return null;
}

export async function fotoDelTema(titulo: string, resumen = ""): Promise<FotoTema | null> {
  try {
    for (const q of await busquedas(titulo, resumen)) {
      const f = await commons(q).catch(() => null);
      if (f) return f;
    }
  } catch {
    /* sin foto del tema */
  }
  return null;
}
