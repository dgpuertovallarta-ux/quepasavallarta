/**
 * DATOS DE DEMOSTRACIÓN — QUÉ PASA VALLARTA
 * ------------------------------------------------------------------
 * TODO el contenido de este archivo es FICTICIO y existe únicamente
 * para mostrar cómo funcionará el producto (sección 73 del brief
 * original). Ninguna de estas noticias, negocios, eventos o cifras
 * es real. Cuando se conecten fuentes reales (RSS, APIs, WordPress,
 * n8n), estas funciones se sustituyen por llamadas a la API real
 * manteniendo la misma forma (tipos). Ver /docs/ARCHITECTURE.md.
 * ------------------------------------------------------------------
 */

import type { PhotoKey } from "./photos";

export const SITE = {
  name: "Qué Pasa Vallarta",
  tagline: "Información clara y confiable de Puerto Vallarta.",
  city: "Puerto Vallarta, Jalisco",
};

export type Category = { slug: string; name: string };

export const CATEGORIES: Category[] = [
  { slug: "ultima-hora", name: "Última Hora" },
  { slug: "seguridad", name: "Seguridad" },
  { slug: "gobierno", name: "Gobierno" },
  { slug: "comunidad", name: "Comunidad" },
  { slug: "turismo", name: "Turismo" },
  { slug: "economia", name: "Economía" },
  { slug: "negocios", name: "Negocios" },
  { slug: "transito", name: "Tránsito" },
  { slug: "playas", name: "Playas" },
  { slug: "clima", name: "Clima" },
  { slug: "cultura", name: "Cultura" },
  { slug: "gastronomia", name: "Gastronomía" },
  { slug: "eventos", name: "Eventos" },
  { slug: "entretenimiento", name: "Entretenimiento" },
  { slug: "deportes", name: "Deportes" },
  { slug: "medio-ambiente", name: "Medio Ambiente" },
  { slug: "servicios", name: "Servicios" },
  { slug: "politica", name: "Política" },
  { slug: "jalisco", name: "Jalisco" },
  { slug: "mexico", name: "México" },
  { slug: "mundo", name: "Mundo" },
];

export type Zone = { slug: string; name: string };

export const ZONES: Zone[] = [
  { slug: "centro", name: "Centro" },
  { slug: "5-de-diciembre", name: "5 de Diciembre" },
  { slug: "versalles", name: "Versalles" },
  { slug: "zona-hotelera", name: "Zona Hotelera" },
  { slug: "marina", name: "Marina Vallarta" },
  { slug: "fluvial", name: "Fluvial Vallarta" },
  { slug: "pitillal", name: "Pitillal" },
  { slug: "las-juntas", name: "Las Juntas" },
  { slug: "ixtapa", name: "Ixtapa" },
];

export const AUTHORS: Record<string, { name: string; initials: string }> = {
  redaccion: { name: "Redacción Qué Pasa Vallarta", initials: "QPV" },
  ia: { name: "Asistido por IA · revisado por Redacción", initials: "IA" },
};

export type Media = "ocean" | "sunset" | "sand" | "green";

export type NewsItem = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  zone: string | null;
  author: string;
  score: number;
  breaking: boolean;
  verified: boolean;
  publishedAt: string;
  updatedAt: string;
  media: Media;
  image: PhotoKey;
  sources: { label: string; url: string }[];
  body: string[];
};

