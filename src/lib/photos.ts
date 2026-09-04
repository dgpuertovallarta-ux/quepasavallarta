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

export const PHOTOS = {
  malecomAtardecer:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Puerto_Vallarta_Malec%C3%B3n_in_the_evening_light.jpg/1280px-Puerto_Vallarta_Malec%C3%B3n_in_the_evening_light.jpg",
  iglesiaGuadalupe:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Our_Lady_of_Guadalupe_Church%2C_Puerto_Vallarta%2C_2023.jpg/1280px-Our_Lady_of_Guadalupe_Church%2C_Puerto_Vallarta%2C_2023.jpg",
  faroMalecon:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Malec%C3%B3n_Lighthouse%2C_Puerto_Vallarta%2C_2014.jpg/1280px-Malec%C3%B3n_Lighthouse%2C_Puerto_Vallarta%2C_2014.jpg",
  bailarines:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Vallarta_Dancers%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg/1280px-Vallarta_Dancers%2C_Malec%C3%B3n%2C_Puerto_Vallarta%2C_2014.jpg",
  playaAtardecer:
    "https://upload.wikimedia.org/wikipedia/commons/d/df/Atardecer_en_una_playa_de_Puerto_Vallarta.jpg",
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
  ballena: "https://upload.wikimedia.org/wikipedia/commons/6/6a/Humpback_whale_jumping.jpg",
  construccion:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Road_Construction_Worker_-_Controlling_Traffic.jpg/1280px-Road_Construction_Worker_-_Controlling_Traffic.jpg",
  maleconGeneral:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/MALECON_DE_PUERTO_VALLARTA.JPG/1280px-MALECON_DE_PUERTO_VALLARTA.JPG",
} as const;

export type PhotoKey = keyof typeof PHOTOS;
