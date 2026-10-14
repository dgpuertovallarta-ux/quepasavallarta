import { getPool, isDatabaseConfigured } from "../db/client";

/**
 * Tablas del área comercial: visitas, solicitudes de anunciantes,
 * banners y notas patrocinadas. Se crean solas la primera vez que se
 * usan ("create table if not exists"), así no hace falta aplicar una
 * migración a mano. Ninguna función de este archivo rompe una página:
 * si la base falla, devuelven vacío.
 */

let schemaReady: Promise<void> | null = null;

export function ensureBusinessSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `create table if not exists site_page_views (
           day date not null,
           path text not null,
           views integer not null default 0,
           primary key (day, path)
         );
         create table if not exists site_visitors (
           day date not null,
           vid text not null,
           primary key (day, vid)
         );
         create table if not exists site_leads (
           id bigserial primary key,
           created_at timestamptz not null default now(),
           business text not null,
           contact text not null,
           message text,
           page text
         );
         create table if not exists site_ads (
           id bigserial primary key,
           created_at timestamptz not null default now(),
           advertiser text not null,
           slot text not null,
           image_url text not null,
           link_url text not null,
           ends_at date,
           active boolean not null default true,
           clicks integer not null default 0
         );
         create index if not exists idx_site_ads_slot on site_ads (slot) where active;
         create table if not exists site_sponsored (
           slug text primary key,
           sponsor text not null,
           created_at timestamptz not null default now()
         );`,
      )
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // se vuelve a intentar en la siguiente llamada
        throw err;
      });
  }
  return schemaReady;
}

const TODAY_MX = "(now() at time zone 'America/Mexico_City')::date";

