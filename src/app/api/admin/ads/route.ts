import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth/currentAdmin";
import { AD_SLOTS, createAd, setAdActive, type AdSlotId } from "@/lib/business/db";
import { saveImageBlob } from "@/lib/storage/imageBlobs";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

/** Alta de un banner (formulario con imagen). */
export async function POST(request: Request) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Sesión de administrador inválida." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }
  const advertiser = String(form.get("advertiser") || "").trim();
  const slot = String(form.get("slot") || "") as AdSlotId;
  let linkUrl = String(form.get("link") || "").trim();
  const endsAt = String(form.get("endsAt") || "").trim() || null;
  const image = form.get("image");

  if (!advertiser) return NextResponse.json({ error: "Falta el nombre del anunciante." }, { status: 400 });
  if (!AD_SLOTS.some((s) => s.id === slot)) return NextResponse.json({ error: "Elige dónde va el banner." }, { status: 400 });
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) linkUrl = `https://${linkUrl}`;
  if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(linkUrl)) return NextResponse.json({ error: "El enlace del anunciante no es válido." }, { status: 400 });
  if (endsAt && !/^\d{4}-\d{2}-\d{2}$/.test(endsAt)) return NextResponse.json({ error: "Fecha de fin inválida." }, { status: 400 });
  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: "Falta la imagen del banner." }, { status: 400 });
  if (!IMAGE_TYPES.includes(image.type)) return NextResponse.json({ error: "La imagen debe ser JPG, PNG, GIF o WEBP." }, { status: 400 });
  if (image.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 3 MB." }, { status: 400 });

  try {
    const bytes = Buffer.from(await image.arrayBuffer());
    const { url } = await saveImageBlob(bytes, image.type);
    const id = await createAd({ advertiser, slot, imageUrl: url, linkUrl, endsAt });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[admin-ads]", err);
    return NextResponse.json({ error: "No se pudo guardar el banner." }, { status: 500 });
  }
}

/** Pausar o reactivar un banner. */
export async function PATCH(request: Request) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Sesión de administrador inválida." }, { status: 401 });
  let body: { id?: unknown; active?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || typeof body.active !== "boolean") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    await setAdActive(id, body.active);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el banner." }, { status: 500 });
  }
}
