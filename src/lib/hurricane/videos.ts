import { getStore } from "@netlify/blobs";
import { getPool, isDatabaseConfigured } from "@/lib/db/client";
import { saveImageBlob } from "@/lib/storage/imageBlobs";
import { postEnIngles } from "@/lib/qpv/traducir";

/**
 * Videos automáticos de ciclones (generados en GitHub Actions con datos del
 * Centro Nacional de Huracanes — ver scripts/hurricane-video/). Aquí se
 * reciben, se guardan en Netlify Blobs y se publican como reel en la
 * página de Facebook con el token que ya usa el sitio.
 *
 *   HURRICANE_VIDEO_PUBLISH=false  → recibe y guarda, pero no publica.
 */
const PARTS_STORE = "hurricane-video-parts";
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type HurricaneVideoRow = {
  key: string;
  status: string;
  videoUrl: string | null;
  fbVideoId: string | null;
  error: string | null;
  caption: string | null;
};

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `create table if not exists hurricane_videos (
           key text primary key,
           created_at timestamptz not null default now(),
           updated_at timestamptz not null default now(),
           status text not null default 'receiving',
           caption text,
           title text,
           video_url text,
           fb_video_id text,
           error text
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null;
        throw err;
      });
  }
  return schemaReady;
}

export function validKey(key: string | null): key is string {
  return !!key && /^[a-z0-9][a-z0-9-]{3,60}$/.test(key);
}

export async function getVideo(key: string): Promise<HurricaneVideoRow | null> {
  if (!isDatabaseConfigured()) return null;
  await ensureSchema();
  const { rows } = await getPool().query(
    "select key, status, video_url, fb_video_id, error, caption from hurricane_videos where key = $1",
    [key]
  );
  const r = rows[0];
  return r ? { key: r.key, status: r.status, videoUrl: r.video_url, fbVideoId: r.fb_video_id, error: r.error, caption: r.caption } : null;
}

async function upsert(key: string, fields: Partial<{ status: string; caption: string; title: string; video_url: string; fb_video_id: string; error: string | null }>) {
  await ensureSchema();
  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  await getPool().query(
    `insert into hurricane_videos (key${cols.map((c) => ", " + c).join("")}) values ($1${cols.map((_, i) => `, $${i + 2}`).join("")})
     on conflict (key) do update set ${sets}${sets ? ", " : ""}updated_at = now()`,
    [key, ...vals]
  );
}

export async function savePart(key: string, part: number, bytes: ArrayBuffer) {
  await getStore(PARTS_STORE).set(`${key}/${String(part).padStart(3, "0")}`, bytes);
  await upsert(key, { status: "receiving" });
}

/** Une las partes, guarda el MP4 público y devuelve su URL. */
export async function assemble(key: string, parts: number, caption: string, title: string): Promise<string> {
  const store = getStore(PARTS_STORE);
  const chunks: Buffer[] = [];
  for (let i = 0; i < parts; i++) {
    const p = await store.get(`${key}/${String(i).padStart(3, "0")}`, { type: "arrayBuffer" });
    if (!p) throw new Error(`Falta la parte ${i}`);
    chunks.push(Buffer.from(p));
  }
  const video = Buffer.concat(chunks);
  if (video.subarray(4, 8).toString("latin1") !== "ftyp") throw new Error("El archivo no es un MP4 válido.");
  const { url } = await saveImageBlob(video, "video/mp4");
  for (let i = 0; i < parts; i++) await store.delete(`${key}/${String(i).padStart(3, "0")}`).catch(() => undefined);
  await upsert(key, { status: "stored", caption: caption.slice(0, 2000), title: title.slice(0, 200), video_url: url, error: null });
  return url;
}

function fbConfig() {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("Falta FB_PAGE_ID o FB_PAGE_ACCESS_TOKEN.");
  return { pageId, token };
}

async function graph(path: string, body: Record<string, string>) {
  const { token } = fbConfig();
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: token }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message || `Graph ${res.status}`);
  return json;
}

/**
 * Publica como reel (upload por URL alojada). Si la página no permite
 * reels por API, cae a video normal en la página.
 */
export async function publishToFacebook(key: string): Promise<{ id: string; kind: "reel" | "video" }> {
  const row = await getVideo(key);
  if (!row?.videoUrl) throw new Error("Video no encontrado.");
  if (row.fbVideoId) return { id: row.fbVideoId, kind: "reel" };
  if (process.env.HURRICANE_VIDEO_PUBLISH === "false") throw new Error("Publicación desactivada (HURRICANE_VIDEO_PUBLISH=false).");
  const { pageId, token } = fbConfig();
  // Texto en español y, debajo, en inglés (2026-10-24).
  const en = row.caption ? await postEnIngles(row.caption.replace(/\s*Fuente: NHC \(Miami\)\.?\s*$/, "")).catch(() => null) : null;
  const { getPatrocinio, contarPublicacion } = await import("@/lib/business/patrocinios");
  const pat = await getPatrocinio("huracanes");
  const description = (row.caption || "") + (en ? `\n\nEN: ${en} Source: NHC (Miami).` : "") + (pat ? `\n\nPresentado por ${pat.nombre}.` : "");
  try {
    const start = await graph(`/${pageId}/video_reels`, { upload_phase: "start" });
    const videoId = String(start.video_id);
    const up = await fetch(`https://rupload.facebook.com/video-upload/${GRAPH_API_VERSION}/${videoId}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, file_url: row.videoUrl },
    });
    const upJson = (await up.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!up.ok || upJson.error) throw new Error(upJson.error?.message || `rupload ${up.status}`);
    await graph(`/${pageId}/video_reels`, { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description });
    await upsert(key, { status: "published", fb_video_id: videoId, error: null });
    if (pat) await contarPublicacion(pat.id, row.caption?.split(":")[0] || key);
    return { id: videoId, kind: "reel" };
  } catch (reelErr) {
    try {
      const res = await fetch(`https://graph-video.facebook.com/${GRAPH_API_VERSION}/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ file_url: row.videoUrl, description, access_token: token }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
      if (!res.ok || !json.id) throw new Error(json.error?.message || `videos ${res.status}`);
      await upsert(key, { status: "published", fb_video_id: json.id, error: `reel: ${(reelErr as Error).message}` });
      if (pat) await contarPublicacion(pat.id, row.caption?.split(":")[0] || key);
      return { id: json.id, kind: "video" };
    } catch (videoErr) {
      const msg = `reel: ${(reelErr as Error).message} · video: ${(videoErr as Error).message}`;
      await upsert(key, { status: "failed", error: msg.slice(0, 1000) });
      throw new Error(msg);
    }
  }
}
