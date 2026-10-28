/**
 * Notas en WordPress (HostGator) — 2026-10-27.
 * Mismas funciones que src/lib/db/articles.ts usa el robot, pero contra la API REST
 * de WordPress. articles.ts las llama cuando hay WP_URL (ver wp/cliente.ts).
 */
import type { NewsItem } from "../data";
import { illustrationFor } from "../photos";
import { wp, WpError } from "./cliente";

type WpPost = {
  id: number;
  slug: string;
  status: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  categories: number[];
  meta: Record<string, unknown>;
};

const decod = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const iso = (gmt: string) => (gmt ? `${gmt}Z` : new Date().toISOString());

/* ---------- Categorías (slug ↔ id) ---------- */
let catCache: Map<string, number> | null = null;
async function categorias(): Promise<Map<string, number>> {
  if (catCache) return catCache;
  const xs = (await wp<{ id: number; slug: string }[]>("/wp/v2/categories?per_page=100&_fields=id,slug")) ?? [];
  catCache = new Map(xs.map((c) => [c.slug, c.id]));
  return catCache;
}
async function slugDeCategoria(id?: number): Promise<string> {
  const m = await categorias();
  for (const [s, i] of m) if (i === id) return s;
  return "comunidad";
}

/* ---------- Cuerpo: párrafos ("## ", "• ", "1. ") → HTML ---------- */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function cuerpoAHtml(body: string): string {
  const ps = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < ps.length; ) {
    const p = ps[i];
    if (p.startsWith("## ")) {
      out.push(`<h3>${esc(p.slice(3))}</h3>`);
      i++;
    } else if (p.startsWith("• ")) {
      const li: string[] = [];
      while (i < ps.length && ps[i].startsWith("• ")) li.push(`<li>${esc(ps[i++].slice(2))}</li>`);
      out.push(`<ul>${li.join("")}</ul>`);
    } else if (/^\d{1,2}[.)]\s/.test(p)) {
      const li: string[] = [];
      while (i < ps.length && /^\d{1,2}[.)]\s/.test(ps[i])) li.push(`<li>${esc(ps[i++].replace(/^\d{1,2}[.)]\s+/, ""))}</li>`);
      out.push(`<ol>${li.join("")}</ol>`);
    } else {
      out.push(`<p>${esc(p)}</p>`);
      i++;
    }
  }
  return out.join("\n");
}

/** Explicador: "## QUÉ PASÓ" … → bloques "Qué pasó / Por qué importa / …" del diseño de Vallarta Explica. */
export function explicaAHtml(body: string): string {
  const ps = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const secciones: [string, RegExp][] = [
    ["Qué pasó", /QU[EÉ] (EST[AÁ] )?PAS(Ó|O|ANDO)/i],
    ["Por qué importa", /POR QU[EÉ] IMPORTA/i],
    ["Qué sabemos", /^LO QUE SABEMOS$/i],
    ["Qué no sabemos", /LO QUE NO SABEMOS/i],
    ["Contexto", /^CONTEXTO$/i],
    ["Qué sigue", /QU[EÉ] SIGUE/i],
  ];
  const bloques: string[] = [];
  for (const [etiqueta, re] of secciones) {
    const i = ps.findIndex((p) => p.startsWith("## ") && re.test(p.slice(3)));
    if (i === -1) continue;
    const txt: string[] = [];
    for (let k = i + 1; k < ps.length && !ps[k].startsWith("## "); k++) txt.push(ps[k]);
    if (txt.join("").trim()) bloques.push(`<div class="explica-block"><div class="explica-label">${etiqueta}</div><div class="explica-body">${esc(txt.join(" "))}</div></div>`);
  }
  return bloques.length ? bloques.join("\n") : cuerpoAHtml(body);
}

/** HTML de WordPress → párrafos como los usaba el sitio (para la voz y las tarjetas). */
function htmlAParrafos(html: string): string[] {
  return html
    .replace(/<h[1-6][^>]*>/gi, "\n\n## ")
    .replace(/<li[^>]*>/gi, "\n\n• ")
    .replace(/<\/(p|h[1-6]|li|div)>/gi, "\n\n")
    .split(/\n{2,}/)
    .map(decod)
    .filter((x) => x && x !== "##" && x !== "•");
}

async function aNota(p: WpPost): Promise<NewsItem> {
  const category = await slugDeCategoria(p.categories?.[0]);
  const m = p.meta ?? {};
  let fuentes: { label: string; url: string }[] = [];
  try {
    fuentes = JSON.parse(String(m.qpv_sources || "[]"));
  } catch {
    /* sin fuentes */
  }
  const score = Number(m.qpv_score) || 50;
  return {
    slug: p.slug,
    title: decod(p.title.raw ?? p.title.rendered),
    dek: decod(p.excerpt.raw ?? p.excerpt.rendered),
    category,
    zone: (m.qpv_zone as string) || null,
    author: (m.qpv_author as string) || "redaccion",
    score,
    breaking: !!m.qpv_breaking || score >= 90,
    verified: m.qpv_verified !== false,
    publishedAt: iso(p.date_gmt),
    updatedAt: iso(p.modified_gmt),
    media: "ocean",
    image: illustrationFor(category, p.slug),
    imageUrl: (m.qpv_image_url as string) || undefined,
    imageCredit: (m.qpv_image_credit as string) || undefined,
    sources: Array.isArray(fuentes) ? fuentes : [],
    body: htmlAParrafos(p.content.raw ?? p.content.rendered),
  };
}

