/**
 * Si FB_PAGE_ACCESS_TOKEN es un token de USUARIO (de larga duración), lo cambia por el
 * token de la PÁGINA, que es el que Facebook pide para publicar (2026-10-28).
 * El token de página que sale de uno de usuario de larga duración no vence.
 */
export async function asegurarTokenDePagina(): Promise<"pagina" | "convertido" | "sin-token" | string> {
  const t = process.env.FB_PAGE_ACCESS_TOKEN;
  const pagina = process.env.FB_PAGE_ID;
  if (!t || !pagina) return "sin-token";
  const v = process.env.GRAPH_API_VERSION || "v23.0";
  try {
    const d = (await (await fetch(`https://graph.facebook.com/${v}/debug_token?input_token=${encodeURIComponent(t)}&access_token=${encodeURIComponent(t)}`)).json()) as { data?: { type?: string } };
    if (d.data?.type !== "USER") return "pagina";
    const r = (await (await fetch(`https://graph.facebook.com/${v}/${pagina}?fields=access_token&access_token=${encodeURIComponent(t)}`)).json()) as { access_token?: string; error?: { message?: string } };
    if (!r.access_token) return `no se pudo convertir: ${r.error?.message ?? "sin acceso a la página"}`;
    process.env.FB_PAGE_ACCESS_TOKEN = r.access_token;
    return "convertido";
  } catch (e) {
    return `no se pudo revisar: ${e instanceof Error ? e.message : String(e)}`;
  }
}
