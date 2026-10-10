import imageLoader from "./imageLoader";
/**
 * Fotografías reales de Puerto Vallarta, de uso libre (Wikimedia Commons —
 * dominio público o licencias CC that permiten reuso). Se usan como
 * imágenes ILUSTRATIVAS para el contenido demo de este sitio: no implican
 * que la foto corresponda al evento específico de la noticia (que es
 * ficticia). Antes de producción real, considera descargarlas y alojarlas
 * tú mismo (self-host) en vez de enlazar directo a Wikimedia, y conserva
 * la atribución de cada autor según su licencia — ver el mapa abajo.
 *
 * Todas están servidas vía Wikimedia Commons "Special:FilePath" resuelto a
 * su CDN (thumb.wikimedia.org / upload.wikimedia.org), permitido en
 * next.config.ts (images.remotePatterns).
 */

/** Arma la URL de la miniatura de 1280 px de un archivo de Wikimedia Commons a partir de su carpeta y nombre. */
function commons(folder: string, file: string): string {
  const name = encodeURIComponent(file.replace(/ /g, "_"));
  return `https://thumb.wikimedia.org/wikipedia/commons/thumb/${folder}/${name}/1280px-${name}`;
}

export const PHOTOS = {
  malecomAtardecer:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Puerto_Vallarta_Malec%C3%B3n_in_the_evening_light.jpg/1280px-Puerto_Vallarta_Malec%C3%B3n_in_the_evening_light.jpg",
  iglesiaGuadalupe:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Our_Lady_of_Guadalupe_Church%2C_Puerto_Vallarta%2C_2023.jpg/1280px-Our_Lady_of_Guadalupe_Church%2C_Puerto_Vallarta%2C_2023.jpg",
  faroMalecon:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Malec%C3%B3n_Lighthouse%2C_Puerto_Vallarta%2C_2014.jpg/1280px-Malec%C3%B3n_Lighthouse%2C_Puerto_Vallarta%2C_2014.jpg",
  bailarines:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Vallarta_Dancers%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg/1280px-Vallarta_Dancers%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg",
  playaAtardecer: commons("d/df", "Atardecer_en_una_playa_de_Puerto_Vallarta.jpg"),
  playa:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Vallarta_Beach.JPG/1280px-Vallarta_Beach.JPG",
  fuenteAmistad:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Friendship_Fountain%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg/1280px-Friendship_Fountain%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg",
  ninoCaballito:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/The_Boy_on_the_Seahorse%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg/1280px-The_Boy_on_the_Seahorse%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg",
  ceviche:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Ceviche%2C_seafood_tacos%2C_chips%2C_guacamole%2C_beans_%2834662952704%29.jpg/1280px-Ceviche%2C_seafood_tacos%2C_chips%2C_guacamole%2C_beans_%2834662952704%29.jpg",
  tacos:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Pulpo_taco_shrimp_taco_%2838526611045%29.jpg/1280px-Pulpo_taco_shrimp_taco_%2838526611045%29.jpg",
  ballena: commons("6/6a", "Humpback_whale_jumping.jpg"),
  construccion:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Road_Construction_Worker_-_Controlling_Traffic.jpg/1280px-Road_Construction_Worker_-_Controlling_Traffic.jpg",
  maleconGeneral:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/MALECON_DE_PUERTO_VALLARTA.JPG/1280px-MALECON_DE_PUERTO_VALLARTA.JPG",
  // --- Banco ampliado (2026-10): más variedad para que las fotos ilustrativas no se repitan ---
  malecon2014: commons("8/8e", "Malecón, Puerto Vallarta (2014) - 01.JPG"),
  maleconPaseo: commons("e/e8", "Malecón, Puerto Vallarta 2022.jpg"),
  maleconFlores: commons("d/da", "Malecón - Puerto Vallarta.jpg"),
  vistaAerea: commons("6/67", "Puerto Vallarta 071.jpg"),
  costaSur: commons("e/e2", "Beach in Puerto Vallarta.jpg"),
  playaMuertos: commons("a/a7", "Playa de Los Muertos.jpg"),
  playaHoteles: commons("0/02", "Velas Vallarta, Puerto Vallarta (2014) - 92.JPG"),
  atardecerRocas: commons("3/32", "Puerto Vallarta, Mexico - March 2023 - 015.jpg"),
  atardecerNubes: commons("9/9a", "Puerto Vallarta, Jalisco, Mexico (March 2023) - 112.jpg"),
  bahiaCiudad: commons("e/e3", "Puerto Vallarta Centro and Zona Romantica.jpg"),
  playaCerro: commons("8/84", "Puerto Vallarta, Jalisco, 2025 - 004.jpg"),
  bahiaTorre: commons("f/ff", "Banderas Bay, Mexico (37784264145).jpg"),
  costaNublada: commons("1/12", "Bahia de Banderas, Nayarit, MEXICO.jpg"),
  costaDesdeMar: commons("3/34", "View of the coast of Puerto Vallarta.jpg"),
  marinaFaro: commons("e/e7", "Puerto Vallarta, Jalisco, 2025 - 179.jpg"),
  barcos: commons("c/c6", "Puerto Vallarta, Jalisco, 2025 - 243.jpg"),
  marinaNublada: commons("0/01", "Puerto Vallarta, Jalisco, 2025 - 253.jpg"),
  mercadoCuale: commons("0/0f", "Puerto Vallarta, Mexico - March 2023 - 087.jpg"),
  mercadoPuente: commons("5/5b", "Puerto Vallarta, Mexico - March 2023 - 089.jpg"),
  muralCatrina: commons("3/3f", "Puerto Vallarta, Mexico, in April 2023 - 108.jpg"),
  rioCuale: commons("f/f6", "Rio Cuale at Banderas Bay, Puerto Vallarta (2014) - 1.JPG"),
  puente: commons("7/7b", "March 2023 in Puerto Vallarta, Jalisco - 092.jpg"),
  aeropuertoTorre: commons("f/fe", "Aeropuerto Internacional de Puerto Vallarta.jpg"),
  aeropuertoInterior: commons("3/3c", "Aeropuerto Puerto Vallarta 1.jpg"),
  aeropuertoPista: commons("2/2b", "Aeropuerto Puerto Vallarta 8.jpg"),
  ciudadAerea: commons("c/ca", "Licenciado Gustavo Díaz Ordaz International Airport.jpg"),
  bahiaNoche: commons("b/b8", "Puerto Vallarta in February 2023 - 63.jpg"),
  calleSombrillas: commons("b/b9", "Puerto Vallarta, March 2023 - 097.jpg"),
  callePapelPicado: commons("4/4f", "Puerto Vallarta, Mexico - March 2023 - 072.jpg"),
  avenidaAerea: commons("d/de", "Sierra Madre Mountains, Mexico (38100844695).jpg"),
  cieloTormenta: commons("9/9d", "Sierra Madre Mountains, Mexico (27210107419).jpg"),
  kiosco: commons("7/7d", "Puerto Vallarta, MX (2023) - 034.jpg"),
  plazaArmas: commons("d/df", "Puerto Vallarta, Jalisco (February 2023) - 017.jpg"),
  kioscoNoche: commons("3/34", "Puerto Vallarta - March 2023 - 107.jpg"),
  plazaLluvia: commons("c/cd", "Puerto Vallarta, Mexico (February 2024) - 326.jpg"),
} as const;

