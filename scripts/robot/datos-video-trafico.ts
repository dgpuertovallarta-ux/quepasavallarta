/**
 * Arma los datos del video de tráfico con TomTom EN VIVO (2026-11-06), para probar
 * el video con datos reales sin esperar a las 7, 14 o 18 h:
 *   npx tsx scripts/robot/datos-video-trafico.ts > datos.json
 */
import { CORREDORES } from "../../src/lib/trafico/corredores";
import { incidentes, medirCorredor } from "../../src/lib/trafico/tomtom";
import { focosDeTrafico } from "../../src/lib/trafico/videoTrafico";

async function main() {
  const [incs, corr] = await Promise.all([incidentes(), Promise.all(CORREDORES.map((c) => medirCorredor(c).catch(() => null)))]);
  const corredores = corr.filter(Boolean).map((c) => ({ ...c!, origen: CORREDORES.find((x) => x.id === c!.id)?.origen, destino: CORREDORES.find((x) => x.id === c!.id)?.destino }));
  const focos = focosDeTrafico(incs, 3);
  console.error(`incidentes: ${incs.length} · focos: ${focos.map((f) => `${f.tipo} ${f.calle} (${f.linea?.length ?? 0} puntos)`).join(" | ")}`);
  const puntos = incs.filter((i) => ["accidente", "cierre", "obra", "inundacion"].includes(i.tipo)).slice(0, 10).map((i) => ({ tipo: i.tipo, lat: i.lat, lon: i.lon }));
  process.stdout.write(JSON.stringify({ tipo: "resumen", hora: new Date().toISOString(), focos, puntos, corredores }));
}

main().catch((e) => { console.error(e); process.exit(1); });
