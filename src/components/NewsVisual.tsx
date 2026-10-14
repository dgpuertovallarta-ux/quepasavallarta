import Image from "next/image";
import { getCategoryName } from "@/lib/data";

/**
 * Imagen de una nota en el sitio.
 *
 * Decisión editorial (2026-10): una nota solo lleva FOTO si es suya (la de
 * la fuente oficial o una propia, `imageUrl`). Las fotos ilustrativas del
 * banco (playas, malecón, papel picado…) no tenían nada que ver con el tema
 * y restaban seriedad, así que ya no se muestran en noticias: en su lugar va
 * un bloque de color QPV con la sección, como hacen N+ o Uno TV con sus
 * plecas. Agenda y Guía conservan sus fotos de lugar, que sí corresponden.
 *
 * Se coloca dentro de un contenedor con position: relative y tamaño
 * definido (.card-media, .lead-media, .hero-slide-media…), igual que un
 * <Image fill>.
 */

type Tono = "rojo" | "navy" | "ambar" | "teal" | "azul";

const TONO_POR_SECCION: Record<string, Tono> = {
  "ultima-hora": "rojo",
  seguridad: "rojo",
  "proteccion-civil": "rojo",
  gobierno: "navy",
  politica: "navy",
  jalisco: "navy",
  mexico: "navy",
  mundo: "navy",
  transito: "ambar",
  servicios: "ambar",
  clima: "teal",
  "medio-ambiente": "teal",
  playas: "teal",
  turismo: "teal",
};

export function tieneFotoPropia(n: { imageUrl?: string }): boolean {
  return !!n.imageUrl;
}

export default function NewsVisual({
  n,
  sizes,
  priority,
  alt = "",
  credito = true,
  pequena,
  seccion,
  fondo,
}: {
  n: { imageUrl?: string; imageCredit?: string; category?: string };
  sizes?: string;
  priority?: boolean;
  alt?: string;
  /** Mostrar el crédito de la foto sobre la imagen. */
  credito?: boolean;
  /** Miniatura (listas): solo el logo, sin texto de sección. */
  pequena?: boolean;
  /** Solo el color de sección (para portadas con el titular encima). */
  fondo?: boolean;
  /** Texto de la pleca cuando no hay categoría (p. ej. "Vallarta Explica"). */
  seccion?: string;
}) {
  if (n.imageUrl) {
    return (
      <>
        <Image src={n.imageUrl} alt={alt} fill sizes={sizes || "(max-width: 720px) 100vw, 33vw"} priority={priority} unoptimized style={{ objectFit: "cover" }} />
        {credito && <span className="photo-tag">Foto: {n.imageCredit || "fuente original"}</span>}
      </>
    );
  }
  return <SeccionTile category={n.category} pequena={pequena} seccion={seccion} fondo={fondo} />;
}

export function SeccionTile({ category, pequena, seccion, fondo }: { category?: string; pequena?: boolean; seccion?: string; fondo?: boolean }) {
  const tono = (category && TONO_POR_SECCION[category]) || "azul";
  const etiqueta = seccion || (category ? getCategoryName(category) : "Qué Pasa Vallarta");
  if (fondo) return <div className={`qpv-tile qpv-tile-${tono} qpv-tile-fondo`} aria-hidden="true" />;
  return (
    <div className={`qpv-tile qpv-tile-${tono}${pequena ? " qpv-tile-sm" : ""}`} aria-hidden="true">
      {!pequena && <span className="qpv-tile-seccion">{etiqueta}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qpv-tile-logo" src={tono === "ambar" ? "/qpv-logo-azul.png" : "/qpv-logo-blanco.png"} alt="" />
    </div>
  );
}
