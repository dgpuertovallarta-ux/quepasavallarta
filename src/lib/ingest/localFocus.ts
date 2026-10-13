import type { Story } from "./storyGraph";
import { SOURCES } from "./sources";

/**
 * Enfoque editorial del sitio: primero Puerto Vallarta, y en días de
 * emergencia, primero Protección Civil. Este archivo decide dos cosas
 * ANTES de gastar una redacción con IA:
 *
 *  1. Prioridad — de todas las historias elegibles de una corrida, cuál
 *     se prepara primero (solo se envía un borrador por corrida).
 *  2. Fuera de tema — historias que claramente ocurren en otro lugar
 *     (Tulum, Tepic, Guadalajara…) y no mencionan a Vallarta ni la bahía:
 *     no se envían a aprobación.
 *
 * Es deliberadamente simple (listas de palabras, sin IA) para que sea
 * predecible y fácil de ajustar.
 */

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")} `;
}

function mentionsAny(normalizedText: string, terms: string[]): boolean {
  return terms.some((t) => normalizedText.includes(` ${t} `));
}

// Puerto Vallarta y su zona inmediata (municipio, bahía y costa vecina).
const LOCAL_TERMS = [
  "vallarta", "pitillal", "ixtapa", "las juntas", "mismaloya", "boca de tomatlan", "conchas chinas", "zona romantica",
  "5 de diciembre", "versalles", "fluvial", "el coapinole", "coapinole", "las mojoneras", "mojoneras", "el colomo",
  "las palmas", "rio cuale", "rio pitillal", "rio ameca", "rio mascota", "los arcos", "islas marietas", "seapal",
  "cabo corrientes", "el tuito", "yelapa", "tomatlan", "bahia de banderas", "nuevo nayarit", "bucerias", "sayulita",
  "punta de mita", "punta mita", "san pancho", "la cruz de huanacaxtle", "mezcales", "san jose del valle",
  "valle de banderas", "san vicente", "jarretaderas", "san sebastian del oeste", "mascota",
];

// Lugares que, si aparecen SIN ninguna mención local, indican que la nota
// es de otro lado. (Colima/Manzanillo no están aquí a propósito: los
// ciclones que amenazan Vallarta suelen medirse desde ahí.)
const ELSEWHERE_TERMS = [
  "tulum", "cancun", "playa del carmen", "quintana roo", "yucatan", "merida", "cdmx", "ciudad de mexico",
  "estado de mexico", "monterrey", "nuevo leon", "tijuana", "mexicali", "baja california", "los cabos", "la paz",
  "acapulco", "guerrero", "oaxaca", "chiapas", "veracruz", "tabasco", "puebla", "queretaro", "guanajuato", "leon",
  "sinaloa", "mazatlan", "culiacan", "sonora", "hermosillo", "chihuahua", "ciudad juarez", "tamaulipas", "coahuila",
  "michoacan", "morelia", "zacatecas", "aguascalientes", "san luis potosi", "durango", "guadalajara", "zapopan",
  "tlaquepaque", "tonala", "tlajomulco", "lagos de moreno", "tepatitlan", "ocotlan", "chapala", "ciudad guzman",
  "tepic", "xalisco", "compostela", "santiago ixcuintla", "tecuala", "acaponeta", "ixtlan del rio", "tuxpan",
  "estados unidos", "texas", "california", "florida", "nueva york", "washington", "canada", "espana", "europa",
];

// Temas de Protección Civil y servicios en emergencia.
const EMERGENCY_TERMS = [
  "proteccion civil", "huracan", "tormenta tropical", "ciclon", "depresion tropical", "evacuacion", "evacuan",
  "evacuar", "refugio", "refugios", "refugio temporal", "albergue", "albergues", "alerta", "alertas", "inundacion",
  "inundaciones", "desbordamiento", "desborda", "deslave", "deslaves", "derrumbe", "marejada", "oleaje elevado",
  "mar de fondo", "capitania de puerto", "cierre de puerto", "cierran puerto", "puerto cerrado", "bomberos",
  "suspenden clases", "suspension de clases", "suspenden actividades", "suspension de actividades", "corte de agua",
  "suspension del servicio", "apagon", "sin luz", "cfe", "rafagas", "lluvias intensas", "lluvias torrenciales",
  "zona de riesgo", "zonas de riesgo", "damnificados", "sismo", "temblor", "tsunami", "incendio forestal",
];

function storyText(story: Story): string {
  return normalize(story.items.map((it) => `${it.title} ${it.excerpt.slice(0, 600)}`).join(" "));
}

export function isLocalStory(story: Story): boolean {
  return mentionsAny(storyText(story), LOCAL_TERMS);
}

export function isEmergencyStory(story: Story): boolean {
  return mentionsAny(storyText(story), EMERGENCY_TERMS);
}

/** true si la historia es claramente de otro lugar y no toca a Vallarta ni a la bahía. */
export function isOffTopicStory(story: Story): boolean {
  const text = storyText(story);
  return !mentionsAny(text, LOCAL_TERMS) && mentionsAny(text, ELSEWHERE_TERMS);
}

const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

/** ¿La historia viene de un boletín oficial periódico (aviso de huracán)? */
export function isOfficialBulletinStory(story: Story): boolean {
  return story.items.some((it) => SOURCE_BY_ID.get(it.sourceId)?.bulletin);
}

/**
 * Prioridad editorial (más alto = sale primero):
 *   +4  boletín oficial (aviso de huracán vigente para la costa)
 *   +2  tema de Protección Civil / emergencia
 *   +1  ocurre en Vallarta o la bahía
 * A igual prioridad decide el News Score, como antes.
 */
export function storyPriority(story: Story): number {
  let p = 0;
  if (isOfficialBulletinStory(story)) p += 4;
  if (isEmergencyStory(story)) p += 2;
  if (isLocalStory(story)) p += 1;
  return p;
}

export function sortByEditorialFocus(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => storyPriority(b) - storyPriority(a) || b.maxNewsScore - a.maxNewsScore);
}