export type PhotoKey = keyof typeof PHOTOS;

/** Autor y licencia de las fotos del banco ampliado (Wikimedia Commons) — se muestra junto a "Foto ilustrativa". */
export const PHOTO_CREDITS: Partial<Record<PhotoKey, string>> = {
  malecon2014: "Another Believer · CC BY-SA 3.0",
  maleconPaseo: "August Dominus · CC BY-SA 4.0",
  maleconFlores: "Sailverz · CC BY 4.0",
  vistaAerea: "Atilin · dominio público",
  costaSur: "Michael Condouris · CC BY 2.0",
  playaMuertos: "Melikamp · CC BY-SA 3.0",
  playaHoteles: "Another Believer · CC BY-SA 3.0",
  atardecerRocas: "Another Believer · CC BY-SA 4.0",
  atardecerNubes: "Another Believer · CC BY-SA 4.0",
  bahiaCiudad: "Zeroslashed · CC BY-SA 4.0",
  playaCerro: "Another Believer · CC BY-SA 4.0",
  bahiaTorre: "Andrew Milligan sumo · CC BY 2.0",
  costaNublada: "Christian Frausto Bernal · CC BY-SA 2.0",
  costaDesdeMar: "TerryDOtt · CC BY 2.0",
  marinaFaro: "Another Believer · CC BY-SA 4.0",
  barcos: "Another Believer · CC BY-SA 4.0",
  marinaNublada: "Another Believer · CC BY-SA 4.0",
  mercadoCuale: "Another Believer · CC BY-SA 4.0",
  mercadoPuente: "Another Believer · CC BY-SA 4.0",
  muralCatrina: "Another Believer · CC BY-SA 4.0",
  rioCuale: "Another Believer · CC BY-SA 3.0",
  puente: "Another Believer · CC BY-SA 4.0",
  aeropuertoTorre: "Melikamp · CC BY-SA 3.0",
  aeropuertoInterior: "Jeat1993 · CC BY-SA 4.0",
  aeropuertoPista: "Jeat1993 · CC BY-SA 4.0",
  ciudadAerea: "MediaGuy768 · CC BY-SA 4.0",
  bahiaNoche: "Another Believer · CC BY-SA 4.0",
  calleSombrillas: "Another Believer · CC BY-SA 4.0",
  callePapelPicado: "Another Believer · CC BY-SA 4.0",
  avenidaAerea: "Andrew Milligan sumo · CC BY 2.0",
  cieloTormenta: "Andrew Milligan sumo · CC BY 2.0",
  kiosco: "Another Believer · CC BY-SA 4.0",
  plazaArmas: "Another Believer · CC BY-SA 4.0",
  kioscoNoche: "Another Believer · CC BY-SA 4.0",
  plazaLluvia: "Another Believer · CC BY-SA 4.0",
};