// News Score: 90-100 urgente · 80-89 publicable · 60-79 revisión · 0-59 descartar
export const NEWS: NewsItem[] = [
  {
    slug: "obras-libramiento-tepic-avance-septiembre",
    title: "Avanza al 60% la ampliación del libramiento a Tepic; prevén concluir en enero",
    dek: "La SCT reporta avance en los tres tramos críticos. El tránsito seguirá con carriles reducidos los próximos meses.",
    category: "transito",
    zone: "las-juntas",
    author: "redaccion",
    score: 84,
    breaking: false,
    verified: true,
    publishedAt: "2026-09-03T08:10:00-06:00",
    updatedAt: "2026-09-03T11:40:00-06:00",
    media: "ocean",
    image: "construccion",
    sources: [
      { label: "SCT Jalisco (comunicado oficial)", url: "#" },
      { label: "Ayuntamiento de Puerto Vallarta", url: "#" },
    ],
    body: [
      "La Secretaría de Comunicaciones y Transportes (SCT) informó que la ampliación del libramiento hacia Tepic alcanza un avance del 60%, con los tramos de mayor complejidad ya en etapa de pavimentación.",
      "De acuerdo con el comunicado, se espera que los trabajos concluyan en enero de 2027, aunque el tránsito continuará con carriles reducidos en horarios de alta demanda durante los próximos meses.",
      "Autoridades municipales pidieron a automovilistas considerar rutas alternas durante la temporada de mayor afluencia turística.",
    ],
  },
  {
    slug: "temporada-huracanes-alerta-verde-bahia",
    title: "Protección Civil mantiene alerta verde en la bahía; vigilan sistema tropical en el Pacífico",
    dek: "El fenómeno se encuentra a más de 900 km de la costa. No representa riesgo inmediato para Puerto Vallarta.",
    category: "clima",
    zone: null,
    author: "redaccion",
    score: 78,
    breaking: false,
    verified: true,
    publishedAt: "2026-09-03T07:00:00-06:00",
    updatedAt: "2026-09-03T07:00:00-06:00",
    media: "ocean",
    image: "faroMalecon",
    sources: [{ label: "Protección Civil Jalisco", url: "#" }, { label: "Conagua", url: "#" }],
    body: [
      "La Unidad Estatal de Protección Civil mantiene el semáforo en verde para la región de Bahía de Banderas ante el desarrollo de un sistema de baja presión en el Pacífico oriental.",
      "Se recomienda a la población mantenerse informada a través de canales oficiales y evitar la difusión de información no confirmada en redes sociales.",
    ],
  },
  {
    slug: "ocupacion-hotelera-fin-de-semana-largo",
    title: "Ocupación hotelera roza el 92% para el puente de septiembre",
    dek: "El sector hotelero reporta cifras similares a las de 2025, impulsadas por vuelos directos desde EU y Canadá.",
    category: "turismo",
    zone: "zona-hotelera",
    author: "redaccion",
    score: 81,
    breaking: false,
    verified: true,
    publishedAt: "2026-09-02T18:20:00-06:00",
    updatedAt: "2026-09-02T18:20:00-06:00",
    media: "sunset",
    image: "playa",
    sources: [{ label: "Asociación de Hoteles de Puerto Vallarta", url: "#" }],
    body: [
      "La Asociación de Hoteles de Puerto Vallarta y Bahía de Banderas estima una ocupación cercana al 92% para el fin de semana largo, cifra similar a la registrada en el mismo periodo de 2025.",
      "El incremento en vuelos directos desde ciudades de Estados Unidos y Canadá se identifica como uno de los principales factores.",
    ],
  },
  {
    slug: "aumento-rentas-centro-versalles",
    title: "Rentas en Centro y Versalles suben hasta 18% en un año, según inmobiliarias locales",
    dek: "La demanda de vivienda temporal y la llegada de nuevos residentes presionan los precios en las zonas más solicitadas.",
    category: "economia",
    zone: "versalles",
    author: "redaccion",
    score: 76,
    breaking: false,
    verified: false,
    publishedAt: "2026-09-02T12:00:00-06:00",
    updatedAt: "2026-09-02T12:00:00-06:00",
    media: "sand",
    image: "maleconGeneral",
    sources: [{ label: "Consulta con 4 inmobiliarias locales (no oficial)", url: "#" }],
    body: [
      "Datos recabados por Qué Pasa Vallarta entre inmobiliarias locales sugieren un incremento de entre 12% y 18% en el precio promedio de renta en las colonias Centro y Versalles durante el último año.",
      "No existe todavía una cifra oficial consolidada por parte de autoridades municipales; este dato proviene de una muestra no representativa y debe tomarse como referencia, no como estadística oficial.",
    ],
  },
  {
    slug: "operativo-seguridad-malecon-fin-semana",
    title: "Refuerzan seguridad en el Malecón durante el fin de semana largo",
    dek: "Elementos de Guardia Nacional, policía municipal y estatal participan en el operativo conjunto.",
    category: "seguridad",
    zone: "centro",
    author: "redaccion",
    score: 82,
    breaking: false,
    verified: true,
    publishedAt: "2026-09-01T20:00:00-06:00",
    updatedAt: "2026-09-01T20:00:00-06:00",
    media: "ocean",
    image: "malecomAtardecer",
    sources: [{ label: "Secretaría de Seguridad Pública Municipal", url: "#" }],
    body: [
      "La Secretaría de Seguridad Pública Municipal confirmó el refuerzo de elementos en el primer cuadro de la ciudad como parte del operativo por el fin de semana largo.",
      "Se instalaron puntos de revisión en accesos principales al Centro y la Zona Romántica.",
    ],
  },
  {
    slug: "nuevo-carril-confinado-ciclovia-francisco-medina",
    title: "Inicia construcción de carril confinado para ciclovía en Francisco Medina Ascencio",
    dek: "El proyecto forma parte del plan de movilidad no motorizada del municipio.",
    category: "servicios",
    zone: "zona-hotelera",
    author: "redaccion",
    score: 69,
    breaking: false,
    verified: true,
    publishedAt: "2026-09-01T09:30:00-06:00",
    updatedAt: "2026-09-01T09:30:00-06:00",
    media: "green",
    image: "construccion",
    sources: [{ label: "Dirección de Obras Públicas Municipales", url: "#" }],
    body: [
      "El Ayuntamiento de Puerto Vallarta inició los trabajos para un carril confinado destinado a ciclistas sobre la avenida Francisco Medina Ascencio.",
      "Las obras generarán cierres parciales durante aproximadamente ocho semanas.",
    ],
  },
  {
    slug: "festival-gastronomico-romantica-anuncio",
    title: "Restauranteros de la Zona Romántica anuncian festival gastronómico para octubre",
    dek: "Participarán más de 30 restaurantes con menús especiales de tres tiempos a precio fijo.",
    category: "gastronomia",
    zone: "centro",
    author: "redaccion",
    score: 71,
    breaking: false,
    verified: true,
    publishedAt: "2026-08-31T16:00:00-06:00",
    updatedAt: "2026-08-31T16:00:00-06:00",
    media: "sunset",
    image: "ceviche",
    sources: [{ label: "Asociación de Restauranteros de la Zona Romántica", url: "#" }],
    body: [
      "La asociación de restauranteros confirmó la tercera edición de su festival gastronómico, que se realizará durante la primera quincena de octubre.",
    ],
  },
  {
    slug: "seleccion-playas-bandera-azul-2026",
    title: "Tres playas de Puerto Vallarta renuevan certificación Blue Flag para 2026",
    dek: "Camarones, Los Muertos y Punta Negra mantienen los estándares de calidad de agua y accesibilidad.",
    category: "playas",
    zone: null,
    author: "redaccion",
    score: 73,
    breaking: false,
    verified: true,
    publishedAt: "2026-08-30T10:00:00-06:00",
    updatedAt: "2026-08-30T10:00:00-06:00",
    media: "ocean",
    image: "playaAtardecer",
    sources: [{ label: "Fundación Blue Flag México", url: "#" }],
    body: [
      "Tres playas del municipio renovaron su certificación internacional Blue Flag, que evalúa calidad del agua, seguridad, accesibilidad y gestión ambiental.",
    ],
  },
];

