/**
 * Foto DE ARCHIVO relacionada con la nota (2026-10).
 *
 * Para no tomar las fotos de otros medios (se veía que copiábamos a Noticias PV),
 * cuando la fuente no es oficial se busca una foto real del LUGAR o del TEMA de
 * la nota en el banco de Wikimedia (photos.ts), y se marca "Foto de archivo".
 * Solo se usa si la nota menciona algo concreto (Río Cuale, Malecón, aeropuerto,
 * lluvias…): si no hay nada que ver, no hay foto (y en redes no sale).
 */
import { PHOTOS, PHOTO_CREDITS, type PhotoKey } from "../photos";

const REGLAS: { re: RegExp; fotos: PhotoKey[] }[] = [
  // Lugares concretos primero
  { re: /r[ií]o cuale|isla (del )?r[ií]o cuale/i, fotos: ["rioCuale"] },
  { re: /aeropuerto/i, fotos: ["aeropuertoTorre", "aeropuertoInterior", "aeropuertoPista"] },
  { re: /malec[oó]n/i, fotos: ["maleconGeneral", "maleconPaseo", "faroMalecon", "malecon2014"] },
  { re: /catedral|parroquia de (nuestra se[ñn]ora de )?guadalupe|templo de guadalupe/i, fotos: ["iglesiaGuadalupe"] },
  { re: /playa (de )?los muertos|zona rom[aá]ntica|olas altas/i, fotos: ["playaMuertos"] },
  { re: /mercado (municipal|del r[ií]o cuale|de artesan)/i, fotos: ["mercadoCuale", "mercadoPuente"] },
  { re: /marina vallarta|crucero|terminal mar[ií]tima|muelle/i, fotos: ["marinaFaro", "barcos"] },
  { re: /ballena/i, fotos: ["ballena"] },
  { re: /plaza de armas|presidencia municipal|palacio municipal|centro hist[oó]rico/i, fotos: ["plazaArmas", "kiosco"] },
  { re: /(en el|del|al) centro de (puerto )?vallarta|zona centro|colonia (el )?centro/i, fotos: ["calleSombrillas", "callePapelPicado", "plazaArmas"] },
  // Temas
  { re: /hurac[aá]n|tormenta|cicl[oó]n|lluvia|nublad|chubasc|oleaje|mar de fondo|marejada/i, fotos: ["costaNublada", "marinaNublada", "atardecerNubes", "plazaLluvia"] },
  { re: /\bplayas?\b|ba[ñn]istas|salvavidas/i, fotos: ["playa", "costaSur", "playaHoteles", "playaCerro"] },
  { re: /gastronom|restauran|mariscos|tacos/i, fotos: ["tacos", "ceviche"] },
  { re: /turistas|ocupaci[oó]n hotelera|temporada vacacional|puente vacacional/i, fotos: ["maleconPaseo", "playaHoteles", "bahiaCiudad"] },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export type FotoArchivo = { url: string; credito: string; clave: PhotoKey };

export function fotoDeArchivo(titulo: string, resumen = "", semilla = titulo): FotoArchivo | null {
  const texto = `${titulo} ${resumen}`;
  // El título manda: si el título menciona un lugar/tema, se usa ese aunque el resumen hable de otro.
  const regla = REGLAS.find((r) => r.re.test(titulo)) ?? REGLAS.find((r) => r.re.test(texto));
  if (!regla) return null;
  const clave = regla.fotos[hash(semilla) % regla.fotos.length];
  const autor = PHOTO_CREDITS[clave];
  return { url: PHOTOS[clave], credito: `Foto de archivo${autor ? `: ${autor}` : ""}`, clave };
}
