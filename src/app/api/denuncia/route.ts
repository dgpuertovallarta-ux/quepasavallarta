import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { publishArticle } from "@/lib/db/articles";
import { isDatabaseConfigured } from "@/lib/db/client";
import { saveImageBlob } from "@/lib/storage/imageBlobs";

/**
 * Denuncia ciudadana (2026-10): la manda un lector desde /denuncia con foto y
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
  const tituloFinal = `Denuncia ciudadana: ${capitalizar(titulo || `vecinos reportan problema en ${lugar}`)}`.slice(0, 140);
  const cuerpo = [
    `Un lector de Qué Pasa Vallarta envió la siguiente denuncia sobre una situación en ${lugar}:`,
    ...parrafos.map((p) => `«${p.replace(/[«»"]/g, "")}»`),
    `Ubicación reportada: ${lugar}.`,
    "Esta es una denuncia ciudadana. Qué Pasa Vallarta la publica para dar voz a los vecinos y buscará la postura de las autoridades correspondientes. ¿Tienes una denuncia? Envíala en quepasavta.com/denuncia.",
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
      imageCredit: imageUrl ? "Denuncia ciudadana" : undefined,
      imageLicenseStatus: imageUrl ? "source_unlicensed" : undefined,
      status: "pending_review",
      permitirParecida: true,
    });
    await getStore({ name: "qpv-denuncias", consistency: "strong" }).setJSON(slug, {
      nombre, contacto, lugar, texto, recibida: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/denuncia]", err);
    return NextResponse.json({ error: "No se pudo enviar. Intenta de nuevo en unos minutos." }, { status: 500 });
  }
}
