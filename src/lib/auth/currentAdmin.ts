import { cookies } from "next/headers";
import { getAdminIdentity } from "./credentials";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./session";

/** Administrador con sesión válida en esta petición, o null. */
export async function currentAdmin() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  return session ? getAdminIdentity(session.username) : null;
}
