/**
 * Tarjetas de publicación QPV (1080 × 1350) — reemplazan a las imágenes
 * generadas con IA en Facebook/Instagram (decisión 2026-10: las fotos de IA
 * restaban credibilidad y Facebook marcaba cada post como "AI content").
 *
 * Imagen de la tarjeta, en este orden:
 *   1. La foto de la fuente si es una institución oficial (con su crédito).
 *   2. Si no: postal de color QPV (tarjeta tipográfica), sin foto de relleno.
 */
import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { Tarjeta, ANCHO, ALTO, type DatosTarjeta, type Plantilla } from "@/components/social/Tarjeta";
import { ReporteVial, ResumenVial, type DatosReporteVial, type DatosResumenVial } from "@/components/social/TarjetaVial";
import { clasificar } from "./clasificar";
import { creditoOficial } from "./oficiales";
import { saveImageBlob, siteUrl } from "../storage/imageBlobs";
import { fotoFondo } from "./fotoArchivo";
import { titularEnIngles } from "./traducir";
import { CATEGORY_IMAGES } from "../photos";

/** Foto de ambiente para la tarjeta sin foto: muy difuminada y oscura (con sharp). */
async function fondoDifuminado(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(540, 675, { fit: "cover" })
      .blur(7)
      .modulate({ brightness: 0.95, saturation: 1.05 })
      .jpeg({ quality: 70 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

const UA = "Mozilla/5.0 (compatible; QuePasaVallartaBot/1.0; +https://quepasavta.com)";

/** Archivos de /public: se leen del disco si están en la función; si no, del propio sitio. */
async function asset(rel: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", rel));
  } catch {
    try {
      const r = await fetch(`${siteUrl()}/${rel}`, { signal: AbortSignal.timeout(8000) });
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }
}

let fuentesCache: Awaited<ReturnType<typeof cargarFuentes>> | null = null;
async function cargarFuentes() {
  const f = async (n: string) => {
    const b = await asset(`fonts/${n}`);
    if (!b) throw new Error(`Falta la fuente ${n}`);
    return b;
  };
  return [
    { name: "Archivo Narrow", data: await f("archivo-narrow-latin-700-normal.woff"), weight: 700 as const, style: "normal" as const },
    { name: "Archivo", data: await f("archivo-latin-500-normal.woff"), weight: 500 as const, style: "normal" as const },
    { name: "Archivo", data: await f("archivo-latin-800-normal.woff"), weight: 800 as const, style: "normal" as const },
    { name: "Archivo", data: await f("archivo-latin-900-normal.woff"), weight: 900 as const, style: "normal" as const },
  ];
}

async function dataUriDeAsset(rel: string, tipo: string): Promise<string | undefined> {
  const b = await asset(rel);
  return b ? `data:${tipo};base64,${b.toString("base64")}` : undefined;
}

/** Descarga una imagen remota y la devuelve como data URI (máx. 6 MB). */
export async function imagenComoDataUri(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") || "";
    if (!tipo.startsWith("image/") || tipo.includes("svg")) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.byteLength > 6 * 1024 * 1024) return null;
    return `data:${tipo};base64,${b.toString("base64")}`;
  } catch {
    return null;
  }
}

export type NotaTarjeta = {
  titulo: string;
  categoria: string;
  /** Para elegir la foto ilustrativa de forma estable (slug o título). */
  clave: string;
  /** Foto real de la nota (la de su fuente, ya guardada en el sitio). */
  fotoFuente?: string;
  /** Crédito de esa foto ("Ayuntamiento de PV", nombre del medio…). */
  creditoFoto?: string;
  urlFuente?: string;
  detalle?: string;
  /** Resumen de la nota: se muestra solo en la tarjeta sin foto. */
  resumen?: string;
  /** true = sin la traducción al inglés debajo del titular. */
  sinIngles?: boolean;
  plantilla?: Plantilla;
};

export async function datosTarjeta(n: NotaTarjeta): Promise<DatosTarjeta> {
  const c = clasificar(n.titulo);
  const credOficial = creditoOficial(n.urlFuente) ?? creditoOficial(n.fotoFuente);

  let foto: string | null = null;
  let credito: string | undefined;
  if (n.fotoFuente) {
    foto = await imagenComoDataUri(n.fotoFuente);
    if (foto) credito = `Foto: ${n.creditoFoto || credOficial || "fuente original"}`;
  }

  // Con foto real: foto arriba y franja azul QPV (la que más pega en Facebook).
  let plantilla: Plantilla = n.plantilla ?? (foto ? (c.tipo === "alerta" ? "alerta" : "foto") : c.tipo === "alerta" ? "alerta" : "tarjeta");
  if (!foto && plantilla !== "alerta") plantilla = "tarjeta";

  // Sin foto propia: foto de archivo del tema, difuminada, solo de ambiente.
  let fondo: string | undefined;
  let creditoFondo: string | undefined;
  if (!foto && (plantilla === "tarjeta" || plantilla === "alerta")) {
    const f = fotoFondo(n.titulo, n.resumen ?? "", c.etiqueta, CATEGORY_IMAGES, n.categoria);
    fondo = (await fondoDifuminado(f.url)) ?? undefined;
    if (fondo) creditoFondo = f.credito;
  }

  return {
    plantilla,
    titulo: n.titulo,
    etiqueta: c.etiqueta,
    credito: credito ?? (credOficial ? `Fuente: ${credOficial}` : creditoFondo),
    fondo,
    tituloEn: (plantilla === "tarjeta" || plantilla === "foto" || plantilla === "alerta") && !n.sinIngles ? (await titularEnIngles(n.titulo)) ?? undefined : undefined,
    foto: foto ?? undefined,
    detalle: n.detalle ?? (plantilla === "tarjeta" ? n.resumen : undefined),
    accion: c.tipo === "alerta" ? "Emergencias: 911" : undefined,
    logo: await dataUriDeAsset("qpv-logo-blanco.png", "image/png"),
    logoAzul: await dataUriDeAsset("qpv-logo-azul.png", "image/png"),
  };
}

async function renderElemento(el: React.ReactElement): Promise<Buffer> {
  fuentesCache ??= await cargarFuentes();
  const res = new ImageResponse(el, { width: ANCHO, height: ALTO, fonts: fuentesCache });
  return Buffer.from(await res.arrayBuffer());
}

export async function renderTarjeta(d: DatosTarjeta): Promise<Buffer> {
  return renderElemento(<Tarjeta {...d} />);
}

export function horaLocal(fecha = new Date()): string {
  return fecha.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Postal amarilla de QPV al Volante (un incidente o una vialidad cargada). Nunca lanza. */
export async function crearReporteVial(d: Omit<DatosReporteVial, "logoAzul">): Promise<string | null> {
  try {
    const png = await renderElemento(<ReporteVial {...d} logoAzul={await dataUriDeAsset("qpv-logo-azul.png", "image/png")} />);
    return (await saveImageBlob(png, "image/png")).url;
  } catch (err) {
    console.error("[crearReporteVial] Falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Postal azul con el semáforo de las vialidades. Nunca lanza. */
export async function crearResumenVial(d: Omit<DatosResumenVial, "logo">): Promise<string | null> {
  try {
    const png = await renderElemento(<ResumenVial {...d} logo={await dataUriDeAsset("qpv-logo-blanco.png", "image/png")} />);
    return (await saveImageBlob(png, "image/png")).url;
  } catch (err) {
    console.error("[crearResumenVial] Falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Genera la tarjeta de una nota, la guarda en Netlify Blobs y devuelve su URL pública (/api/image/…). Nunca lanza. */
export async function crearTarjeta(n: NotaTarjeta): Promise<string | null> {
  // Regla (2026-10): nunca foto de otro medio. Sin foto propia (oficial o de
  // archivo que sí corresponde) sale la tarjeta tipográfica QPV, sin foto.
  try {
    const datos = await datosTarjeta(n);
    const png = await renderTarjeta(datos);
    const { url } = await saveImageBlob(png, "image/png");
    return url;
  } catch (err) {
    console.error("[crearTarjeta] Falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Tarjeta de mapa (QPV al Volante): punto en el mapa + titular + dato de retraso. Nunca lanza. */
export async function crearTarjetaMapa(n: { titulo: string; lugar: string; detalle?: string; lat: number; lon: number; etiqueta?: string; zoom?: number }): Promise<string | null> {
  try {
    const { armarMapa } = await import("./mapa");
    const mapa = await armarMapa(n.lat, n.lon, n.zoom ?? 15, { trafico: true });
    if (!mapa.tiles.length) return null; // sin mapa no hay imagen
    const png = await renderTarjeta({
      plantilla: "mapa",
      titulo: n.titulo,
      etiqueta: n.etiqueta ?? "QPV AL VOLANTE",
      lugar: n.lugar,
      detalle: n.detalle,
      credito: process.env.TOMTOM_API_KEY ? "Mapa y tráfico: © TomTom" : "Mapa: © OpenStreetMap",
      mapa,
      logo: await dataUriDeAsset("qpv-logo-blanco.png", "image/png"),
    });
    return (await saveImageBlob(png, "image/png")).url;
  } catch (err) {
    console.error("[crearTarjetaMapa] Falló:", err instanceof Error ? err.message : err);
    return null;
  }
}
