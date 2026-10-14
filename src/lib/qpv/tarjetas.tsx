/**
 * Tarjetas de publicación QPV (1080 × 1350) — reemplazan a las imágenes
 * generadas con IA en Facebook/Instagram (decisión 2026-10: las fotos de IA
 * restaban credibilidad y Facebook marcaba cada post como "AI content").
 *
 * Imagen de la tarjeta, en este orden:
 *   1. La foto de la fuente si es una institución oficial (con su crédito).
 *   2. Una foto REAL ilustrativa de Vallarta del banco de Wikimedia por
 *      categoría (photos.ts), con su autor y licencia.
 *   3. Si no se pudo descargar ninguna: tarjeta tipográfica sin foto.
 */
import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { Tarjeta, ANCHO, ALTO, type DatosTarjeta, type Plantilla } from "@/components/social/Tarjeta";
import { clasificar } from "./clasificar";
import { creditoOficial } from "./oficiales";
import { PHOTOS, PHOTO_CREDITS, illustrationFor } from "../photos";
import { saveImageBlob, siteUrl } from "../storage/imageBlobs";

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
  /** Foto de la fuente (og:image). Solo se usa si la fuente es oficial. */
  fotoFuente?: string;
  urlFuente?: string;
  detalle?: string;
  plantilla?: Plantilla;
};

export async function datosTarjeta(n: NotaTarjeta): Promise<DatosTarjeta> {
  const c = clasificar(n.titulo);
  const credOficial = creditoOficial(n.urlFuente) ?? creditoOficial(n.fotoFuente);

  let foto: string | null = null;
  let credito: string | undefined;
  if (n.fotoFuente && credOficial) {
    foto = await imagenComoDataUri(n.fotoFuente);
    if (foto) credito = `Foto: ${credOficial}`;
  }
  if (!foto) {
    const key = illustrationFor(n.categoria, n.clave);
    foto = await imagenComoDataUri(PHOTOS[key]);
    if (foto) credito = `Foto ilustrativa${PHOTO_CREDITS[key] ? `: ${PHOTO_CREDITS[key]}` : ""}`;
  }

  let plantilla: Plantilla = n.plantilla ?? (c.tipo === "alerta" ? "alerta" : "estandar");
  if (!foto && plantilla !== "alerta") plantilla = "tarjeta";
  if (plantilla === "estandar" && process.env.QPV_ESTILO_FOTO === "marco") plantilla = "marco";

  return {
    plantilla,
    titulo: n.titulo,
    etiqueta: c.etiqueta,
    credito: credito ?? (credOficial ? `Fuente: ${credOficial}` : undefined),
    foto: foto ?? undefined,
    detalle: n.detalle,
    accion: c.tipo === "alerta" ? "Emergencias: 911" : undefined,
    logo: await dataUriDeAsset("qpv-logo-blanco.png", "image/png"),
    logoAzul: await dataUriDeAsset("qpv-logo-azul.png", "image/png"),
  };
}

export async function renderTarjeta(d: DatosTarjeta): Promise<Buffer> {
  fuentesCache ??= await cargarFuentes();
  const res = new ImageResponse(<Tarjeta {...d} />, { width: ANCHO, height: ALTO, fonts: fuentesCache });
  return Buffer.from(await res.arrayBuffer());
}

/** Genera la tarjeta de una nota, la guarda en Netlify Blobs y devuelve su URL pública (/api/image/…). Nunca lanza. */
export async function crearTarjeta(n: NotaTarjeta): Promise<string | null> {
  try {
    const png = await renderTarjeta(await datosTarjeta(n));
    const { url } = await saveImageBlob(png, "image/png");
    return url;
  } catch (err) {
    console.error("[crearTarjeta] Falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Tarjeta de mapa (QPV al Volante): punto en el mapa + titular + dato de retraso. Nunca lanza. */
export async function crearTarjetaMapa(n: { titulo: string; lugar: string; detalle?: string; lat: number; lon: number; etiqueta?: string }): Promise<string | null> {
  try {
    const { armarMapa } = await import("./mapa");
    const mapa = await armarMapa(n.lat, n.lon, 15, { trafico: true });
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