export const HERO_IMAGE: PhotoKey = "malecomAtardecer";

export const BREAKING = {
  active: true,
  text: "DEMO — Así se vería una alerta de última hora activa en el sitio.",
  href: "/noticia/operativo-seguridad-malecon-fin-semana",
};

// ------------------------------------------------------------------
// VALLARTA AHORA — dashboard de ciudad. Todos los valores son
// marcador de posición; ninguno proviene de una integración real.
// ------------------------------------------------------------------
export type AhoraTile = { label: string; value: string; sub: string; demo: boolean; icon: string };

export const AHORA: Record<string, AhoraTile> = {
  clima: { icon: "☀️", label: "Clima ahora", value: "—", sub: "Conectar API meteorológica", demo: true },
  trafico: { icon: "🚦", label: "Tránsito", value: "Sin datos", sub: "Conectar feed vial", demo: true },
  playas: { icon: "🏖️", label: "Oleaje / Playas", value: "—", sub: "Conectar boletín Protección Civil", demo: true },
  aeropuerto: { icon: "✈️", label: "Aeropuerto (PVR)", value: "Sin datos", sub: "Conectar API de vuelos", demo: true },
  cruceros: { icon: "🚢", label: "Cruceros hoy", value: "—", sub: "Conectar API de puerto/API-Marina", demo: true },
  calidadAire: { icon: "🌬️", label: "Calidad del aire", value: "—", sub: "Conectar sensor ambiental", demo: true },
};

