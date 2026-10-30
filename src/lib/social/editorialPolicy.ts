/** La regla pedida por el propietario: el contenido del huracán Simón no se envía a Facebook/Instagram. */
// 2026-10-29: el propietario pidió dejar de publicar todo lo de huracanes (no solo Simón).
export function isHurricaneSimonContent(text: string): boolean {
  return esContenidoDeHuracan(text);
}

export function esContenidoDeHuracan(text: string): boolean {
  return /\bhurac[aá]n|\bcicl[oó]n|\btormenta\s+tropical|\bdepresi[oó]n\s+tropical|\bonda\s+tropical|\bcentro nacional de huracanes|\bnhc\b/i.test(text);
}
