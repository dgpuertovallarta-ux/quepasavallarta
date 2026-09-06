/**
 * REGISTRO DE FUENTES REALES — no simulado.
 * ------------------------------------------------------------------
 * Modelo de 4 niveles de confianza (tal como lo definió el propietario):
 *
 *   NIVEL A — Medios periodísticos locales (portales de noticias reales,
 *             con RSS verificable). Señal de descubrimiento fuerte, pero
 *             NUNCA se copia su texto ni su fotografía. Siempre revisión
 *             humana antes de publicar.
 *   NIVEL B — Cuentas oficiales (ayuntamiento, protección civil, policía,
 *             gobierno del estado, dependencias). La fuente más confiable:
 *             es la única que puede llegar a auto-publicarse y a que se
 *             extraiga su fotografía oficial (con crédito).
 *   NIVEL C — Comunicadores/reporteros individuales (periodistas con
 *             cuenta propia, sin medio detrás). Solo DETECCIÓN — nunca se
 *             confirma un hecho solo porque lo dijeron; hay que
 *             corroborarlo con NIVEL A o B antes de escribir nada.
 *   NIVEL D — Comunidad y redes sociales (grupos de Facebook, cuentas
 *             ciudadanas, TikTok, etc.). Solo DETECCIÓN — señal de que
 *             "algo puede estar pasando", nunca un hecho confirmado.
 *
 * `trustLevel` (1-5) sigue existiendo para el cálculo del News Score
 * (ver classify.ts): 1 = NIVEL B oficial, 3 = NIVEL A medio local,
 * 4 = NIVEL C comunicador individual, 5 = NIVEL D comunidad/redes.
 *
 * REGLA DURA: solo NIVEL B (trust_level 1) puede pasar por publicación
 * 100% automática y extracción automática de imagen. Todo lo demás
 * SIEMPRE requiere:
 *   - redacción propia y original (nunca copiar el texto de la fuente)
 *   - revisión humana antes de publicar
 *   - nunca usar su fotografía sin permiso explícito
 * NIVEL C y D además tienen `autoDetectOnly: true`: el pipeline los usa
 * solo para detectar que algo está pasando, nunca para redactar un hecho
 * como confirmado — ver /docs/N8N_AUTOMATION.md, sección "Regla
 * fundamental de contenido".
 *
 * Estado de verificación de cada fuente (columna `verified`):
 *   true  = confirmado hoy que el feed responde y trae contenido real
 *   false = URL/cuenta plausible pero no confirmada desde este entorno
 *           (p. ej. sitios .gob.mx que bloquean peticiones automatizadas,
 *           o redes sociales que requieren credenciales de API que el
 *           propietario todavía no ha dado) — verificar antes de activar.
 */

export type SourceTrustLevel = 1 | 2 | 3 | 4 | 5;
export type SourceLevel = "A" | "B" | "C" | "D";

export type Source = {
  id: string;
  name: string;
  type: "rss" | "api" | "official" | "social";
  url: string;
  level: SourceLevel;
  trustLevel: SourceTrustLevel;
  allowImageExtraction: boolean;
  autoDetectOnly: boolean;
  verified: boolean;
  note: string;
};

