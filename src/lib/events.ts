import type { PhotoKey } from "./photos";

/**
 * AGENDA — eventos reales de Puerto Vallarta y la bahía.
 *
 * Fuente: el calendario oficial de turismo del destino
 * (visitapuertovallarta.com.mx/eventos). Cada evento enlaza a su página
 * en ese sitio; aquí solo se guarda lo que la fuente publica (nombre,
 * fechas, lugar cuando lo indica y una línea de descripción). No se
 * inventan horarios ni organizadores.
 *
 * Se actualiza una vez al mes: se agregan los eventos nuevos del
 * calendario oficial y se corrigen fechas que hayan cambiado. Los eventos
 * pasados no hace falta borrarlos a mano — `upcomingEvents` deja de
 * mostrarlos solos en cuanto termina su fecha.
 *
 * Última actualización: 10 de octubre de 2026.
 */
export type EventItem = {
  slug: string;
  title: string;
  category: string;
  image: PhotoKey;
  /** Fecha de inicio, AAAA-MM-DD. */
  date: string;
  /** Fecha de término, AAAA-MM-DD — solo si dura más de un día. */
  endDate?: string;
  /** Para temporadas largas (mercados, ciclos): cada cuándo ocurre, si la fuente lo dice. */
  recurrence?: string;
  location: string;
  dek: string;
  sourceName: string;
  sourceUrl: string;
};

const SOURCE = "Visita Puerto Vallarta";
const src = (path: string) => `https://visitapuertovallarta.com.mx/eventos/${path}`;

