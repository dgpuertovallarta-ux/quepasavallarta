import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { publishArticle } from "@/lib/db/articles";
import { isDatabaseConfigured } from "@/lib/db/client";
import { saveImageBlob, siteUrl } from "@/lib/storage/imageBlobs";
import { avisarEquipo } from "@/lib/qpv/avisosEquipo";

const TIPOS: Record<string, string> = {
  bache: "Bache o calle dañada",
  basura: "Basura",
  agua: "Agua o drenaje",
  luz: "Alumbrado o luz",
  transito: "Tráfico o vialidad",
  seguridad: "Inseguridad",
  abuso: "Abuso en vía pública",
  otro: "Otro",
};

/**
 * Reporte ciudadano (2026-10): lo manda un lector desde /reporte con foto y
 * ubicación. Entra a la cola de aprobación del panel (nunca se publica sola).
 * El contacto del denunciante NO se publica: se guarda aparte en Blobs
 * ("qpv-denuncias") solo para el equipo.
 */
const MAX_FOTO = 8 * 1024 * 1024;

function limpio(v: FormDataEntryValue | null, max: number): string {
  return typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, max) : "";
}

function capitalizar(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "El sitio no está listo para recibir denuncias." }, { status: 503 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }
  // Trampa para robots: un campo oculto que una persona nunca llena.
  if (limpio(form.get("web"), 200)) return NextResponse.json({ ok: true });

  const lugar = limpio(form.get("lugar"), 140);
  const texto = limpio(form.get("texto"), 3000);
  const titulo = limpio(form.get("titulo"), 110);
  const contacto = limpio(form.get("contacto"), 140);
  const nombre = limpio(form.get("nombre"), 80);
  const tipo = TIPOS[limpio(form.get("tipo"), 20)] ?? TIPOS.otro;
  const lat = Number(limpio(form.get("lat"), 20));
  const lon = Number(limpio(form.get("lon"), 20));
  const mapa = Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`
    : undefined;
  if (lugar.length < 4) return NextResponse.json({ error: "Escribe dónde pasa (colonia, calle o punto de referencia)." }, { status: 400 });
  if (texto.length < 40) return NextResponse.json({ error: "Cuéntanos un poco más: al menos un par de líneas sobre qué pasa." }, { status: 400 });

  let imageUrl: string | undefined;
  const foto = form.get("foto");
  if (foto && typeof foto !== "string" && foto.size > 0) {
    if (!foto.type.startsWith("image/") || foto.type.includes("svg")) return NextResponse.json({ error: "La foto debe ser JPG, PNG o WEBP." }, { status: 400 });
    if (foto.size > MAX_FOTO) return NextResponse.json({ error: "La foto pesa más de 8 MB; manda una más ligera." }, { status: 400 });
    imageUrl = (await saveImageBlob(Buffer.from(await foto.arrayBuffer()), foto.type)).url;
  }

  const parrafos = texto.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  const tituloFinal = `Reporte ciudadano: ${capitalizar(titulo || `vecinos reportan ${tipo.toLowerCase()} en ${lugar}`)}`.slice(0, 140);
  const cuerpo = [
    `Un lector de Qué Pasa Vallarta envió el siguiente reporte (${tipo.toLowerCase()}) sobre una situación en ${lugar}:`,
    ...parrafos.map((p) => `«${p.replace(/[«»"]/g, "")}»`),
    `Ubicación reportada: ${lugar}.`,
    "Este es un reporte ciudadano. Qué Pasa Vallarta lo publica para dar voz a los vecinos y buscará la postura de las autoridades correspondientes. ¿Viste algo en tu colonia? Mándanos tu reporte con foto en quepasavta.com/reporte.",
  ].join("\n\n");

  try {
    const { slug } = await publishArticle({
      title: tituloFinal,
      excerpt: parrafos[0].slice(0, 220),
      body: cuerpo,
      categorySlug: "comunidad",
      newsScore: 55,
      aiModel: null,
      storyExternalKey: null,
      imageUrl,
      imageCredit: imageUrl ? "Reporte ciudadano" : undefined,
      imageLicenseStatus: imageUrl ? "source_unlicensed" : undefined,
      status: "pending_review",
      permitirParecida: true,
    });
    await getStore({ name: "qpv-denuncias", consistency: "strong" }).setJSON(slug, {
      nombre, contacto, lugar, texto, tipo, mapa, recibida: new Date().toISOString(),
    });
    // Aviso por WhatsApp a los números del equipo (configurados en Netlify, nunca públicos).
    await avisarEquipo({ tipo, lugar, resumen: parrafos.join(" "), foto: imageUrl, mapa, slug }, siteUrl()).catch(() => 0);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/denuncia]", err);
    return NextResponse.json({ error: "No se pudo enviar. Intenta de nuevo en unos minutos." }, { status: 500 });
  }
}
