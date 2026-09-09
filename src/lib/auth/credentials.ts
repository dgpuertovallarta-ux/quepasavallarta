/**
 * Dos cuentas reales, configuradas por variables de entorno
 * (ADMIN_USER_1/ADMIN_PASSWORD_1 y ADMIN_USER_2/ADMIN_PASSWORD_2) — no
 * hay tabla de usuarios en base de datos todavía, pero tampoco es una
 * contraseña inventada en el código: se define fuera del repo, igual
 * que las demás claves (DATABASE_URL, GEMINI_API_KEY).
 */
export function checkCredentials(username: string, password: string): boolean {
  const pairs: Array<[string | undefined, string | undefined]> = [
    [process.env.ADMIN_USER_1, process.env.ADMIN_PASSWORD_1],
    [process.env.ADMIN_USER_2, process.env.ADMIN_PASSWORD_2],
  ];
  return pairs.some(
    ([user, pass]) => !!user && !!pass && user === username && pass === password
  );
}
