import { notFound } from "next/navigation";
import { getAllAds, vistasDelMes } from "@/lib/business/db";
import { publicacionesDelMes, mesActual, RUTAS_SECCION, type SeccionPatrocinio } from "@/lib/business/patrocinios";
import ImprimirBoton from "./ImprimirBoton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reporte de patrocinio — Qué Pasa Vallarta", robots: { index: false, follow: false } };

const SECCIONES: Record<string, { s: SeccionPatrocinio; t: string; donde: string }> = {
  "pat-trafico": { s: "trafico", t: "QPV al Volante (tráfico)", donde: "Página de tráfico en vivo y resúmenes viales de las 8 a. m., 2 p. m. y 6 p. m. en Facebook" },
  "pat-huracanes": { s: "huracanes", t: "Videos de huracán", donde: "Cierre de cada video automático de huracán en Facebook (uno por boletín del Centro Nacional de Huracanes)" },
  "pat-clima": { s: "clima", t: "Clima", donde: "Sección de clima del sitio y notas de clima publicadas en Facebook" },
  "pat-reportes": { s: "reportes", t: "Reporte Ciudadano", donde: "Página de Reporte Ciudadano y reportes publicados en Facebook" },
};

function nombreMes(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 15).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export default async function ReportePatrocinio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const { mes } = await searchParams;
  const ad = (await getAllAds()).find((a) => a.id === Number(id));
  if (!ad || !ad.slot.startsWith("pat-")) notFound();
  const sec = SECCIONES[ad.slot];
  const m = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : mesActual();
  const [pubs, vistas] = await Promise.all([publicacionesDelMes(ad.id, m), m === mesActual() ? vistasDelMes(RUTAS_SECCION[sec.s]) : Promise.resolve(0)]);

  return (
    <div className="container section" style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-transparent.png" alt="Qué Pasa Vallarta" style={{ height: 70 }} />
        <ImprimirBoton />
      </div>
      <h1 style={{ margin: "18px 0 4px" }}>Reporte de patrocinio</h1>
      <p style={{ color: "var(--text-muted)", margin: 0 }}>
        {ad.advertiser} · «Presentado por» {sec.t} · {nombreMes(m)}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 18, margin: "22px 0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ad.imageUrl} alt={ad.advertiser} style={{ height: 70, maxWidth: 240, objectFit: "contain", background: "#fff", borderRadius: 10, padding: 8 }} />
        <p style={{ margin: 0, fontSize: 14 }}>
          <b>Dónde aparece:</b> {sec.donde}.
        </p>
      </div>
      <div className="stat-row">
        <div className="stat-tile"><div className="n">{pubs.n}</div><div className="l">Publicaciones en Facebook con tu marca</div></div>
        {sec.s !== "huracanes" && <div className="stat-tile"><div className="n">{vistas}</div><div className="l">Visitas a la sección en el sitio</div></div>}
        <div className="stat-tile"><div className="n">{ad.clicks}</div><div className="l">Clics hacia tu negocio (total)</div></div>
      </div>
      {pubs.ultimas.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <strong style={{ fontSize: 13 }}>Publicaciones del mes</strong>
          <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
            {pubs.ultimas.map((p, i) => (
              <li key={i}>
                {new Date(p.en).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {p.t}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 18 }}>
        Qué Pasa Vallarta · quepasavta.com · Ventas: 322 395 1186. Las visitas se cuentan con el contador propio del sitio; las
        publicaciones son las que salieron en nuestra página de Facebook con el sello «Presentado por».
      </p>
    </div>
  );
}
