// Filtro de duplicados: evita que la misma nota salga dos veces con distinto título.
// Una nota se considera repetida si, contra lo publicado en las últimas 48 h:
//   a) comparte la URL de origen, o
//   b) comparte >= 2 "anclas" (lugar, institución, cifra) y el texto se parece >= 35 %, o
//   c) el texto se parece >= 60 % aunque no haya anclas.

export type NotaComparable = {
  id?: string;
  titulo: string;
  resumen?: string;
  urlOrigen?: string;
  publicadaEn?: string | Date;
};

const STOP = new Set(
  ("a al algo ante antes como con contra cual cuando de del desde donde dos el ella ellos en entre era es esta este esto " +
    "fue han hasta la las le les lo los mas más mismo muy no nos o para pero por que qué se sea ser si sin sobre su sus " +
    "tambien también tras un una uno unos y ya tiene tienen hay será serán fueron sido este esta estos estas").split(" ")
);

// Instituciones y lugares de la región: si dos notas los comparten, es fuerte indicio de que son la misma.
const ANCLAS = [
  "seapal", "cfe", "imss", "issste", "fiscalia", "fiscalía", "proteccion civil", "protección civil", "bomberos", "cruz roja",
  "guardia nacional", "policia municipal", "policía municipal", "ayuntamiento", "cabildo", "dif", "ideft", "comusida",
  "sedena", "semar", "conagua", "sct", "sict", "medina ascencio", "ameca", "cuale", "pitillal", "las juntas", "ixtapa",
  "mojoneras", "coapinole", "el tuito", "mismaloya", "boca de tomatlan", "boca de tomatlán", "bucerias", "bucerías",
  "nuevo vallarta", "mezcales", "san vicente", "valle de banderas", "sayulita", "punta de mita", "malecon", "malecón",
  "versalles", "la vena", "aeropuerto", "hospital regional", "el gavilan", "el gavilán", "colosio", "francisco villa",
];

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Raíz simple para que "capacita" y "capacitan", "detienen" y "detenido" se parezcan.
function raiz(w: string): string {
  return w.length > 5 ? w.slice(0, 5) : w;
}

function tokens(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(raiz);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// Coeficiente de "contención": qué tanto del texto más corto está en el otro.
function contencion(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function anclas(texto: string): Set<string> {
  const t = " " + normalizar(texto) + " ";
  const out = new Set<string>();
  for (const a of ANCLAS) {
    const n = normalizar(a);
    if (t.includes(" " + n + " ")) out.add(n);
  }
  // Nombres propios (palabras con mayúscula que no inician el texto): personas, equipos, países
  const crudo = texto.replace(/[.:;!?¿¡]\s+/g, " | ");
  const palabras = crudo.split(/\s+/);
  const yaContadas = new Set([...out].flatMap((a) => a.split(" ")));
  const COMUNES = new Set(["puerto", "vallarta", "jalisco", "nayarit", "bahia", "bahía", "banderas", "mexico", "méxico"]);
  palabras.forEach((w, i) => {
    const limpia = w.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
    if (i > 0 && palabras[i - 1] !== "|" && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}$/.test(limpia) && !COMUNES.has(limpia.toLowerCase()) && !yaContadas.has(normalizar(limpia)))
      out.add("@" + normalizar(limpia));
  });
  // Cifras significativas (47 trabajadores, 12 horas, 2026 no cuenta como cifra del hecho)
  for (const m of t.matchAll(/\b(\d{1,4})\b/g)) {
    const v = m[1];
    if (!/^20\d\d$/.test(v)) out.add("#" + v);
  }
  return out;
}

export type ResultadoDuplicado = { duplicada: false } | { duplicada: true; de: NotaComparable; motivo: string; parecido: number };

export function esDuplicada(nueva: NotaComparable, recientes: NotaComparable[], horas = 48): ResultadoDuplicado {
  const limite = Date.now() - horas * 3600_000;
  const txtN = `${nueva.titulo} ${nueva.resumen ?? ""}`;
  const tokN = new Set(tokens(txtN));
  const tokTitN = new Set(tokens(nueva.titulo));
  const ancN = anclas(txtN);

  let mejor: ResultadoDuplicado = { duplicada: false };
  let mejorScore = 0;

  for (const r of recientes) {
    if (r.publicadaEn && new Date(r.publicadaEn).getTime() < limite) continue;
    if (nueva.urlOrigen && r.urlOrigen && normalizarUrl(nueva.urlOrigen) === normalizarUrl(r.urlOrigen)) {
      return { duplicada: true, de: r, motivo: "misma fuente", parecido: 1 };
    }
    const txtR = `${r.titulo} ${r.resumen ?? ""}`;
    const tokR = new Set(tokens(txtR));
    const parecido = Math.max(jaccard(tokN, tokR), contencion(tokTitN, new Set(tokens(r.titulo))) * 0.9);
    const ancR = anclas(txtR);
    let comunes = 0;
    for (const a of ancN) if (ancR.has(a)) comunes++;

    let motivo = "";
    if (comunes >= 3 && parecido >= 0.1) motivo = `comparte ${comunes} datos clave`;
    else if (comunes >= 2 && parecido >= 0.2) motivo = `comparte ${comunes} datos clave`;
    else if (parecido >= 0.6) motivo = "texto casi igual";
    if (motivo && parecido + comunes * 0.1 > mejorScore) {
      mejorScore = parecido + comunes * 0.1;
      mejor = { duplicada: true, de: r, motivo, parecido: Math.round(parecido * 100) / 100 };
    }
  }
  return mejor;
}

function normalizarUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/$/, "")).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

/** Parecido 0–1 entre dos textos (palabras clave en común), sin reglas de anclas. */
export function parecido(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  return Math.max(jaccard(ta, tb), contencion(ta, tb) * 0.6);
}
