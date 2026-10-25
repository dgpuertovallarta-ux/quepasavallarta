// Clasifica cada nota para decidir plantilla, imagen y si necesita revisión humana.

export type TipoNota = "seguridad" | "accidente" | "alerta" | "trafico" | "servicios" | "gobierno" | "comunidad" | "general";

export type Clasificacion = {
  tipo: TipoNota;
  ultimaHora: boolean;       // hecho en curso → plantilla ÚLTIMA HORA
  requiereRevision: boolean; // nota roja, menores o víctimas → cola de aprobación
  etiqueta: string;          // texto de la etiqueta en la tarjeta
};

const R = (words: string[]) => new RegExp("\\b(" + words.join("|") + ")", "i");

const SEGURIDAD = R(["detien", "detenid", "captur", "asegur", "arrest", "homicid", "asesin", "balace", "balea", "dispar", "robo", "rob[oó]",
  "asalt", "fiscal", "privaci[oó]n de la libertad", "secuestr", "levant", "cad[aá]ver", "sin vida", "ejecut", "narco", "armad", "presunt"]);
const ACCIDENTE = R(["accidente", "choque", "chocan", "volcadura", "vuelca", "atropell", "incendio", "se incendia", "explosi[oó]n", "derrumbe", "ahogad", "colisi"]);
const ALERTA = R(["protecci[oó]n civil", "alerta (roja|naranja|amarilla|verde|azul|preventiva|meteorol|por|ante|de tormenta|de hurac|de tsunami|sísmica|s[ií]smica)", "en alerta", "hurac[aá]n", "tormenta", "ciclón", "cicl[oó]n", "lluvia", "inundaci", "inundad", "evacua", "sismo", "temblor",
  "marea", "oleaje", "bandera roja", "creciente", "desborda"]);
const TRAFICO = R(["tr[aá]fico", "circulaci", "obras afectan", "vehiculo descompuesto", "veh[ií]culo descompuesto", "vialidad", "cierre", "cerrad[ao] la", "carril", "embotell", "congesti", "puente", "desv[ií]o", "obra vial", "bacheo"]);
const SERVICIOS = R(["seapal", "agua potable", "corte de agua", "sin agua", "cfe", "apag[oó]n", "sin luz", "basura", "recolecci", "alumbrado", "bache", "drenaje", "fuga"]);
const GOBIERNO = R(["ayuntamiento", "presidente municipal", "presidenta municipal", "cabildo", "regidor", "gobierno", "diputad", "congreso", "presupuesto", "licitaci"]);
const COMUNIDAD = R(["vecinos", "deport", "campeon", "medalla", "festival", "evento", "concierto", "escuela", "estudiante"]);
// "Vuelve la calma", "se aleja", "deja atrás las tormentas": habla del clima pero NO es alerta.
const CALMA = R(["vuelve la calma", "regresa la calma", "deja atr[aá]s", "se aleja", "se disipa", "despejad", "cielo despejado", "buen clima", "sin lluvia", "levantan la alerta", "concluye la alerta", "termina la alerta"]);
const SENSIBLE = R(["menor", "niñ", "adolescente", "v[ií]ctima", "abuso", "violaci", "feminicid", "suicid"]);
const EN_CURSO = R(["en este momento", "ahora mismo", "en curso", "se registra", "reportan", "minutos", "esta mañana", "esta tarde", "esta noche", "hace unos"]);

export function clasificar(titulo: string, cuerpo = ""): Clasificacion {
  const t = `${titulo} ${cuerpo}`;
  let tipo: TipoNota = "general";
  if (SEGURIDAD.test(t)) tipo = "seguridad";
  else if (ALERTA.test(t) && !CALMA.test(t)) tipo = "alerta";
  else if (ACCIDENTE.test(t)) tipo = "accidente";
  else if (TRAFICO.test(t)) tipo = "trafico";
  else if (SERVICIOS.test(t)) tipo = "servicios";
  else if (GOBIERNO.test(t)) tipo = "gobierno";
  else if (COMUNIDAD.test(t)) tipo = "comunidad";

  const requiereRevision = tipo === "seguridad" || SENSIBLE.test(t);
  const ultimaHora = (tipo === "accidente" || tipo === "seguridad" || tipo === "alerta" || tipo === "trafico") && EN_CURSO.test(t);

  const etiquetas: Record<TipoNota, string> = {
    seguridad: "SEGURIDAD", accidente: "ACCIDENTE", alerta: "PROTECCIÓN CIVIL", trafico: "QPV AL VOLANTE",
    servicios: "SERVICIOS", gobierno: "GOBIERNO", comunidad: "COMUNIDAD", general: "PUERTO VALLARTA",
  };
  const etiqueta = /^denuncia ciudadana/i.test(titulo.trim()) ? "DENUNCIA CIUDADANA" : /^reporte ciudadano/i.test(titulo.trim()) ? "REPORTE CIUDADANO" : etiquetas[tipo];
  return { tipo, ultimaHora, requiereRevision, etiqueta };
}
