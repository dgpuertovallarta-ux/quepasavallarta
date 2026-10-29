/**
 * Videos de ciclón con el sitio en WordPress (2026-10-27).
 *   npx tsx scripts/robot/huracan.ts existe <key>      → imprime {"exists":true|false}
 *   npx tsx scripts/robot/huracan.ts publicar <dir>    → sube out/video.mp4 a WordPress y lo publica como reel en Facebook
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVideo, guardarVideo, publishToFacebook, validKey } from "../../src/lib/hurricane/videos";
import { asegurarTokenDePagina } from "../../src/lib/social/tokenPagina";

async function main() {
  const [orden, arg] = process.argv.slice(2);
  if (orden === "existe") {
    if (!validKey(arg ?? null)) throw new Error("key inválida");
    const v = await getVideo(arg!);
    console.log(JSON.stringify({ exists: !!v, status: v?.status ?? null, published: v?.status === "published" }));
    return;
  }
  if (orden === "publicar") {
    console.log("token de Facebook:", await asegurarTokenDePagina());
    const dir = arg || "out";
    const story = JSON.parse(await readFile(path.join(dir, "story.json"), "utf8")) as { key: string; caption: string; title: string };
    const existente = await getVideo(story.key);
    if (!existente?.videoUrl) await guardarVideo(story.key, await readFile(path.join(dir, "video.mp4")), story.caption || "", story.title || "");
    if (process.env.HURRICANE_VIDEO_PUBLISH === "false") return console.log("guardado (publicación desactivada)");
    console.log(JSON.stringify(await publishToFacebook(story.key)));
    return;
  }
  throw new Error("Uso: huracan.ts existe <key> | publicar <dir>");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