export const SOURCES: Source[] = [
  // ------------------------------------------------------------------
  // NIVEL A — Medios periodísticos locales (RSS verificado hoy)
  // ------------------------------------------------------------------
  {
    id: "vallarta-daily-news",
    name: "Puerto Vallarta Daily News (PVDN)",
    type: "rss",
    url: "https://www.vallartadaily.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio independiente real (publica en inglés). Usar SOLO como señal " +
      "de descubrimiento. La nota que publicamos se redacta de cero a " +
      "partir de los hechos, nunca copiar/traducir su texto, nunca usar " +
      "su fotografía. Siempre pasa por revisión humana.",
  },
  {
    id: "vallarta-independiente",
    name: "Vallarta Independiente",
    type: "rss",
    url: "https://vallartaindependiente.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio local real, RSS 2.0 verificado hoy (cobertura de gobierno, " +
      "servicios y comunidad). Misma regla: solo señal, redacción propia, " +
      "revisión humana obligatoria, nunca su fotografía.",
  },
  {
    id: "tribuna-de-la-bahia",
    name: "Tribuna de la Bahía",
    type: "rss",
    url: "https://tribunadelabahia.com.mx/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio local real, RSS 2.0 verificado hoy (cobertura de clima/" +
      "protección civil y vialidad en Bahía de Banderas). Misma regla: " +
      "solo señal, redacción propia, revisión humana obligatoria.",
  },
  {
    id: "noticiaspv",
    name: "NoticiasPV",
    type: "rss",
    url: "https://www.noticiaspv.com.mx/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio regional real (Puerto Vallarta / Bahía de Banderas / Nayarit), " +
      "RSS 2.0 verificado hoy. Misma regla: solo señal, redacción propia, " +
      "revisión humana obligatoria.",
  },
  {
    id: "vallarta-en-linea",
    name: "Vallarta en Línea",
    type: "rss",
    url: "https://vallartaenlinea.net/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio local real, RSS válido verificado hoy (cobertura municipal y " +
      "de servicios). Misma regla: solo señal, redacción propia, revisión " +
      "humana obligatoria.",
  },
  {
    id: "vallarta-today",
    name: "Vallarta Today",
    type: "rss",
    url: "https://vallartatoday.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: false,
    note:
      "Medio real conocido, pero /feed/ respondió 404 al verificar. Falta " +
      "encontrar la URL correcta de su RSS (o confirmar que no publica " +
      "uno) antes de activarlo.",
  },
  {
    id: "az-noticias",
    name: "AZ Noticias",
    type: "rss",
    url: "https://www.aznoticias.mx/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: false,
    note:
      "Medio real conocido, pero /feed/ respondió 404 al verificar. Falta " +
      "encontrar la URL correcta de su RSS antes de activarlo.",
  },
  {
    id: "meridiano-vallarta",
    name: "Meridiano (Puerto Vallarta y Bahía de Banderas)",
    type: "rss",
    url: "https://meridiano.mx/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio real, RSS 2.0 verificado hoy. Es un feed regional de Nayarit " +
      "que incluye Puerto Vallarta/Bahía de Banderas junto con otras notas " +
      "de la región — el filtro de relevancia local sigue aplicando igual " +
      "que con cualquier otra fuente. Misma regla: solo señal, redacción " +
      "propia, revisión humana obligatoria.",
  },
  {
    id: "el-vallartense",
    name: "El Vallartense Noticias",
    type: "rss",
    url: "https://elvallartense.com.mx/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio local real, RSS 2.0 verificado hoy. Usar el dominio " +
      "elvallartense.com.mx (el propietario advirtió explícitamente no " +
      "confundirlo con un restaurante del mismo nombre). Misma regla: " +
      "solo señal, redacción propia, revisión humana obligatoria.",
  },
  {
    id: "vallarta-online",
    name: "Vallarta Online",
    type: "rss",
    url: "https://vallartaonline.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio local real, RSS válido verificado hoy — cobertura orientada a " +
      "turismo y cultura. Misma regla: solo señal, redacción propia, " +
      "revisión humana obligatoria.",
  },
  {
    id: "vallarta-hoy",
    name: "Vallarta Hoy",
    type: "rss",
    url: "https://www.vallartahoy.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "Medio local real, RSS 2.0 verificado hoy (cobertura de gobierno, " +
      "comunidad y seguridad en Puerto Vallarta/Bahía de Banderas). Misma " +
      "regla: solo señal, redacción propia, revisión humana obligatoria.",
  },
  {
    id: "diario-de-vallarta",
    name: "Diario de Vallarta & Nayarit",
    type: "rss",
    url: "https://diariodevallarta.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: true,
    note:
      "RSS 2.0 técnicamente válido y con notas de hoy, pero el feed " +
      "general mezcla mucho contenido nacional/internacional sin conexión " +
      "obvia con Puerto Vallarta (geopolítica, cultura general) — aplicar " +
      "el filtro de relevancia local con más cuidado que con otras " +
      "fuentes de esta lista antes de usar cualquier ítem como señal.",
  },
  {
    id: "vallarta-uno",
    name: "Vallarta Uno",
    type: "rss",
    url: "https://vallartauno.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: false,
    note:
      "Medio real de periodismo de investigación (vallartauno.com), pero " +
      "/feed/ respondió error 500 del servidor al verificar. Reintentar " +
      "más adelante o buscar una URL de RSS alterna.",
  },
  {
    id: "siempre-libres",
    name: "Siempre Libres",
    type: "rss",
    url: "https://www.siemprelibres.com/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: false,
    note:
      "Medio real (Casa Editorial Siempre Libres, siemprelibres.com), pero " +
      "/feed/ respondió 404 al verificar. Falta encontrar la URL correcta " +
      "de su RSS antes de activarlo.",
  },
  {
    id: "noticias-vallarta-mx",
    name: "Noticias Vallarta",
    type: "rss",
    url: "https://noticiasvallarta.com.mx/feed/",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: false,
    note:
      "El feed es técnicamente un RSS 2.0 válido, pero todos los ítems " +
      "encontrados datan de mayo de 2022 — parece abandonado/inactivo. No " +
      "activar como fuente en vivo hasta confirmar que vuelve a publicar.",
  },
  {
    id: "vallarta-opina",
    name: "Vallarta Opina",
    type: "social",
    url: "",
    level: "A",
    trustLevel: 3,
    allowImageExtraction: false,
    autoDetectOnly: false,
    verified: false,
    note:
      "Medio real conocido (más de 100k seguidores en Facebook: " +
      "facebook.com/VallartaOpinaOficial), pero no se encontró un sitio " +
      "web propio con RSS — parece operar principalmente por redes " +
      "sociales. Requeriría tratarse como fuente social (API de Meta) en " +
      "vez de RSS, o verificar manualmente si existe un sitio con feed.",
  },

  // ------------------------------------------------------------------
  // NIVEL B — Cuentas oficiales (gobierno / protección civil / servicios)
  // La única capaz de auto-publicación y extracción automática de foto.
  // ------------------------------------------------------------------
  {
    id: "puertovallarta-gob-mx",
    name: "Gobierno de Puerto Vallarta — Comunicados oficiales",
    type: "official",
    url: "https://www.puertovallarta.gob.mx/noticias/comunicados",
    level: "B",
    trustLevel: 1,
    allowImageExtraction: true,
    autoDetectOnly: false,
    verified: false,
    note:
      "URL real de comunicados del ayuntamiento. El sitio bloqueó las " +
      "peticiones automatizadas de este entorno (403), típico de un WAF " +
      "en .gob.mx. Falta verificar manualmente si existe RSS o si el " +
      "ayuntamiento puede dar acceso/API para el pipeline.",
  },
  {
    id: "proteccion-civil-pv",
    name: "Protección Civil y Bomberos Puerto Vallarta",
    type: "social",
    url: "https://www.facebook.com/ProteccionCivilPV",
    level: "B",
    trustLevel: 1,
    allowImageExtraction: true,
    autoDetectOnly: false,
    verified: false,
    note:
      "Cuenta oficial real conocida. Requiere credenciales de API de Meta " +
      "(Facebook Graph API) que el propietario todavía no ha dado — no " +
      "activar hasta tener acceso autorizado.",
  },
  {
    id: "seapal-vallarta",
    name: "SEAPAL Vallarta (agua potable y drenaje)",
    type: "social",
    url: "https://www.facebook.com/SEAPALVallarta",
    level: "B",
    trustLevel: 1,
    allowImageExtraction: true,
    autoDetectOnly: false,
    verified: false,
    note: "Cuenta oficial real conocida. Misma limitación: requiere API de Meta autorizada.",
  },
  {
    id: "gobierno-jalisco",
    name: "Gobierno del Estado de Jalisco",
    type: "official",
    url: "https://www.jalisco.gob.mx/es/prensa",
    level: "B",
    trustLevel: 1,
    allowImageExtraction: true,
    autoDetectOnly: false,
    verified: false,
    note: "Sala de prensa oficial real. Falta verificar si expone RSS o API pública.",
  },
  {
    id: "fiscalia-jalisco",
    name: "Fiscalía del Estado de Jalisco",
    type: "official",
    url: "https://fiscalia.jalisco.gob.mx/",
    level: "B",
    trustLevel: 1,
    allowImageExtraction: true,
    autoDetectOnly: false,
    verified: false,
    note:
      "Fuente oficial real para temas de seguridad — máxima precaución: " +
      "nunca publicar un hecho de seguridad sin confirmación de esta " +
      "fuente o de la policía municipal, aunque otras fuentes lo reporten antes.",
  },

  // ------------------------------------------------------------------
  // NIVEL C — Comunicadores/reporteros individuales: SOLO DETECCIÓN.
  // ------------------------------------------------------------------
  {
    id: "comunicadores-independientes-pv",
    name: "Comunicadores y reporteros independientes de Puerto Vallarta",
    type: "social",
    url: "",
    level: "C",
    trustLevel: 4,
    allowImageExtraction: false,
    autoDetectOnly: true,
    verified: false,
    note:
      "Placeholder de categoría (no una cuenta única): periodistas con " +
      "cuenta propia sin medio detrás. Requiere lista curada manualmente " +
      "y credenciales de API por plataforma. NUNCA se trata su contenido " +
      "como hecho confirmado — solo como señal para investigar y " +
      "corroborar con NIVEL A o B.",
  },

  // ------------------------------------------------------------------
  // NIVEL D — Comunidad y redes sociales: SOLO DETECCIÓN.
  // ------------------------------------------------------------------
  {
    id: "comunidad-redes-sociales-pv",
    name: "Grupos comunitarios y redes sociales (Facebook/X/TikTok/WhatsApp)",
    type: "social",
    url: "",
    level: "D",
    trustLevel: 5,
    allowImageExtraction: false,
    autoDetectOnly: true,
    verified: false,
    note:
      "Placeholder de categoría: grupos vecinales, cuentas ciudadanas y " +
      "menciones en redes. Señal más débil del sistema — nunca se redacta " +
      "una nota basada solo en esto; sirve para detectar que 'algo puede " +
      "estar pasando' y decidir si vale la pena investigar con fuentes " +
      "NIVEL A/B.",
  },
];

/** Solo NIVEL B (oficial) puede auto-publicarse y extraer su propia imagen. */
export function isSafeForAutoPublish(source: Source): boolean {
  return source.level === "B" && source.trustLevel === 1;
}

/** Fuentes NIVEL A o B, activas y verificadas — lo único que el pipeline de ingesta puede consultar hoy. */
export function activeVerifiedSources(): Source[] {
  return SOURCES.filter((s) => s.verified && (s.type === "rss" || s.type === "official"));
}
