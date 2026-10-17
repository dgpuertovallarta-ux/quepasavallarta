import crypto from "node:crypto";

/**
 * Verifica que una petición viene del flujo de GitHub Actions de ESTE
 * repositorio usando el token OIDC que GitHub firma (no hay contraseñas ni
 * llaves compartidas que guardar). Ver .github/workflows/hurricane-video.yml.
 */
const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
export const OIDC_AUDIENCE = "quepasavta-hurricane";
const REPO = process.env.HURRICANE_VIDEO_REPO || "dgpuertovallarta-ux/quepasavallarta";

type Jwk = crypto.JsonWebKey & { kid?: string };
let jwksCache: { at: number; keys: Jwk[] } | null = null;

async function jwks(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), keys: body.keys };
  return body.keys;
}

function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export async function verifyGithubOidc(authHeader: string | null): Promise<{ ok: true; claims: Record<string, unknown> } | { ok: false; error: string }> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, error: "Falta el token." };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Token mal formado." };
  try {
    const header = JSON.parse(b64url(parts[0]).toString("utf8")) as { kid?: string; alg?: string };
    const claims = JSON.parse(b64url(parts[1]).toString("utf8")) as Record<string, unknown>;
    if (header.alg !== "RS256") return { ok: false, error: "Algoritmo no permitido." };
    let keys = await jwks();
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      jwksCache = null;
      keys = await jwks();
      jwk = keys.find((k) => k.kid === header.kid);
    }
    if (!jwk) return { ok: false, error: "Llave desconocida." };
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const valid = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, b64url(parts[2]));
    if (!valid) return { ok: false, error: "Firma inválida." };
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== ISSUER) return { ok: false, error: "Emisor inválido." };
    const aud = claims.aud;
    if (!(aud === OIDC_AUDIENCE || (Array.isArray(aud) && aud.includes(OIDC_AUDIENCE)))) return { ok: false, error: "Audiencia inválida." };
    if (typeof claims.exp !== "number" || claims.exp < now - 30) return { ok: false, error: "Token vencido." };
    if (claims.repository !== REPO) return { ok: false, error: "Repositorio no autorizado." };
    if (claims.ref !== "refs/heads/main") return { ok: false, error: "Rama no autorizada." };
    return { ok: true, claims };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Token inválido." };
  }
}
