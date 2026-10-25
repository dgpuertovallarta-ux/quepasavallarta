import { getPatrocinio, type SeccionPatrocinio } from "@/lib/business/patrocinios";

/** Franja "Presentado por [logo]" del patrocinador de la sección (si hay). */
export default async function PresentadoPor({ seccion }: { seccion: SeccionPatrocinio }) {
  const p = await getPatrocinio(seccion);
  if (!p) return null;
  return (
    <a className="presentado-por" href={p.clic} target="_blank" rel="sponsored noopener" aria-label={`Presentado por ${p.nombre}`}>
      <span>Presentado por</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.logo} alt={p.nombre} loading="lazy" />
    </a>
  );
}
