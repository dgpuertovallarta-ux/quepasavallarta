import { getActiveAd, type AdSlotId } from "@/lib/business/db";

/**
 * Banner de un anunciante, administrado desde el panel → Comercial.
 * Sin banner vigente no muestra nada (o el `fallback` que se le pase).
 * El clic pasa por /api/ad/[id] para contarlo.
 */
export default async function AdSlot({ slot, fallback = null }: { slot: AdSlotId; fallback?: React.ReactNode }) {
  const ad = await getActiveAd(slot);
  if (!ad) return <>{fallback}</>;
  return (
    <aside className={`ad-band ad-slot-${slot}`} aria-label="Publicidad">
      <div className="container">
        <div className="ad-label">Publicidad</div>
        <a href={`/api/ad/${ad.id}`} rel="sponsored noopener" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={`Publicidad: ${ad.advertiser}`} loading="lazy" />
        </a>
      </div>
    </aside>
  );
}