// ------------------------------------------------------------------
// VALLARTA EXPLICA
// ------------------------------------------------------------------
export type ExplicaItem = {
  slug: string;
  title: string;
  dek: string;
  image: PhotoKey;
  publishedAt: string;
  quePaso: string;
  porQueImporta: string;
  queSabemos: string;
  queNoSabemos: string;
  contexto: string;
  queSigue: string;
  fuentes: { label: string; url: string }[];
};

export const EXPLICA: ExplicaItem[] = [
  {
    slug: "por-que-hay-tanto-trafico-medina-ascencio",
    title: "¿Por qué hay tanto tráfico en Medina Ascencio esta semana?",
    dek: "La combinación de obras de ciclovía, temporada alta y un semáforo dañado explica los tiempos de traslado más largos de lo normal.",
    image: "construccion",
    publishedAt: "2026-09-02T09:00:00-06:00",
    quePaso: "Automovilistas reportan hasta 40 minutos adicionales de traslado sobre la avenida Francisco Medina Ascencio desde el lunes.",
    porQueImporta: "Es la vialidad principal entre el aeropuerto, la zona hotelera y el centro; afecta a residentes, turistas y transporte de carga.",
    queSabemos: "Obras Públicas confirmó el inicio de trabajos de ciclovía en dos tramos, y CFE reportó una falla en el semáforo de la intersección con Ao. Miramar.",
    queNoSabemos: "No hay fecha confirmada para la reparación del semáforo ni un cronograma público detallado por tramo de las obras.",
    contexto: "El proyecto de ciclovía forma parte del plan de movilidad 2025-2027 anunciado en enero.",
    queSigue: "El Ayuntamiento prometió actualizar el cronograma de obras esta semana. Qué Pasa Vallarta dará seguimiento.",
    fuentes: [{ label: "Dirección de Obras Públicas Municipales", url: "#" }, { label: "Reportes de usuarios verificados en campo", url: "#" }],
  },
  {
    slug: "que-implica-nueva-regulacion-airbnb",
    title: "¿Qué implica la nueva regulación de renta vacacional para propietarios?",
    dek: "El cabildo aprobó un reglamento que exige registro obligatorio para plataformas como Airbnb y Vrbo. Esto es lo que se sabe.",
    image: "iglesiaGuadalupe",
    publishedAt: "2026-08-28T11:00:00-06:00",
    quePaso: "El cabildo de Puerto Vallarta aprobó, en primera lectura, un reglamento que obliga a los anfitriones de renta vacacional a registrarse ante el municipio.",
    porQueImporta: "Podría afectar a miles de propietarios que rentan por temporada y cambiar la oferta de hospedaje disponible en la ciudad.",
    queSabemos: "El registro incluiría pago de un padrón anual y verificación de uso de suelo permitido.",
    queNoSabemos: "Aún no se define la cuota exacta ni la fecha en que entraría en vigor; falta la segunda lectura y publicación en la gaceta municipal.",
    contexto: "Otros destinos turísticos de México han implementado regulaciones similares en los últimos dos años.",
    queSigue: "La segunda lectura está programada para la siguiente sesión de cabildo. Qué Pasa Vallarta confirmará fecha cuando el ayuntamiento la publique.",
    fuentes: [{ label: "Gaceta Municipal de Puerto Vallarta", url: "#" }],
  },
];

// ------------------------------------------------------------------
// AGENDA / VIVE VALLARTA — eventos demo
// ------------------------------------------------------------------
export type EventItem = {
  slug: string;
  title: string;
  category: string;
  image: PhotoKey;
  date: string;
  time: string;
  location: string;
  org: string;
  dek: string;
};

