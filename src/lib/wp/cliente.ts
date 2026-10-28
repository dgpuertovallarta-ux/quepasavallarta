/**
 * Conexión del "robot" (GitHub Actions) con el sitio en WordPress (HostGator), 2026-10-27.
 *
 * Variables (secretos de GitHub, nunca en el código):
 *   WP_URL           https://quepasavta.com
 *   WP_USER          usuario de WordPress con permiso de Editor o Administrador
 *   WP_APP_PASSWORD  "contraseña de aplicación" creada en Usuarios → Perfil
 */
export function usaWordPress(): boolean {
  return !!(process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD);
}

export function wpBase(): string {
  return (process.env.WP_URL || "").replace(/\/$/, "");
}

function auth(): string {
  const pass = (process.env.WP_APP_PASSWORD || "").replace(/\s+/g, "");
  return "Basic " + Buffer.from(`${process.env.WP_USER}:${pass}`).toString("base64");
}

export class WpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

/** Llama a la API REST de WordPress (ruta relativa a /wp-json). */
export async function wp<T = unknown>(ruta: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", auth());
  headers.set("User-Agent", "QPV-Robot/1.0");
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let ultimo: unknown;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(`${wpBase()}/wp-json${ruta}`, { ...init, headers, body, signal: AbortSignal.timeout(60_000) });
      if (r.status === 404 && (init.method ?? "GET") === "GET") return null as T;
      const texto = await r.text();
      if (!r.ok) {
        if (r.status >= 500 && intento < 2) throw new WpError(r.status, texto.slice(0, 300));
        throw new WpError(r.status, `WordPress ${r.status} en ${ruta}: ${texto.slice(0, 300)}`);
      }
      return (texto ? JSON.parse(texto) : null) as T;
    } catch (err) {
      ultimo = err;
      if (err instanceof WpError && err.status < 500) throw err;
      await new Promise((res) => setTimeout(res, 1500 * (intento + 1)));
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

/** Sube un archivo a la biblioteca de medios y devuelve su URL pública. */
export async function subirMedio(bytes: Buffer, tipo: string, nombre: string): Promise<{ id: number; url: string }> {
  const r = await wp<{ id: number; source_url: string }>("/wp/v2/media", {
    method: "POST",
    headers: { "Content-Type": tipo, "Content-Disposition": `attachment; filename="${nombre}"` },
    body: new Uint8Array(bytes),
  });
  return { id: r.id, url: r.source_url };
}
