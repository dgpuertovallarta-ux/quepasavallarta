/** La regla pedida por el propietario: el contenido del huracán Simón no se envía a Facebook/Instagram. */
export function isHurricaneSimonContent(text: string): boolean {
  const mentionsSimon = /\bsim[oó]n\b/i.test(text);
  const mentionsCyclone = /\bhurac[aá]n\b|\bcicl[oó]n\b|\btormenta\s+tropical\b/i.test(text);
  return mentionsSimon && mentionsCyclone;
}
