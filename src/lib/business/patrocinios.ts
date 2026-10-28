/**
 * Patrocinios "Presentado por" (2026-10-25).
 * Se dan de alta en el panel → Comercial como un banner con lugar
 * "Presentado por · …" (la imagen es el LOGO del patrocinador).
 * Aparecen en la sección del sitio y en las publicaciones automáticas de
 * Facebook de esa sección; cada publicación se cuenta para su reporte del mes.
 */
import { getStore } from "../storage/blobs";
import { usaWordPress, wp, wpBase } from "../wp/cliente";
import { getActiveAd } from "./db";

export type SeccionPatrocinio = "trafico" | "huracanes" | "clima" | "reportes";
export type Patrocinio = { id: number; nombre: string; logo: string; clic: string; destino: string };

export async function getPatrocinio(seccion: SeccionPatrocinio): Promise<Patrocinio | null> {
  // Sitio en WordPress: los anuncios viven en el panel (menú Anuncios).
  if (usaWordPress()) {
    try {
      const p = await wp<{ id: number; nombre: string; logo: string } | null>(`/qpv/v1/patrocinio?seccion=${seccion}`);
      return p ? { id: p.id, nombre: p.nombre, logo: p.logo, clic: `${wpBase()}/?qpv_ad=${p.id}`, destino: "" } : null;
    } catch {
      return null;
    }
  }
  try {
    const ad = await getActiveAd(`pat-${seccion}` as never);
    if (!ad) return null;
    return { id: ad.id, nombre: ad.advertiser, logo: ad.imageUrl, clic: `/api/ad/${ad.id}`, destino: ad.linkUrl };
  } catch {
    return null;
  }
}

function mes(fecha = new Date()) {
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }).slice(0, 7);
}

const store = () => getStore({ name: "qpv-patrocinios", consistency: "strong" });

/** Suma una publicación en Facebook al reporte del patrocinador. Nunca lanza. */
export async function contarPublicacion(id: number, titulo: string): Promise<void> {
  try {
    const s = store();
    const k = `pub/${id}/${mes()}`;
    const actual = ((await s.get(k, { type: "json" })) as { n: number; ultimas: { t: string; en: string }[] } | null) ?? { n: 0, ultimas: [] };
    actual.n += 1;
    actual.ultimas = [{ t: titulo.slice(0, 140), en: new Date().toISOString() }, ...actual.ultimas].slice(0, 60);
    await s.setJSON(k, actual);
  } catch (err) {
    console.error("[patrocinios] contar:", err instanceof Error ? err.message : err);
  }
}

export async function publicacionesDelMes(id: number, m = mes()): Promise<{ n: number; ultimas: { t: string; en: string }[] }> {
  try {
    return ((await store().get(`pub/${id}/${m}`, { type: "json" })) as { n: number; ultimas: { t: string; en: string }[] } | null) ?? { n: 0, ultimas: [] };
  } catch {
    return { n: 0, ultimas: [] };
  }
}

export function mesActual() {
  return mes();
}

/** Rutas del sitio que cuentan como "vistas" de cada patrocinio. */
export const RUTAS_SECCION: Record<SeccionPatrocinio, string[]> = {
  trafico: ["/trafico"],
  huracanes: [], // va en los videos de Facebook, no en la página de Protección Civil
  clima: ["/categoria/clima"],
  reportes: ["/reporte"],
};

/**
 * ¿Qué patrocinio le toca a esta nota? Reportes ciudadanos → "reportes";
 * notas de clima → "clima". Nunca en alertas (Protección Civil, huracán, emergencia).
 */
export async function patrocinioParaNota(titulo: string, categoria: string): Promise<Patrocinio | null> {
  if (/^(reporte|denuncia) ciudadan/i.test(titulo)) return getPatrocinio("reportes");
  if (categoria === "clima") {
    const { clasificar } = await import("../qpv/clasificar");
    if (clasificar(titulo).tipo === "alerta") return null;
    return getPatrocinio("clima");
  }
  return null;
}