/** Texto del crédito que acompaña a una foto: la real o generada del artículo, o la ilustrativa del banco. */
export function photoCreditLabel(n: { image: PhotoKey; imageUrl?: string; imageCredit?: string }): string {
  if (n.imageUrl) return `Foto: ${n.imageCredit || "fuente original"}`;
  const credit = PHOTO_CREDITS[n.image];
  return credit ? `Foto ilustrativa: ${credit}` : "Foto ilustrativa";
}

// Opciones de foto ilustrativa por categoría. Varias por categoría para
// que dos notas de la misma categoría sin imagen propia no muestren la
// misma foto — ver illustrationFor y uniqueIllustrations.
export const CATEGORY_IMAGES: Record<string, PhotoKey[]> = {
  "ultima-hora": ["bahiaCiudad", "malecomAtardecer", "maleconGeneral", "faroMalecon", "bahiaNoche"],
  seguridad: ["avenidaAerea", "callePapelPicado", "maleconGeneral", "plazaArmas", "bahiaNoche"],
  gobierno: ["plazaArmas", "kiosco", "fuenteAmistad", "kioscoNoche", "plazaLluvia"],
  comunidad: ["callePapelPicado", "kiosco", "mercadoCuale", "fuenteAmistad", "ninoCaballito", "mercadoPuente", "calleSombrillas"],
  turismo: ["playaMuertos", "malecomAtardecer", "playaHoteles", "maleconPaseo", "aeropuertoPista", "bahiaTorre"],
  economia: ["calleSombrillas", "mercadoCuale", "avenidaAerea", "marinaFaro", "ciudadAerea"],
  negocios: ["calleSombrillas", "mercadoPuente", "maleconFlores", "marinaFaro", "mercadoCuale"],
  transito: ["avenidaAerea", "puente", "construccion", "ciudadAerea", "maleconGeneral"],
  playas: ["playa", "playaMuertos", "playaCerro", "playaHoteles", "costaSur", "playaAtardecer", "atardecerRocas"],
  clima: ["cieloTormenta", "costaNublada", "atardecerNubes", "marinaNublada", "plazaLluvia", "bahiaTorre", "costaDesdeMar", "playaAtardecer", "playa"],
  cultura: ["muralCatrina", "bailarines", "kioscoNoche", "callePapelPicado", "iglesiaGuadalupe"],
  gastronomia: ["tacos", "ceviche", "calleSombrillas", "mercadoCuale"],
  eventos: ["kioscoNoche", "bailarines", "fuenteAmistad", "callePapelPicado", "maleconFlores"],
  entretenimiento: ["bahiaNoche", "bailarines", "kioscoNoche", "ninoCaballito"],
  deportes: ["maleconPaseo", "playaMuertos", "faroMalecon", "costaDesdeMar"],
  "medio-ambiente": ["rioCuale", "ballena", "costaSur", "vistaAerea", "playa"],
  servicios: ["construccion", "avenidaAerea", "puente", "ciudadAerea", "mercadoPuente"],
  politica: ["plazaArmas", "kiosco", "plazaLluvia", "maleconGeneral"],
  jalisco: ["vistaAerea", "bahiaCiudad", "costaDesdeMar", "maleconGeneral"],
  mexico: ["aeropuertoTorre", "ciudadAerea", "bahiaTorre", "faroMalecon"],
  mundo: ["aeropuertoInterior", "aeropuertoPista", "barcos", "faroMalecon"],
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Foto ilustrativa por defecto de una nota: una de las de su categoría, elegida de forma estable según su slug. */
export function illustrationFor(categorySlug: string, articleSlug: string): PhotoKey {
  const options = CATEGORY_IMAGES[categorySlug] || CATEGORY_IMAGES.comunidad;
  return options[hashString(articleSlug) % options.length];
}

const ALL_PHOTO_KEYS = Object.keys(PHOTOS) as PhotoKey[];

/**
 * Evita fotos ilustrativas repetidas dentro de una misma página. Recorre
 * la lista en orden y, cuando una nota sin imagen propia traería una foto
 * que ya salió antes, le asigna otra de su categoría que siga libre (o,
 * si ya no quedan, cualquiera libre del banco). `used` se puede compartir
 * entre varias listas de la misma página.
 */
export function uniqueIllustrations<T extends { image: PhotoKey; imageUrl?: string; category?: string }>(
  items: T[],
  used: Set<PhotoKey> = new Set()
): T[] {
  return items.map((item) => {
    if (item.imageUrl) return item;
    if (!used.has(item.image)) {
      used.add(item.image);
      return item;
    }
    const sameCategory = CATEGORY_IMAGES[item.category || ""] || [];
    const free = sameCategory.find((k) => !used.has(k)) || ALL_PHOTO_KEYS.find((k) => !used.has(k));
    if (!free) return item; // banco agotado: se acepta la repetición
    used.add(free);
    return { ...item, image: free };
  });
}

/**
 * Resuelve qué imagen mostrar para una noticia: la foto REAL extraída de
 * la fuente si existe (`imageUrl`), o si no, la ilustrativa del banco
 * local por categoría. Usar junto con `unoptimized` en next/image cuando
 * venga de `imageUrl` — es un host externo arbitrario, no pasa por
 * next.config.ts `images.remotePatterns`.
 */
export function newsImageSrc(n: { image: PhotoKey; imageUrl?: string }): string {
  return n.imageUrl || PHOTOS[n.image];
}

/**
 * Imagen para la vista previa al compartir la nota (Facebook, WhatsApp,
 * X): la misma foto de la nota, en un ancho que las redes aceptan.
 */
export function socialImageSrc(n: { image: PhotoKey; imageUrl?: string }): string {
  return imageLoader({ src: newsImageSrc(n), width: 960 });
}