export const EVENTS: EventItem[] = [
  {
    slug: "torneo-internacional-de-pesca-de-basura-2026",
    title: "Torneo Internacional de Pesca de Basura 2026",
    category: "Medio ambiente",
    image: "costaSur",
    date: "2026-10-18",
    location: "Puerto Vallarta",
    dek: "Jornada de conservación en la que los equipos compiten por sacar basura del mar para proteger las playas y la vida marina.",
    sourceName: SOURCE,
    sourceUrl: src("torneo-internacional-de-pesca-de-basura-2026"),
  },
  {
    slug: "gran-concierto-tradicion-y-presente",
    title: "Gran concierto: Tradición y Presente",
    category: "Música",
    image: "kioscoNoche",
    date: "2026-10-22",
    location: "Puerto Vallarta",
    dek: "Concierto de música clásica con un programa que va del barroco al minimalismo.",
    sourceName: SOURCE,
    sourceUrl: src("gran-concierto-tradicion-y-presente"),
  },
  {
    slug: "antidoping-en-puerto-vallarta",
    title: "Antidoping en Puerto Vallarta",
    category: "Música",
    image: "bahiaNoche",
    date: "2026-10-23",
    location: "Salón Rancho Alegre",
    dek: "Noche de reggae con la banda Antidoping.",
    sourceName: SOURCE,
    sourceUrl: src("antidoping-en-puerto-vallarta"),
  },
  {
    slug: "sierra-mar-xcm-mascota-vallarta-2026",
    title: "Sierra Mar XCM Mascota–Vallarta 2026",
    category: "Deportes",
    image: "vistaAerea",
    date: "2026-10-24",
    location: "De Mascota a Puerto Vallarta",
    dek: "Carrera de ciclismo de montaña de 100 km desde el Pueblo Mágico de Mascota hasta las playas de Puerto Vallarta.",
    sourceName: SOURCE,
    sourceUrl: src("sierra-mar-xcm-mascota-vallarta-2026"),
  },
  {
    slug: "vidantaworld-concert-series-2026-robbie-williams",
    title: "Robbie Williams — VidantaWorld Concert Series 2026",
    category: "Música",
    image: "playaHoteles",
    date: "2026-10-27",
    location: "VidantaWorld",
    dek: "Concierto de Robbie Williams con sus éxitos más conocidos.",
    sourceName: SOURCE,
    sourceUrl: src("vidantaworld-concert-series-2026-robbie-williams"),
  },
  {
    slug: "aurea-concerts-halloween-at-the-movies",
    title: "Auréa Concerts: Halloween at the Movies",
    category: "Música",
    image: "atardecerNubes",
    date: "2026-10-28",
    location: "TierraLuna Gardens, Zona Sur",
    dek: "Orquesta sinfónica con bandas sonoras de cine y televisión.",
    sourceName: SOURCE,
    sourceUrl: src("aurea-concerts-halloween-at-the-movies"),
  },
  {
    slug: "vidantaworld-mexico-open-2026",
    title: "VidantaWorld Mexico Open 2026",
    category: "Deportes",
    image: "bahiaTorre",
    date: "2026-10-29",
    endDate: "2026-11-01",
    location: "Campo de golf de VidantaWorld Vallarta",
    dek: "Semana de golf de campeonato en el campo de VidantaWorld.",
    sourceName: SOURCE,
    sourceUrl: src("vidantaworld-mexico-open-2026"),
  },
  {
    slug: "art-market-marina-vallarta",
    title: "Art & Market Marina Vallarta",
    category: "Mercados",
    image: "marinaFaro",
    date: "2026-10-29",
    endDate: "2027-05-13",
    recurrence: "Temporada 2026-2027",
    location: "Malecón de Marina Vallarta",
    dek: "Mercado nocturno con más de 200 productores y artesanos locales.",
    sourceName: SOURCE,
    sourceUrl: src("art-market-marina-vallarta"),
  },
  {
    slug: "torneo-de-pesca-de-dorado-boca-de-tomatlan-2026",
    title: "Torneo de Pesca de Dorado Boca de Tomatlán 2026",
    category: "Deportes",
    image: "barcos",
    date: "2026-10-30",
    endDate: "2026-10-31",
    location: "Boca de Tomatlán, Quimixto y Yelapa",
    dek: "Torneo de pesca deportiva en la costa sur de la bahía.",
    sourceName: SOURCE,
    sourceUrl: src("torneo-de-pesca-de-dorado-boca-de-tomatlan-2026"),
  },
  {
    slug: "concierto-de-dia-de-muertos-2026",
    title: "Concierto de Día de Muertos 2026",
    category: "Tradiciones",
    image: "muralCatrina",
    date: "2026-10-30",
    location: "Marina Vallarta",
    dek: "Concierto coral de Día de Muertos que mezcla música mexicana y brasileña.",
    sourceName: SOURCE,
    sourceUrl: src("concierto-de-dia-de-muertos-2026"),
  },
  {
    slug: "heat-latin-music-awards-2026",
    title: "HEAT Latin Music Awards 2026",
    category: "Música",
    image: "malecomAtardecer",
    date: "2026-10-30",
    endDate: "2026-11-05",
    location: "Puerto Vallarta",
    dek: "Los premios de música latina se celebran por primera vez en México; llegan a Puerto Vallarta el 5 de noviembre.",
    sourceName: SOURCE,
    sourceUrl: src("heat-latin-music-awards-2026"),
  },
  {
    slug: "festival-de-las-almas-2026-en-puerto-vallarta",
    title: "Festival de las Almas 2026 en Puerto Vallarta",
    category: "Tradiciones",
    image: "callePapelPicado",
    date: "2026-10-31",
    endDate: "2026-11-02",
    location: "Frente al mar, Puerto Vallarta",
    dek: "Segunda edición del festival de Día de Muertos, con instalaciones, desfiles y actividades culturales.",
    sourceName: SOURCE,
    sourceUrl: src("festival-de-las-almas-2026-en-puerto-vallarta"),
  },
  {
    slug: "espontaneo-festival-escenico-2026",
    title: "Espontáneo Festival Escénico 2026",
    category: "Cultura",
    image: "bailarines",
    date: "2026-11-05",
    endDate: "2026-11-14",
    location: "Puerto Vallarta",
    dek: "Festival de artes escénicas contemporáneas.",
    sourceName: SOURCE,
    sourceUrl: src("espontaneo-festival-escenico-2026"),
  },
  {
    slug: "the-grill-festival",
    title: "The Grill Festival",
    category: "Gastronomía",
    image: "tacos",
    date: "2026-11-07",
    endDate: "2026-11-08",
    location: "Puerto Vallarta",
    dek: "Festival de parrilla y cocina al fuego.",
    sourceName: SOURCE,
    sourceUrl: src("the-grill-festival"),
  },
  {
    slug: "olas-altas-farmers-market-2026-2027",
    title: "Olas Altas Farmers Market 2026-2027",
    category: "Mercados",
    image: "calleSombrillas",
    date: "2026-11-07",
    endDate: "2027-05-08",
    recurrence: "Sábados",
    location: "Olas Altas, Zona Romántica",
    dek: "Mercado sabatino con artesanías, textiles, arte y comida local.",
    sourceName: SOURCE,
    sourceUrl: src("olas-altas-farmers-market-2026-2027"),
  },
  {
    slug: "torneo-internacional-de-pesca-marlin-y-atun-2026",
    title: "Torneo Internacional de Pesca Marlin y Atún 2026",
    category: "Deportes",
    image: "costaDesdeMar",
    date: "2026-11-11",
    endDate: "2026-11-14",
    location: "Puerto Vallarta",
    dek: "Torneo de pesca deportiva con una bolsa de premios de más de un millón de pesos.",
    sourceName: SOURCE,
    sourceUrl: src("torneo-internacional-de-pesca-marlin-y-atun-2026"),
  },
  {
    slug: "31-festival-gourmet-international",
    title: "31º Festival Gourmet International",
    category: "Gastronomía",
    image: "ceviche",
    date: "2026-11-12",
    endDate: "2026-11-22",
    location: "Restaurantes de Puerto Vallarta y la bahía",
    dek: "Chefs invitados y experiencias gastronómicas en restaurantes de la región.",
    sourceName: SOURCE,
    sourceUrl: src("31-festival-gourment-international"),
  },
  {
    slug: "vidantaworld-concert-series-2026-maroon-5",
    title: "Maroon 5 — VidantaWorld Concert Series 2026",
    category: "Música",
    image: "playaAtardecer",
    date: "2026-11-12",
    location: "VidantaWorld",
    dek: "Concierto en vivo de Maroon 5.",
    sourceName: SOURCE,
    sourceUrl: src("vidantaworld-concert-series-2026-maroon-5"),
  },
  {
    slug: "cruce-vallarta-2026",
    title: "Cruce Vallarta 2026",
    category: "Deportes",
    image: "playaMuertos",
    date: "2026-11-14",
    location: "Puerto Vallarta",
    dek: "Cuarta edición de la competencia de natación en aguas abiertas, para participantes de 15 a más de 70 años.",
    sourceName: SOURCE,
    sourceUrl: src("cruce-vallarta-2026"),
  },
  {
    slug: "pvr-asian-festival-2026",
    title: "PVR Asian Festival 2026",
    category: "Cultura",
    image: "kiosco",
    date: "2026-11-14",
    endDate: "2026-11-15",
    location: "Puerto Vallarta",
    dek: "Festival familiar con zonas temáticas y presentaciones inspiradas en culturas asiáticas.",
    sourceName: SOURCE,
    sourceUrl: src("pvr-asian-festival-2026"),
  },
  {
    slug: "xxii-medio-maraton-puerto-vallarta-2026",
    title: "XXII Medio Maratón Puerto Vallarta 2026",
    category: "Deportes",
    image: "maleconPaseo",
    date: "2026-11-15",
    location: "Puerto Vallarta",
    dek: "Medio maratón y carrera de 5 km por una ruta panorámica.",
    sourceName: SOURCE,
    sourceUrl: src("xxii-medio-maraton-puerto-vallarta-2026"),
  },
  {
    slug: "muyguud-feria-internacional-de-arte-contemporaneo-2026",
    title: "MUYGUUD Feria Internacional de Arte Contemporáneo 2026",
    category: "Cultura",
    image: "fuenteAmistad",
    date: "2026-11-19",
    endDate: "2026-11-22",
    location: "Puerto Vallarta",
    dek: "Feria de arte contemporáneo que reúne a artistas, coleccionistas y público.",
    sourceName: SOURCE,
    sourceUrl: src("muyguud-feria-internacional-de-arte-contemporaneo-2026"),
  },
  {
    slug: "torneo-de-pesca-deportiva-mismaloya-2026",
    title: "Torneo de Pesca Deportiva Mismaloya 2026",
    category: "Deportes",
    image: "atardecerRocas",
    date: "2026-11-20",
    endDate: "2026-11-21",
    location: "Mismaloya",
    dek: "Séptima edición del torneo de pesca, en el fin de semana largo del 20 de noviembre.",
    sourceName: SOURCE,
    sourceUrl: src("torneo-de-pesca-deportiva-mismaloya-2026"),
  },
  {
    slug: "fiestas-guadalupanas-2026",
    title: "Fiestas Guadalupanas 2026",
    category: "Tradiciones",
    image: "iglesiaGuadalupe",
    date: "2026-12-01",
    endDate: "2026-12-12",
    location: "Centro de Puerto Vallarta",
    dek: "Doce días de peregrinaciones y fiesta en torno a la parroquia de Guadalupe, una de las celebraciones más emblemáticas de la ciudad.",
    sourceName: SOURCE,
    sourceUrl: src("fiestas-guadalupanas-2026"),
  },
];