const CAMPOS = "id,slug,status,date_gmt,modified_gmt,title,excerpt,content,categories,meta";

export async function publicadas(limite = 30, extra = ""): Promise<NewsItem[]> {
  const xs = (await wp<WpPost[]>(`/wp/v2/posts?status=publish&per_page=${Math.min(limite, 100)}&orderby=date&order=desc&context=edit&_fields=${CAMPOS}${extra}`)) ?? [];
  return Promise.all(xs.map(aNota));
}

export async function porCategoria(slug: string, limite = 30): Promise<NewsItem[]> {
  const id = (await categorias()).get(slug);
  if (!id) return [];
  return publicadas(limite, `&categories=${id}`);
}

export async function porSlug(slug: string): Promise<NewsItem | null> {
  const xs = (await wp<WpPost[]>(`/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=publish&context=edit&_fields=${CAMPOS}`)) ?? [];
  return xs[0] ? aNota(xs[0]) : null;
}

/** Títulos de lo publicado o pendiente en los últimos días (para no repetir notas). */
export async function titulosRecientes(dias = 3, explicador = false): Promise<{ slug: string; title: string; excerpt: string | null; fecha: string }[]> {
  const tipo = explicador ? "explica" : "posts";
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const xs = (await wp<WpPost[]>(`/wp/v2/${tipo}?status=publish,pending,draft&after=${desde}&per_page=100&context=edit&_fields=id,slug,date_gmt,title,excerpt`)) ?? [];
  return xs.map((p) => ({ slug: p.slug || String(p.id), title: decod(p.title.raw ?? p.title.rendered), excerpt: decod(p.excerpt.raw ?? p.excerpt.rendered) || null, fecha: iso(p.date_gmt) }));
}

export async function hayNotaDeHistoria(clave: string, explicador = false): Promise<boolean> {
  const tipo = explicador ? "explica" : "posts";
  const xs = (await wp<{ id: number }[]>(`/wp/v2/${tipo}?status=publish,pending,draft,private&qpv_story_key=${encodeURIComponent(clave)}&_fields=id&per_page=1`)) ?? [];
  return xs.length > 0;
}

export async function ultimoExplicador(): Promise<Date | null> {
  const xs = (await wp<{ date_gmt: string }[]>(`/wp/v2/explica?status=publish&per_page=1&orderby=date&order=desc&_fields=date_gmt`)) ?? [];
  return xs[0] ? new Date(iso(xs[0].date_gmt)) : null;
}

export type NuevaNota = {
  title: string;
  excerpt: string;
  body: string;
  categorySlug: string;
  newsScore: number;
  storyExternalKey: string | null;
  imageUrl?: string;
  imageCredit?: string;
  imageSourceUrl?: string;
  isExplainer?: boolean;
  status?: "published" | "pending_review";
  fuentes?: { label: string; url: string }[];
  autor?: "redaccion" | "ia";
};

/** Crea la nota en WordPress. Devuelve su slug (WordPress lo arma del título). */
export async function crear(n: NuevaNota): Promise<{ slug: string; id: number }> {
  const catId = (await categorias()).get(n.categorySlug) ?? (await categorias()).get("comunidad");
  const meta: Record<string, unknown> = {
    qpv_score: n.newsScore,
    qpv_breaking: n.newsScore >= 90,
    qpv_verified: true,
    qpv_author: n.autor ?? "ia",
    qpv_sources: JSON.stringify(n.fuentes ?? []),
  };
  if (n.storyExternalKey) meta.qpv_story_key = n.storyExternalKey;
  if (n.imageUrl) {
    meta.qpv_image_url = n.imageUrl;
    meta.qpv_image_credit = n.imageCredit ?? "";
  }
  const r = await wp<{ id: number; slug: string; generated_slug?: string }>(`/wp/v2/${n.isExplainer ? "explica" : "posts"}`, {
    method: "POST",
    json: {
      title: n.title,
      excerpt: n.excerpt,
      content: n.isExplainer ? explicaAHtml(n.body) : cuerpoAHtml(n.body),
      status: n.status === "pending_review" ? "pending" : "publish",
      categories: catId ? [catId] : [],
      meta,
    },
  });
  return { id: r.id, slug: r.slug || r.generated_slug || String(r.id) };
}

/** Avisos de tránsito publicados en las últimas horas (para el resumen vial). */
export async function avisosTransito(horas: number): Promise<{ titulo: string; fecha: string }[]> {
  const id = (await categorias()).get("transito");
  if (!id) return [];
  const desde = new Date(Date.now() - horas * 3_600_000).toISOString();
  const xs = (await wp<WpPost[]>(`/wp/v2/posts?status=publish&categories=${id}&after=${desde}&per_page=3&_fields=date_gmt,title`)) ?? [];
  return xs.map((p) => ({ titulo: decod(p.title.rendered), fecha: iso(p.date_gmt) }));
}

export { WpError };
