/**
 * Arma la postal de Facebook de una nota con foto de stock difuminada atrás (Wikimedia Commons, uso libre).
 * La deja en la rama "postales" del repo para descargarla (2026-10-28).
 * Variables: POSTAL_TITULO, POSTAL_RESUMEN, POSTAL_CATEGORIA, POSTAL_TITULO_EN, POSTAL_BUSQUEDA, POSTAL_ARCHIVO
 */
import { writeFile } from "node:fs/promises";
import { datosTarjeta, renderTarjeta, fondoDifuminado } from "../../src/lib/qpv/tarjetas";

const UA = "QuePasaVallartaBot/1.0 (https://quepasavta.com)";

async function fotoStock(q: string): Promise<{ url: string; credito: string } | null> {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20" +
    `&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`;
  const j = (await (await fetch(api, { headers: { "User-Agent": UA } })).json()) as { query?: { pages?: Record<string, { index: number; title: string; imageinfo?: { thumburl: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
  const ps = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of ps) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpe?g|png/.test(ii.mime) || ii.width < 900) continue;
    const lic = (ii.extmetadata?.LicenseShortName?.value || "").replace(/<[^>]+>/g, "");
    if (!/^(cc0|public domain|pd|cc by)/i.test(lic)) continue;
    const autor = (ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 40);
    console.log("foto:", p.title, lic);
    return { url: ii.thumburl, credito: `Foto de archivo · ${autor ? autor + " · " : ""}${lic} · Wikimedia` };
  }
  return null;
}

async function main() {
  const e = process.env;
  const d = await datosTarjeta({ titulo: e.POSTAL_TITULO!, categoria: e.POSTAL_CATEGORIA || "transito", clave: e.POSTAL_ARCHIVO || "postal", resumen: e.POSTAL_RESUMEN });
  if (e.POSTAL_TITULO_EN) d.tituloEn = e.POSTAL_TITULO_EN;
  for (const q of (e.POSTAL_BUSQUEDA || "traffic jam street").split("|")) {
    const f = await fotoStock(q.trim());
    const fondo = f ? await fondoDifuminado(f.url) : null;
    if (fondo) { d.fondo = fondo; break; }
  }
  await writeFile(`postales/${e.POSTAL_ARCHIVO || "postal"}.png`, await renderTarjeta(d));
  console.log("listo, con fondo:", !!d.fondo);
}
main().catch((err) => { console.error(err); process.exit(1); });
