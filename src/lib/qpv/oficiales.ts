/**
 * Instituciones cuya foto se puede usar con crédito (la publican para
 * difundirse). Las fotos de OTROS MEDIOS no se usan — solo se enlaza la nota.
 */
export const FUENTES_OFICIALES: Record<string, string> = {
  "puertovallarta.gob.mx": "Ayuntamiento de Puerto Vallarta",
  "seapal.gob.mx": "SEAPAL Vallarta",
  "fiscalia.jalisco.gob.mx": "Fiscalía del Estado de Jalisco",
  "jalisco.gob.mx": "Gobierno de Jalisco",
  "bahiadebanderas.gob.mx": "Ayuntamiento de Bahía de Banderas",
  "nayarit.gob.mx": "Gobierno de Nayarit",
  "cfe.mx": "CFE",
  "imss.gob.mx": "IMSS",
  "conagua.gob.mx": "Conagua",
  "smn.conagua.gob.mx": "Servicio Meteorológico Nacional",
  "nhc.noaa.gov": "Centro Nacional de Huracanes (NOAA)",
  "gob.mx": "Gobierno de México",
};

export function creditoOficial(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const dom = Object.keys(FUENTES_OFICIALES)
      .sort((a, b) => b.length - a.length)
      .find((d) => host === d || host.endsWith("." + d));
    return dom ? FUENTES_OFICIALES[dom] : null;
  } catch {
    return null;
  }
}
