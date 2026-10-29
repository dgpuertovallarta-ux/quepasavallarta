/**
 * Robot de Qué Pasa Vallarta (GitHub Actions → WordPress en HostGator), 2026-10-27.
 *
 * Hace lo mismo que antes hacían las funciones programadas de Netlify:
 *   - Ingesta: lee las fuentes, redacta con IA y publica (o deja pendiente) en WordPress.
 *   - Cola de Facebook (hasta 12 al día, tráfico a las 8, 14 y 18 h).
 *   - Monitor de tráfico cada 20 minutos (TomTom) para /trafico.
 *   - Reels de la página de Facebook para la portada (cada hora).
 *
 * Uso:  npx tsx scripts/robot/robot.ts ciclo        (una vuelta completa)
 *       npx tsx scripts/robot/robot.ts vigilar 340  (repite cada 10 min durante N minutos)
 *       npx tsx scripts/robot/robot.ts estado       (prueba la conexión con WordPress)
 *
 * Variables (secretos de GitHub): WP_URL, WP_USER, WP_APP_PASSWORD, GEMINI_API_KEY,
 * FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN, TOMTOM_API_KEY y, opcional, ELEVENLABS_*.
 */
import { SOURCES } from "../../src/lib/ingest/sources";
import { fetchSource } from "../../src/lib/ingest/fetchSource";
import { buildStoryGraph } from "../../src/lib/ingest/storyGraph";
import { runAutoPublish } from "../../src/lib/ingest/autoPublish";
import { runExplicaPublish } from "../../src/lib/ingest/explicaPublish";
import { procesarColaRedes } from "../../src/lib/qpv/colaRedes";
import { correrMonitor } from "../../src/lib/trafico/monitor";
import { getPageReels } from "../../src/lib/social/reels";
import { audioDeLaUltimaNota } from "../../src/lib/qpv/voz";
import { usaWordPress, wp } from "../../src/lib/wp/cliente";
import { getStore } from "../../src/lib/storage/blobs";
import type { IngestedItem } from "../../src/lib/ingest/types";

