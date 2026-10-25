/**
 * Cola de publicación a Facebook/Instagram.
 *
 * Línea pedida por el propietario (2026-10-24):
 *   - Las notas más importantes, revueltas (de distintas secciones): al menos
 *     ~6 al día y como máximo QPV_MAX_POR_DIA (10 por omisión), separadas
 *     QPV_MINUTOS_ENTRE_POSTS (40 por omisión), de 7 a. m. a 11 p. m.
 *   - Tráfico solo con el resumen de las 8 a. m., 2 p. m. y 6 p. m. (va aparte
 *     del límite de notas y sale a su hora).
 *   - Urgentes (alertas, Protección Civil, en curso) primero, sin esperar.
 *   - Huracanes: los videos por boletín van por otro camino (hurricane-video).
 *   - Una nota que lleva más de 8 h esperando ya no sale (dejó de ser noticia).
 * Se procesa al final de cada corrida de /api/ingest (cada 10 min).
 */
import { getStore } from "@netlify/blobs";
import { publishToSocial } from "../social/publishToSocial";
import { clasificar } from "./clasificar";
import { creditoOficial } from "./oficiales";
import { fotoDeArchivo } from "./fotoArchivo";
import { isHurricaneSimonContent } from "../social/editorialPolicy";
import { siteUrl } from "../storage/imageBlobs";

const MAX_POR_DIA = Number(process.env.QPV_MAX_POR_DIA || 10);
const MINUTOS_ENTRE_POSTS = Number(process.env.QPV_MINUTOS_ENTRE_POSTS || 40);
const VIGENCIA_MS = 8 * 3_600_000;
const HORA_INICIO = 7;
const HORA_FIN = 23;

export type ItemRedes = {
  id: string;
  title: string;
  excerpt: string;
  articleUrl: string;
  imageUrl?: string;
  urgente: boolean;
  /** "trafico" = resumen vial de las 8, 14 y 18 h (fuera del límite de notas). */
  tipo?: "nota" | "trafico";
  /** Importancia de la nota (newsScore de la ingesta, 0–100). */
  score?: number;
  /** Sección (etiqueta de clasificar) para revolver las notas. */
  seccion?: string;
  creada: string;
  estado: "pendiente" | "publicando" | "publicada" | "vencida" | "fallida";
  publicadaEn?: string;
  resultado?: string;
};

const store = () => getStore({ name: "qpv-cola-redes", consistency: "strong" });

async function leerTodos(): Promise<ItemRedes[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: "item/" });
  const xs = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }) as Promise<ItemRedes | null>));
  return xs.filter(Boolean) as ItemRedes[];
}

export async function encolarRedes(
  n: { title: string; excerpt: string; articleUrl: string; imageUrl?: string | null },
  opts: { tipo?: "nota" | "trafico"; score?: number } = {}
): Promise<void> {
  if (!n.imageUrl) return; // siempre con imagen (foto propia o tarjeta QPV)
  const c = clasificar(n.title, n.excerpt);
  const tipo = opts.tipo ?? (n.articleUrl.includes("/trafico") ? "trafico" : "nota");
  const item: ItemRedes = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: n.title,
    excerpt: n.excerpt,
    articleUrl: n.articleUrl,
    imageUrl: n.imageUrl ?? undefined,
    urgente: tipo === "nota" && (c.tipo === "alerta" || c.ultimaHora),
    tipo,
    score: opts.score,
    seccion: c.etiqueta,
    creada: new Date().toISOString(),
    estado: "pendiente",
  };
  await store().setJSON("item/" + item.id, item);
}

/** Huella corta del token (no el token) para saber si lo cambiaron. */
function huellaToken(): string {
  const t = process.env.FB_PAGE_ACCESS_TOKEN || "";
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return `${t.length}-${h.toString(36)}`;
}

function diaLocal(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
}