async function ready(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    await ensureBusinessSchema();
    return true;
  } catch (err) {
    console.error(
      "[business] no se pudo preparar la base:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

// ---------------------------------------------------------------- visitas

export async function recordPageView(
  path: string,
  vid: string | null,
): Promise<void> {
  if (!(await ready())) return;
  const pool = getPool();
  await pool.query(
    `insert into site_page_views (day, path, views) values (${TODAY_MX}, $1, 1)
     on conflict (day, path) do update set views = site_page_views.views + 1`,
    [path.slice(0, 300)],
  );
  if (vid) {
    await pool.query(
      `insert into site_visitors (day, vid) values (${TODAY_MX}, $1) on conflict do nothing`,
      [vid.slice(0, 64)],
    );
  }
}

export type DailyStat = { day: string; views: number; visitors: number };
export type PageStat = { path: string; views: number };

export async function getSiteStats(days = 30): Promise<{
  daily: DailyStat[];
  topPages: PageStat[];
  totals: {
    views: number;
    visitors: number;
    today: number;
    todayVisitors: number;
  };
}> {
  const empty = {
    daily: [],
    topPages: [],
    totals: { views: 0, visitors: 0, today: 0, todayVisitors: 0 },
  };
  if (!(await ready())) return empty;
  try {
    const pool = getPool();
    const since = `${TODAY_MX} - $1::int + 1`;
    // Consultas en serie: son baratas y así no se ocupan varias conexiones a la vez.
    const daily = await pool.query<{
      day: string;
      views: string;
      visitors: string;
    }>(
      `select d.day::text as day,
                coalesce((select sum(views) from site_page_views v where v.day = d.day), 0) as views,
                coalesce((select count(*) from site_visitors s where s.day = d.day), 0) as visitors
           from generate_series(${since}, ${TODAY_MX}, interval '1 day') as d(day)
          order by d.day`,
      [days],
    );
    const top = await pool.query<{ path: string; views: string }>(
      `select path, sum(views) as views from site_page_views where day >= ${since}
          group by path order by sum(views) desc limit 15`,
      [days],
    );
    const totalVisitors = await pool.query<{ n: string }>(
      `select count(distinct vid) as n from site_visitors where day >= ${since}`,
      [days],
    );
    const rows = daily.rows.map((r) => ({
      day: r.day.slice(0, 10),
      views: Number(r.views),
      visitors: Number(r.visitors),
    }));
    const last = rows.at(-1);
    return {
      daily: rows,
      topPages: top.rows.map((r) => ({ path: r.path, views: Number(r.views) })),
      totals: {
        views: rows.reduce((a, r) => a + r.views, 0),
        visitors: Number(totalVisitors.rows[0]?.n || 0),
        today: last?.views || 0,
        todayVisitors: last?.visitors || 0,
      },
    };
  } catch (err) {
    console.error(
      "[business] estadísticas:",
      err instanceof Error ? err.message : err,
    );
    return empty;
  }
}

// ------------------------------------------------------------ solicitudes

export type Lead = {
  id: number;
  createdAt: string;
  business: string;
  contact: string;
  message: string | null;
  page: string | null;
};

export async function saveLead(input: {
  business: string;
  contact: string;
  message?: string;
  page?: string;
}): Promise<boolean> {
  if (!(await ready())) return false;
  await getPool().query(
    `insert into site_leads (business, contact, message, page) values ($1, $2, $3, $4)`,
    [
      input.business.slice(0, 160),
      input.contact.slice(0, 160),
      input.message ? input.message.slice(0, 2000) : null,
      input.page ? input.page.slice(0, 300) : null,
    ],
  );
  return true;
}

export async function getLeads(limit = 100): Promise<Lead[]> {
  if (!(await ready())) return [];
  try {
    const res = await getPool().query<{
      id: string;
      created_at: Date;
      business: string;
      contact: string;
      message: string | null;
      page: string | null;
    }>(
      `select id, created_at, business, contact, message, page from site_leads order by created_at desc limit $1`,
      [limit],
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      createdAt: r.created_at.toISOString(),
      business: r.business,
      contact: r.contact,
      message: r.message,
      page: r.page,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- banners

/** Lugares donde puede ir un banner. Protección Civil nunca lleva anuncios. */
export const AD_SLOTS = [
  { id: "home", label: "Portada (franja ancha)" },
  { id: "article", label: "Dentro de las notas" },
  { id: "section", label: "Secciones (arriba de la lista)" },
] as const;
export type AdSlotId = (typeof AD_SLOTS)[number]["id"];

export type Ad = {
  id: number;
  advertiser: string;
  slot: string;
  imageUrl: string;
  linkUrl: string;
  endsAt: string | null;
  active: boolean;
  clicks: number;
  createdAt: string;
};

type AdRow = {
  id: string;
  advertiser: string;
  slot: string;
  image_url: string;
  link_url: string;
  ends_at: Date | null;
  active: boolean;
  clicks: number;
  created_at: Date;
};

function mapAd(r: AdRow): Ad {
  return {
    id: Number(r.id),
    advertiser: r.advertiser,
    slot: r.slot,
    imageUrl: r.image_url,
    linkUrl: r.link_url,
    endsAt: r.ends_at ? new Date(r.ends_at).toISOString().slice(0, 10) : null,
    active: r.active,
    clicks: r.clicks,
    createdAt: r.created_at.toISOString(),
  };
}

/** Un banner vigente para ese lugar (si hay varios, se reparten al azar). */
export async function getActiveAd(slot: AdSlotId): Promise<Ad | null> {
  if (!(await ready())) return null;
  try {
    const res = await getPool().query<AdRow>(
      `select * from site_ads where slot = $1 and active and (ends_at is null or ends_at >= ${TODAY_MX})
        order by random() limit 1`,
      [slot],
    );
    return res.rows[0] ? mapAd(res.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getAllAds(): Promise<Ad[]> {
  if (!(await ready())) return [];
  try {
    const res = await getPool().query<AdRow>(
      `select * from site_ads order by active desc, created_at desc limit 200`,
    );
    return res.rows.map(mapAd);
  } catch {
    return [];
  }
}

export async function createAd(input: {
  advertiser: string;
  slot: AdSlotId;
  imageUrl: string;
  linkUrl: string;
  endsAt: string | null;
}): Promise<number> {
  if (!(await ready())) throw new Error("La base de datos no está disponible.");
  const res = await getPool().query<{ id: string }>(
    `insert into site_ads (advertiser, slot, image_url, link_url, ends_at) values ($1, $2, $3, $4, $5) returning id`,
    [
      input.advertiser.slice(0, 120),
      input.slot,
      input.imageUrl,
      input.linkUrl,
      input.endsAt,
    ],
  );
  return Number(res.rows[0].id);
}

export async function setAdActive(id: number, active: boolean): Promise<void> {
  if (!(await ready())) throw new Error("La base de datos no está disponible.");
  await getPool().query(`update site_ads set active = $2 where id = $1`, [
    id,
    active,
  ]);
}

/** Cuenta el clic y devuelve a dónde mandar a la persona (null si el banner no existe). */
export async function registerAdClick(id: number): Promise<string | null> {
  if (!(await ready())) return null;
  const res = await getPool().query<{ link_url: string }>(
    `update site_ads set clicks = clicks + 1 where id = $1 returning link_url`,
    [id],
  );
  return res.rows[0]?.link_url || null;
}

// ------------------------------------------------------ notas patrocinadas

export async function getSponsoredMap(): Promise<Map<string, string>> {
  if (!(await ready())) return new Map();
  try {
    const res = await getPool().query<{ slug: string; sponsor: string }>(
      `select slug, sponsor from site_sponsored`,
    );
    return new Map(res.rows.map((r) => [r.slug, r.sponsor]));
  } catch {
    return new Map();
  }
}

export async function getSponsor(slug: string): Promise<string | null> {
  if (!(await ready())) return null;
  try {
    const res = await getPool().query<{ sponsor: string }>(
      `select sponsor from site_sponsored where slug = $1`,
      [slug],
    );
    return res.rows[0]?.sponsor || null;
  } catch {
    return null;
  }
}

export async function setSponsored(
  slug: string,
  sponsor: string | null,
): Promise<void> {
  if (!(await ready())) throw new Error("La base de datos no está disponible.");
  if (sponsor) {
    await getPool().query(
      `insert into site_sponsored (slug, sponsor) values ($1, $2) on conflict (slug) do update set sponsor = excluded.sponsor`,
      [slug, sponsor.slice(0, 120)],
    );
  } else {
    await getPool().query(`delete from site_sponsored where slug = $1`, [slug]);
  }
}

export async function getSponsoredList(): Promise<
  { slug: string; sponsor: string; createdAt: string }[]
> {
  if (!(await ready())) return [];
  try {
    const res = await getPool().query<{
      slug: string;
      sponsor: string;
      created_at: Date;
    }>(
      `select slug, sponsor, created_at from site_sponsored order by created_at desc limit 100`,
    );
    return res.rows.map((r) => ({
      slug: r.slug,
      sponsor: r.sponsor,
      createdAt: r.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}