export const EVENTS: EventItem[] = [
  {
    slug: "concierto-malecon-septiembre",
    title: "Concierto gratuito en el Malecón: Noche de Jazz",
    category: "Música",
    image: "bailarines",
    date: "2026-09-05",
    time: "19:30",
    location: "Malecón, frente a Los Arcos",
    org: "Ayuntamiento de Puerto Vallarta",
    dek: "Presentación de artistas locales de jazz con entrada libre.",
  },
  {
    slug: "festival-gastronomico-romantica",
    title: "Festival Gastronómico Zona Romántica",
    category: "Gastronomía",
    image: "tacos",
    date: "2026-10-10",
    time: "13:00",
    location: "Calle Basilio Badillo",
    org: "Asociación de Restauranteros",
    dek: "Más de 30 restaurantes con menús especiales a precio fijo.",
  },
  {
    slug: "torneo-voleibol-playa-camarones",
    title: "Torneo Municipal de Vóleibol de Playa",
    category: "Deportes",
    image: "playa",
    date: "2026-09-06",
    time: "09:00",
    location: "Playa Camarones",
    org: "Instituto Municipal del Deporte",
    dek: "Categorías varonil y femenil, entrada libre para el público.",
  },
  {
    slug: "expo-arte-centro-cultural",
    title: "Exposición colectiva 'Bahía' — artistas de Jalisco",
    category: "Cultura",
    image: "fuenteAmistad",
    date: "2026-09-12",
    time: "18:00",
    location: "Centro Cultural Vallarta",
    org: "Secretaría de Cultura Municipal",
    dek: "Pintura y escultura contemporánea inspirada en la costa del Pacífico.",
  },
  {
    slug: "carrera-atletica-malecon",
    title: "Carrera Atlética 5K/10K Malecón Nocturno",
    category: "Deportes",
    image: "ninoCaballito",
    date: "2026-09-20",
    time: "20:00",
    location: "Salida en el Muelle de los Muertos",
    org: "Club de Corredores PV",
    dek: "Recorrido iluminado por el malecón con hidratación cada 2 km.",
  },
];

// ------------------------------------------------------------------
// VALLARTA GUÍA / VALLARTA CONECTA — directorio comercial demo
// ------------------------------------------------------------------
export type Business = {
  slug: string;
  name: string;
  category: string;
  zone: string;
  plan: "conecta" | "conecta-pro" | "partner";
  featured: boolean;
  image?: PhotoKey;
  dek: string;
  phone: string;
  whatsapp: string;
  hours: string;
  website: string;
};

export const BUSINESSES: Business[] = [
  {
    slug: "restaurante-la-palapa-demo",
    name: "La Palapa (negocio demo)",
    category: "Restaurantes",
    zone: "centro",
    plan: "conecta-pro",
    featured: true,
    image: "ceviche",
    dek: "Cocina de mariscos frente al mar con terraza sobre la playa Los Muertos.",
    phone: "322 000 0000",
    whatsapp: "5213220000000",
    hours: "Lun–Dom · 8:00–23:00",
    website: "#",
  },
  {
    slug: "tour-marina-adventures-demo",
    name: "Marina Adventures Tours (negocio demo)",
    category: "Tours y actividades",
    zone: "marina",
    plan: "conecta",
    featured: true,
    image: "ballena",
    dek: "Tours en catamarán a Islas Marietas y avistamiento de ballenas (temporada).",
    phone: "322 000 0001",
    whatsapp: "5213220000001",
    hours: "Lun–Dom · 7:00–18:00",
    website: "#",
  },
  {
    slug: "clinica-dental-vallarta-demo",
    name: "Clínica Dental Vallarta Sonrisas (negocio demo)",
    category: "Salud",
    zone: "versalles",
    plan: "conecta",
    featured: false,
    dek: "Odontología general y estética con atención en inglés y español.",
    phone: "322 000 0002",
    whatsapp: "5213220000002",
    hours: "Lun–Vie · 9:00–19:00",
    website: "#",
  },
  {
    slug: "inmobiliaria-bahia-realty-demo",
    name: "Bahía Realty Group (negocio demo)",
    category: "Inmobiliarias",
    zone: "zona-hotelera",
    plan: "partner",
    featured: true,
    dek: "Venta y renta de propiedades residenciales y de inversión en Bahía de Banderas.",
    phone: "322 000 0003",
    whatsapp: "5213220000003",
    hours: "Lun–Sáb · 9:00–18:00",
    website: "#",
  },
  {
    slug: "taller-automotriz-pitillal-demo",
    name: "Taller Automotriz Pitillal (negocio demo)",
    category: "Automotriz",
    zone: "pitillal",
    plan: "conecta",
    featured: false,
    dek: "Servicio mecánico general, diagnóstico computarizado y hojalatería.",
    phone: "322 000 0004",
    whatsapp: "5213220000004",
    hours: "Lun–Sáb · 8:00–18:00",
    website: "#",
  },
  {
    slug: "boutique-hotel-fluvial-demo",
    name: "Boutique Hotel Fluvial (negocio demo)",
    category: "Hoteles",
    zone: "fluvial",
    plan: "conecta-pro",
    featured: true,
    image: "playa",
    dek: "18 habitaciones, alberca en la azotea y vista a la sierra.",
    phone: "322 000 0005",
    whatsapp: "5213220000005",
    hours: "Recepción 24 h",
    website: "#",
  },
];