function horaLocalNum(d = new Date()) {
  return Number(d.toLocaleString("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hour12: false })) % 24;
}

/**
 * Candado sencillo para que dos corridas al mismo tiempo (Netlify a veces
 * repite la llamada programada) no publiquen dos veces lo mismo.
 */
async function tomarCandado(): Promise<string | null> {
  const s = store();
  const actual = (await s.get("candado", { type: "json" })) as { token: string; en: number } | null;
  if (actual && Date.now() - actual.en < 90_000) return null;
  const token = Math.random().toString(36).slice(2);
  await s.setJSON("candado", { token, en: Date.now() });
  await new Promise((r) => setTimeout(r, 1200));
  const leido = (await s.get("candado", { type: "json" })) as { token: string } | null;
  return leido?.token === token ? token : null;
}

async function soltarCandado(token: string) {
  const s = store();
  const leido = (await s.get("candado", { type: "json" })) as { token: string } | null;
  if (leido?.token === token) await s.delete("candado");
}

async function publicar(sig: ItemRedes): Promise<string> {
  const s = store();
  await s.setJSON("item/" + sig.id, { ...sig, estado: "publicando" } satisfies ItemRedes);
  const r = await publishToSocial({ title: sig.title, excerpt: sig.excerpt, articleUrl: sig.articleUrl, imageUrl: sig.imageUrl });
  const ok = r.facebook.ok || r.instagram.ok;
  // Token de Facebook vencido/invalidado: la nota NO se gasta, se queda en la
  // cola y se avisa; en cuanto se ponga un token nuevo vuelve a salir.
  if (!ok && /access token|session has been invalidated|OAuthException|token/i.test(r.facebook.error ?? "")) {
    await s.setJSON("item/" + sig.id, { ...sig, estado: "pendiente", resultado: `Token de Facebook inválido: ${r.facebook.error}` } satisfies ItemRedes);
    await s.setJSON("token-invalido", { en: new Date().toISOString(), error: r.facebook.error, huella: huellaToken() });
    console.error("[colaRedes] TOKEN DE FACEBOOK INVÁLIDO — hay que generar uno nuevo (FB_PAGE_ACCESS_TOKEN):", r.facebook.error);
    return "Token de Facebook inválido: no se publicó (la nota sigue en cola).";
  }
  if (r.facebook.ok) await s.delete("token-invalido").catch(() => undefined);
  await s.setJSON("item/" + sig.id, {
    ...sig,
    estado: ok ? "publicada" : "fallida",
    publicadaEn: new Date().toISOString(),
    resultado: `FB: ${r.facebook.ok ? "ok" : r.facebook.error ?? "no"} · IG: ${r.instagram.ok ? "ok" : r.instagram.error ?? "no"}`,
  } satisfies ItemRedes);
  if (!r.facebook.ok) console.error("[colaRedes] Facebook falló:", r.facebook.error);
  return `${ok ? "Publicada en redes" : "Falló en redes"}: ${sig.title}`;
}

/** Publica como máximo una nota de la cola si los límites lo permiten. Nunca lanza. */
export async function procesarColaRedes(): Promise<string> {
  let token: string | null = null;
  try {
    token = await tomarCandado();
    if (!token) return "Otra corrida está publicando.";
    const s = store();
    // Con el token inválido solo se reintenta cada 30 min (por si ya lo cambiaron).
    // Si ya pusieron un token distinto en Netlify, se intenta de inmediato.
    const ti = (await s.get("token-invalido", { type: "json" })) as { en: string; huella?: string } | null;
    if (ti && ti.huella === huellaToken() && Date.now() - new Date(ti.en).getTime() < 30 * 60_000) return "Token de Facebook inválido: esperando token nuevo.";
    const xs = await leerTodos();
    const ahora = Date.now();
    const hoy = diaLocal(new Date().toISOString());

    // Limpieza: vencidas y registros de más de 3 días
    for (const x of xs) {
      const edad = ahora - new Date(x.creada).getTime();
      if (x.estado === "pendiente" && edad > VIGENCIA_MS) await s.setJSON("item/" + x.id, { ...x, estado: "vencida" });
      else if (x.estado !== "pendiente" && edad > 3 * 86_400_000) await s.delete("item/" + x.id);
    }
    // Las que fallaron solo por el token (antes de este cambio) vuelven a la cola.
    for (const x of xs) {
      if (x.estado === "fallida" && /access token|session has been invalidated/i.test(x.resultado ?? "") && ahora - new Date(x.creada).getTime() <= VIGENCIA_MS) {
        x.estado = "pendiente";
        await s.setJSON("item/" + x.id, x);
      }
    }
    const vigentes = xs.filter((x) => x.estado === "pendiente" && ahora - new Date(x.creada).getTime() <= VIGENCIA_MS);

    // 1) Tráfico: el resumen de su hora sale enseguida (máx. 2 h de espera).
    const trafico = vigentes
      .filter((x) => (x.tipo ?? (x.articleUrl.includes("/trafico") ? "trafico" : "nota")) === "trafico")
      .sort((a, b) => b.creada.localeCompare(a.creada));
    for (const t of trafico.slice(1)) await s.setJSON("item/" + t.id, { ...t, estado: "vencida" });
    if (trafico[0]) {
      if (ahora - new Date(trafico[0].creada).getTime() < 2 * 3_600_000) return await publicar(trafico[0]);
      await s.setJSON("item/" + trafico[0].id, { ...trafico[0], estado: "vencida" });
    }

    // 1b) Invitación a mandar reportes ciudadanos: una vez por semana (lunes) y la primera vez.
    await promoReporte(xs).catch((err) => console.error("[colaRedes] promo reporte:", err));

    // 2) Notas: las más importantes, revueltas.
    let notas = vigentes.filter((x) => (x.tipo ?? (x.articleUrl.includes("/trafico") ? "trafico" : "nota")) === "nota");
    if (!notas.length) {
      // Cola vacía: se toma la nota más importante ya publicada en el sitio
      // (últimas 6 h) que todavía no ha salido a Facebook.
      const h0 = horaLocalNum();
      const yaEnCola = new Set(xs.map((x) => x.articleUrl));
      const hoyPub = xs.filter((x) => x.estado === "publicada" && x.publicadaEn && diaLocal(x.publicadaEn) === hoy && x.tipo !== "trafico").length;
      if (h0 >= HORA_INICIO && h0 < HORA_FIN && hoyPub < MAX_POR_DIA) {
        const nuevo = await reabastecer(yaEnCola);
        if (nuevo) notas = [nuevo];
      }
      if (!notas.length) return "Cola vacía.";
    }
    const publicadasHoy = xs.filter(
      (x) => x.estado === "publicada" && x.publicadaEn && diaLocal(x.publicadaEn) === hoy && (x.tipo ?? (x.articleUrl.includes("/trafico") ? "trafico" : "nota")) === "nota"
    );
    const ultimaPub = xs
      .filter((x) => x.estado === "publicada" && x.publicadaEn)
      .sort((a, b) => b.publicadaEn!.localeCompare(a.publicadaEn!))[0];
    const minutos = ultimaPub ? (ahora - new Date(ultimaPub.publicadaEn!).getTime()) / 60_000 : Infinity;
    const h = horaLocalNum();
    const deDia = h >= HORA_INICIO && h < HORA_FIN;

    const urgente = notas.filter((x) => x.urgente).sort((a, b) => a.creada.localeCompare(b.creada))[0];
    if (urgente && minutos >= 10) return await publicar(urgente);
    if (!deDia) return `De noche solo salen urgentes (${notas.length} en espera para la mañana).`;
    if (publicadasHoy.length >= MAX_POR_DIA) return `Límite diario alcanzado (${MAX_POR_DIA}).`;
    if (minutos < MINUTOS_ENTRE_POSTS) return `En espera: faltan ${Math.ceil(MINUTOS_ENTRE_POSTS - minutos)} min para la siguiente.`;

    // Importancia + frescura, y castigo si es de la misma sección que la última publicada.
    const ultimaSeccion = ultimaPub?.seccion;
    const puntaje = (x: ItemRedes) => {
      const horas = (ahora - new Date(x.creada).getTime()) / 3_600_000;
      return (x.score ?? 50) - horas * 4 - (x.seccion && x.seccion === ultimaSeccion ? 15 : 0);
    };
    const sig = notas.sort((a, b) => puntaje(b) - puntaje(a))[0];
    return await publicar(sig);
  } catch (err) {
    console.error("[procesarColaRedes]", err);
    return `Error en la cola de redes: ${err instanceof Error ? err.message : "desconocido"}`;
  } finally {
    if (token) await soltarCandado(token).catch(() => undefined);
  }
}

/**
 * Arma la tarjeta de la nota publicada más importante (últimas 6 h) que no
 * ha salido a redes y la mete a la cola. Así las notas que se publicaron
 * sin tarjeta (o antes de este cambio) también llegan a Facebook.
 */
async function reabastecer(yaEnCola: Set<string>): Promise<ItemRedes | null> {
  try {
    const { getPublishedArticles } = await import("../db/articles");
    const { crearTarjeta } = await import("./tarjetas");
    const recientes = (await getPublishedArticles(40)).filter(
      (a) =>
        Date.now() - new Date(a.publishedAt).getTime() < 6 * 3_600_000 &&
        !yaEnCola.has(`${siteUrl()}/noticia/${a.slug}`) &&
        !isHurricaneSimonContent(`${a.title} ${a.dek}`)
    );
    const a = recientes.sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0];
    if (!a) return null;
    const fuente = a.sources[0]?.url;
    const oficial = a.imageUrl && (creditoOficial(fuente) || /^(denuncia|reporte) ciudadan[oa]/i.test(a.imageCredit ?? ""));
    const archivo = oficial ? null : fotoDeArchivo(a.title, "");
    const cardUrl = await crearTarjeta({
      titulo: a.title,
      categoria: a.category,
      clave: a.slug,
      urlFuente: fuente,
      resumen: a.dek,
      fotoFuente: oficial ? a.imageUrl : archivo?.url,
      creditoFoto: oficial ? a.imageCredit : archivo?.credito,
    });
    const articleUrl = `${siteUrl()}/noticia/${a.slug}`;
    if (!cardUrl) {
      // Se anota para no volver a intentarla en cada corrida.
      await store().setJSON("item/sin-" + a.slug.slice(0, 80), { id: "sin-" + a.slug.slice(0, 80), title: a.title, excerpt: a.dek, articleUrl, urgente: false, tipo: "nota", creada: new Date().toISOString(), estado: "fallida", resultado: "sin tarjeta" } satisfies ItemRedes);
      return null;
    }
    await encolarRedes({ title: a.title, excerpt: a.dek, articleUrl, imageUrl: cardUrl }, { score: a.score });
    const xs = await leerTodos();
    return xs.find((x) => x.articleUrl === articleUrl && x.estado === "pendiente") ?? null;
  } catch (err) {
    console.error("[colaRedes] reabastecer:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Post fijo "¿Viste algo en tu colonia? Repórtalo" con liga a /reporte.
 * Sale la primera vez que corre y luego cada lunes a media mañana.
 */
async function promoReporte(xs: ItemRedes[]) {
  const s = store();
  const guardada = (await s.get("promo-reporte", { type: "json" })) as { en: string; version?: number } | null;
  // La versión 2 es el anuncio de campaña; si solo salió la tarjeta sencilla, se manda la buena.
  const ultima = guardada?.version === 2 ? guardada : null;
  if (!ultima) {
    for (const x of xs) if (x.articleUrl.endsWith("/reporte") && x.estado === "pendiente") await s.setJSON("item/" + x.id, { ...x, estado: "vencida" });
  }
  const h = horaLocalNum();
  const lunes = new Date().toLocaleDateString("en-US", { timeZone: "America/Mexico_City", weekday: "short" }) === "Mon";
  const dias = ultima ? (Date.now() - new Date(ultima.en).getTime()) / 86_400_000 : Infinity;
  if (!(dias === Infinity || (lunes && dias > 5))) return;
  if (h < 10 || h >= 20) return;
  if (ultima && xs.some((x) => x.articleUrl.endsWith("/reporte") && x.estado === "pendiente")) return;
  const { crearPromoReporte } = await import("./tarjetas");
  const cardUrl = await crearPromoReporte();
  if (!cardUrl) return;
  await encolarRedes(
    {
      title: "Reporte ciudadano: ¿viste algo en tu colonia? Mándanos tu reporte con foto",
      excerpt: "Baches, basura, fugas, falta de luz, tráfico o inseguridad: mándanos tu foto y dónde pasa. Nuestro equipo lo revisa y lo publica en el sitio y en Facebook; tu nombre y tu contacto nunca se publican.",
      articleUrl: `${siteUrl()}/reporte`,
      imageUrl: cardUrl,
    },
    { score: 95 }
  );
  await s.setJSON("promo-reporte", { en: new Date().toISOString(), version: 2 });
}

/** Para el panel: lo que está en cola y lo publicado hoy. */
export async function estadoColaRedes() {
  const xs = await leerTodos();
  return xs.sort((a, b) => b.creada.localeCompare(a.creada));
}
