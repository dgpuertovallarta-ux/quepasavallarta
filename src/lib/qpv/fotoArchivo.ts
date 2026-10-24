/**
 * Foto DE ARCHIVO relacionada con la nota (2026-10).
 *
 * Para no tomar las fotos de otros medios (se veía que copiábamos a Noticias PV),
 * cuando la fuente no es oficial se busca una foto real del LUGAR o del TEMA de
 * la nota en el banco de Wikimedia (photos.ts), y se marca "Foto de archivo".
 * Solo se usa si la nota trata de algo concreto (Río Cuale, Malecón, aeropuerto,
 * lluvias…). 2026-10: para que la foto SIEMPRE tenga que ver, los temas solo
 * cuentan si están en el TÍTULO (antes bastaba que el resumen dijera "lluvias"
 * y una nota de dengue salía con foto de tormenta). Si no hay nada seguro,
 * no hay foto y en redes sale la tarjeta tipográfica QPV.
 */
import { PHOTOS, PHOTO_CREDITS, type PhotoKey } from "../photos";

const REGLAS: { re: RegExp; fotos: PhotoKey[]; soloTitulo?: boolean }[] = [
  // Lugares concretos primero
  { re: /r[ií]o cuale|isla (del )?r[ií]o cuale/i, fotos: ["rioCuale"] },
  { re: /aeropuerto/i, fotos: ["aeropuertoTorre", "aeropuertoInterior", "aeropuertoPista"] },
  { re: /malec[oó]n/i, fotos: ["maleconGeneral", "maleconPaseo", "faroMalecon", "malecon2014"] },
  { re: /catedral|parroquia de (nuestra se[ñn]ora de )?guadalupe|templo de guadalupe/i, fotos: ["iglesiaGuadalupe"] },
  { re: /playa (de )?los muertos|zona rom[aá]ntica|olas altas/i, fotos: ["playaMuertos"] },
  { re: /mercado (municipal|del r[ií]o cuale|de artesan)/i, fotos: ["mercadoCuale", "mercadoPuente"] },
  // "crucero" a secas en México también es un cruce de calles: solo cruceros de barco.
  { re: /marina vallarta|cruceros? (tur[ií]stic|de pasajeros|atrac|arrib|lleg)|cruceristas|(llegan?|arriban?|recibe)[^.]{0,30}\bcruceros?\b|cruceros? (a|en) (puerto )?vallarta|terminal mar[ií]tima|muelle/i, fotos: ["marinaFaro", "barcos"] },
  { re: /ballena/i, fotos: ["ballena"] },
  { re: /plaza de armas|presidencia municipal|palacio municipal|centro hist[oó]rico/i, fotos: ["plazaArmas", "kiosco"] },
  { re: /(en el|del|al) centro de (puerto )?vallarta|zona centro|colonia (el )?centro/i, fotos: ["calleSombrillas", "callePapelPicado", "plazaArmas"] },
  // Temas
  { re: /hurac[aá]n|tormenta|cicl[oó]n|lluvias?\b|nublad|chubasc|oleaje|mar de fondo|marejada/i, fotos: ["costaNublada", "marinaNublada", "atardecerNubes", "plazaLluvia"], soloTitulo: true },
  { re: /\bplayas?\b|ba[ñn]istas|salvavidas/i, fotos: ["playa", "costaSur", "playaHoteles", "playaCerro"], soloTitulo: true },
  { re: /gastronom|restaurantes?\b|mariscos|tacos/i, fotos: ["tacos", "ceviche"], soloTitulo: true },
  { re: /turistas|ocupaci[oó]n hotelera|temporada vacacional|puente vacacional/i, fotos: ["maleconPaseo", "playaHoteles", "bahiaCiudad"], soloTitulo: true },
];

const NO_ARCHIVO = /homicid|asesin|balace|dispar|detenid|cad[aá]ver|sin vida|muere|muerto|fallec|accidente|choque|choca|atropell|volcadura|incendio|dengue|hospital|salud|covid|enfermedad|robo|asalt|fiscal|denuncia/i;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export type FotoArchivo = { url: string; credito: string; clave: PhotoKey };

export function fotoDeArchivo(titulo: string, resumen = "", semilla = titulo): FotoArchivo | null {
  const texto = `${titulo} ${resumen}`;
  // El título manda: si el título menciona un lugar/tema, se usa ese aunque el resumen hable de otro.
  // Notas de nota roja, salud o accidentes: una foto bonita de archivo no corresponde.
  if (NO_ARCHIVO.test(titulo.replace(/playa (de )?los muertos/gi, ""))) return null;
  const regla = REGLAS.find((r) => r.re.test(titulo)) ?? REGLAS.find((r) => !r.soloTitulo && r.re.test(texto));
  if (!regla) return null;
  const clave = regla.fotos[hash(semilla) % regla.fotos.length];
  const autor = PHOTO_CREDITS[clave];
  return { url: PHOTOS[clave], credito: `Foto de archivo${autor ? `: ${autor}` : ""}`, clave };
}