const TIME_ZONE = "America/Mexico_City";

/** La fecha de hoy en Puerto Vallarta, AAAA-MM-DD. */
export function todayInVallarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Eventos que todavía no terminan, ordenados por lo próximo: los que
 * están por empezar o ya en curso con fecha de cierre cercana van antes
 * que las temporadas largas que ya arrancaron.
 */
export function upcomingEvents(now: Date = new Date()): EventItem[] {
  const today = todayInVallarta(now);
  const sortKey = (e: EventItem) => (e.date >= today ? e.date : e.endDate && e.recurrence ? `${today}~` : today);
  return EVENTS.filter((e) => (e.endDate || e.date) >= today).sort(
    (a, b) => sortKey(a).localeCompare(sortKey(b)) || a.date.localeCompare(b.date)
  );
}

function shortDay(iso: string, withYear = false): string {
  return new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" })
    .replace(/\./g, "");
}

/** "18 oct", "29 oct – 1 nov", o "Sábados · 7 nov – 8 may 2027" para temporadas. */
export function eventDateLabel(e: EventItem): string {
  if (!e.endDate) return shortDay(e.date);
  const crossesYear = e.endDate.slice(0, 4) !== e.date.slice(0, 4);
  const range = `${shortDay(e.date)} – ${shortDay(e.endDate, crossesYear)}`;
  return e.recurrence ? `${e.recurrence} · ${range}` : range;
}