export const BUSINESS_PLANS = [
  { id: "conecta", name: "Vallarta Conecta", desc: "Perfil comercial completo en el directorio con ficha, fotos, WhatsApp y estadísticas básicas." },
  { id: "conecta-pro", name: "Vallarta Conecta Pro", desc: "Todo lo de Conecta + posición destacada en su categoría y en Agenda/Guía." },
  { id: "partner", name: "Partner", desc: "Presencia destacada en Home y patrocinio de sección (ej. 'Vallarta Ahora presentado por…')." },
  { id: "campaign", name: "Campaña Especial", desc: "Contenido patrocinado, cobertura de lanzamiento o campaña por tiempo limitado." },
];

// ------------------------------------------------------------------
// AHORA EN VALLARTA — timeline en vivo (demo). En producción esta
// lista se alimenta automáticamente del pipeline editorial (nuevas
// historias, actualizaciones de Story Graph, alertas oficiales) sin
// que el usuario tenga que recargar la página. Aquí es una lista
// estática de demostración — el patrón visual/arquitectura ya está
// listo para conectarse a un stream real (SSE/WebSocket o polling).
// ------------------------------------------------------------------
export type LiveFeedItem = { time: string; text: string; href?: string };

export const LIVE_FEED: LiveFeedItem[] = [
  { time: "21:32", text: "Nuevo aviso de Protección Civil por oleaje en playas del sur", href: "/noticia/temporada-huracanes-alerta-verde-bahia" },
  { time: "21:27", text: "Tráfico aumenta en Francisco Medina Ascencio por obras de ciclovía", href: "/explica/por-que-hay-tanto-trafico-medina-ascencio" },
  { time: "21:19", text: "Llega crucero a la terminal marítima (demo — sin integración de puerto)" },
  { time: "21:12", text: "Autoridades refuerzan operativo de seguridad en el Malecón", href: "/noticia/operativo-seguridad-malecon-fin-semana" },
  { time: "20:58", text: "Restauranteros de la Zona Romántica confirman festival gastronómico", href: "/noticia/festival-gastronomico-romantica-anuncio" },
  { time: "20:41", text: "Ocupación hotelera cierra la jornada cerca del 92%", href: "/noticia/ocupacion-hotelera-fin-de-semana-largo" },
];

export function getNewsBySlug(slug: string) { return NEWS.find((n) => n.slug === slug); }
export function getExplicaBySlug(slug: string) { return EXPLICA.find((n) => n.slug === slug); }
export function getBusinessBySlug(slug: string) { return BUSINESSES.find((n) => n.slug === slug); }
export function getEventBySlug(slug: string) { return EVENTS.find((e) => e.slug === slug); }
export function getCategoryName(slug: string) { return CATEGORIES.find((c) => c.slug === slug)?.name || slug; }
export function getZoneName(slug: string) { return ZONES.find((z) => z.slug === slug)?.name || slug; }