const hora = () => new Date().toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour12: false });
const log = (...a: unknown[]) => {
  const txt = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(`[${hora()}]`, txt);
  // También como aviso de GitHub (se ve en el resumen de la corrida y por la API, sin abrir los registros).
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=${hora()}::${txt.replace(/\r?\n/g, " ").slice(0, 900)}`);
};

async function ingesta() {
  const inicio = Date.now();
  const res = await Promise.all(
    SOURCES.map(async (s) => {
      if (!s.verified) return { id: s.id, ok: false, items: [] as IngestedItem[] };
      try {
        return { id: s.id, ok: true, items: await fetchSource(s) };
      } catch (e) {
        return { id: s.id, ok: false, items: [] as IngestedItem[], error: e instanceof Error ? e.message : String(e) };
      }
    })
  );
  const historias = buildStoryGraph(res.flatMap((r) => r.items));
  // Sin el límite de 60 s de Netlify: hay más tiempo para cada intento.
  const hasta = inicio + 120_000;
  const explicadorPrimero = new Date(inicio).getUTCMinutes() < 10;
  let nota, explica;
  if (explicadorPrimero) {
    explica = await runExplicaPublish(historias, { startBefore: hasta });
    nota = await runAutoPublish(historias, { attemptsUntil: hasta, startBefore: explica.ran && explica.queuedForReview ? inicio : hasta });
  } else {
    nota = await runAutoPublish(historias, { attemptsUntil: hasta });
    explica = await runExplicaPublish(historias, { startBefore: nota.queuedForReview + nota.autoPublished > 0 ? inicio : hasta });
  }
  log("ingesta:", JSON.stringify({ fuentesOk: res.filter((r) => r.ok).length, historias: historias.length, publicadas: nota.autoPublished, pendientes: nota.queuedForReview, explica: explica.ran && explica.queuedForReview, errores: res.filter((r) => "error" in r && r.error).map((r) => r.id) }));
}

/** Corre una tarea solo si ya pasó su intervalo (la última vez se guarda en WordPress). */
async function cadaTanto(nombre: string, minutos: number, tarea: () => Promise<unknown>) {
  const s = getStore({ name: "qpv-robot", consistency: "strong" });
  const ultima = (await s.get("ultima/" + nombre, { type: "json" }).catch(() => null)) as { en: number } | null;
  if (ultima && Date.now() - ultima.en < minutos * 60_000 - 30_000) return;
  await s.setJSON("ultima/" + nombre, { en: Date.now() });
  try {
    const r = await tarea();
    log(`${nombre}:`, typeof r === "string" ? r : JSON.stringify(r ?? "ok").slice(0, 400));
  } catch (e) {
    log(`${nombre} falló:`, e instanceof Error ? e.message : e);
  }
}

async function ciclo() {
  const pasos: [string, () => Promise<unknown>][] = [
    ["ingesta", ingesta],
    ["cola de Facebook", async () => log("facebook:", JSON.stringify(await procesarColaRedes()).slice(0, 400))],
  ];
  for (const [n, f] of pasos) {
    try {
      await f();
    } catch (e) {
      log(`${n} falló:`, e instanceof Error ? e.stack || e.message : e);
    }
  }
  await cadaTanto("trafico", 20, correrMonitor);
  await cadaTanto("reels", 60, async () => {
    const reels = await getPageReels(20);
    if (reels.length) await wp("/qpv/v1/reels", { method: "PUT", json: reels });
    return `${reels.length} reels`;
  });
  await cadaTanto("audio", 10, audioDeLaUltimaNota);
}

// Errores internos (p. ej. "[colaRedes] Facebook falló: …") también como aviso visible en GitHub.
if (process.env.GITHUB_ACTIONS) {
  const original = console.error.bind(console);
  console.error = (...a: unknown[]) => {
    original(...a);
    const txt = a.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x))).join(" ");
    console.log(`::warning title=${hora()}::${txt.replace(/\r?\n/g, " ").slice(0, 900)}`);
  };
}

/** Revisa el token de Facebook sin publicar nada. */
async function pruebaFacebook() {
  const v = process.env.GRAPH_API_VERSION || "v23.0";
  const t = process.env.FB_PAGE_ACCESS_TOKEN || "";
  const r = await fetch(`https://graph.facebook.com/${v}/${process.env.FB_PAGE_ID}?fields=name&access_token=${encodeURIComponent(t)}`);
  log("facebook página:", r.status, JSON.stringify(await r.json()).replace(/"access_token":"[^"]+"/g, "").slice(0, 300));
  const d = await fetch(`https://graph.facebook.com/${v}/debug_token?input_token=${encodeURIComponent(t)}&access_token=${encodeURIComponent(t)}`);
  const j = (await d.json()) as { data?: { type?: string; is_valid?: boolean; expires_at?: number; scopes?: string[]; error?: { message?: string } } };
  log("facebook token:", JSON.stringify({ tipo: j.data?.type, valido: j.data?.is_valid, vence: j.data?.expires_at ? new Date(j.data.expires_at * 1000).toISOString() : "nunca", permisos: j.data?.scopes, error: j.data?.error?.message }));
}

async function main() {
  const [orden = "ciclo", arg] = process.argv.slice(2);
  if (!usaWordPress()) throw new Error("Faltan WP_URL, WP_USER o WP_APP_PASSWORD (secretos del repositorio en GitHub).");
  if (orden === "estado") {
    const faltan = ["GEMINI_API_KEY", "FB_PAGE_ID", "FB_PAGE_ACCESS_TOKEN", "TOMTOM_API_KEY"].filter((k) => !process.env[k]);
    log(faltan.length ? `Faltan llaves en GitHub: ${faltan.join(", ")}` : "Todas las llaves están puestas.");
    if (process.env.FB_PAGE_ACCESS_TOKEN) await pruebaFacebook().catch((e) => log("prueba de Facebook falló:", String(e)));
    log(JSON.stringify(await wp("/qpv/v1/estado")));
    return;
  }
  if (orden === "vigilar") {
    const fin = Date.now() + Number(arg || 340) * 60_000;
    while (Date.now() < fin) {
      const t0 = Date.now();
      await ciclo().catch((e) => log("ciclo falló:", e));
      const espera = Math.max(30_000, 10 * 60_000 - (Date.now() - t0));
      if (Date.now() + espera > fin) break;
      await new Promise((r) => setTimeout(r, espera));
    }
    return;
  }
  await ciclo();
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
