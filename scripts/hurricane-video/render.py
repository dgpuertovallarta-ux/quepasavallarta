"""Render del video vertical (9:16) de ciclón para Qué Pasa Vallarta.

Estilo propio de la marca: fondo azul noche, tierra gris carbón con costa
turquesa, títulos condensados en amarillo/rosa, logo y barra de progreso
tipo historia. Los datos vienen de nhc.py (Centro Nacional de Huracanes).

Uso:  render_video(story, "salida.mp4")
donde `story` lo arma build_story() a partir de los avisos.
"""
from __future__ import annotations

import json
import math
import os
import random
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import nhc

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, "assets")
TZ = ZoneInfo("America/Mexico_City")

W, H = 1080, 1920
FPS = 30

# Paleta Qué Pasa Vallarta
INK = (246, 246, 244)
MUTED = (183, 186, 195)
PINK = (245, 115, 208)
PINK_DEEP = (194, 24, 139)
YELLOW = (245, 228, 0)
TEAL = (0, 214, 192)
NIGHT = (3, 28, 56)
WW_COLORS = {"HWR": (255, 59, 107), "HWA": (255, 160, 200), "TWR": (64, 156, 255), "TWA": (245, 228, 0)}
WW_NAMES = {"HWR": "Aviso de huracán", "HWA": "Vigilancia de huracán", "TWR": "Aviso de tormenta tropical", "TWA": "Vigilancia de tormenta tropical"}

DAYS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"]
DAYS_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
COMPASS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"]

CITIES = [
    ("Puerto Vallarta", 20.62, -105.23, "pv"),
    ("Cabo Corrientes", 20.40, -105.70, "r"),
    ("Punta de Mita", 20.77, -105.52, "l"),
    ("San Blas", 21.54, -105.29, "r"),
    ("Mazatlán", 23.24, -106.42, "r"),
    ("Manzanillo", 19.05, -104.32, "r"),
    ("Barra de Navidad", 19.21, -104.68, "r"),
    ("Islas Marías", 21.62, -106.55, "l"),
    ("Acapulco", 16.85, -99.88, "r"),
    ("Zihuatanejo", 17.64, -101.55, "r"),
    ("Los Cabos", 22.89, -109.91, "l"),
]


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(A, "fonts", name), size)


F_DISPLAY = lambda s: font("SofiaSansXC-Black.ttf", s)  # noqa: E731
F_SEMI = lambda s: font("WorkSans-SemiBold.ttf", s)  # noqa: E731
F_REG = lambda s: font("WorkSans-Regular.ttf", s)  # noqa: E731


def fit_cam(points, pad_deg: float = 0.6, min_span: float = 2.4, y_mid: float = 740, usable_h: float = 780):
    """Cámara (lon, lat, span) que deja todos los puntos (lat, lon) entre el
    encabezado y los títulos (y≈300–1180 en un cuadro de 1920)."""
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    dlat = max(lats) - min(lats) + 2 * pad_deg
    dlon = (max(lons) - min(lons) + 2 * pad_deg) * math.cos(math.radians(20))
    span = max(min_span, dlat * H / usable_h, dlon * H / (W * 0.82))
    pxdeg = H / span
    lat_c = (max(lats) + min(lats)) / 2 - (H / 2 - y_mid) / pxdeg
    lon_c = (max(lons) + min(lons)) / 2
    return lon_c, lat_c, span


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------- mapa

COAST = json.load(open(os.path.join(A, "coast.json")))


def coast_assignments(ww: list[dict], max_km: float = 40) -> list[tuple[float, float, str]]:
    """Asigna cada punto de costa al tramo de aviso más cercano (≤ max_km)."""
    out = []
    order = {"HWR": 0, "HWA": 1, "TWR": 2, "TWA": 3}
    for lo, la in COAST:
        best, bd = None, max_km
        for seg in ww:
            c = seg["coords"]
            for a, b in zip(c, c[1:]):
                if abs(la - a[1]) > 1.5 and abs(la - b[1]) > 1.5:
                    continue
                dd = nhc.point_segment_km((la, lo), a, b)
                if dd < bd - 2 or (best and abs(dd - bd) <= 2 and order.get(seg["type"], 9) < order.get(best, 9)):
                    best, bd = seg["type"], min(bd, dd)
        if best:
            out.append((lo, la, best))
    return out


class Map:
    def __init__(self):
        self.img = Image.open(os.path.join(A, "basemap.png")).convert("RGB")
        self.m = json.load(open(os.path.join(A, "basemap.json")))

    def bxy(self, lon: float, lat: float) -> tuple[float, float]:
        m = self.m
        return (lon - m["lon0"]) * m["px_per_deg"] * m["cos"], (m["lat1"] - lat) * m["px_per_deg"]

    def frame(self, cam: tuple[float, float, float]):
        """Devuelve (imagen del mapa, función lon/lat→x,y del cuadro)."""
        lon, lat, span = cam
        cx, cy = self.bxy(lon, lat)
        s = H / (span * self.m["px_per_deg"])
        bw, bh = W / s, H / s
        box = (cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
        img = self.img.transform((W, H), Image.Transform.EXTENT, box, resample=Image.Resampling.BILINEAR, fillcolor=(6, 14, 30))

        def to_xy(lo: float, la: float) -> tuple[float, float]:
            x, y = self.bxy(lo, la)
            return (x - box[0]) * s, (y - box[1]) * s

        km_px = s * self.m["px_per_deg"] / 111.0  # px por km (vertical)
        return img, to_xy, km_px


# --------------------------------------------------------------- dibujo

def shadow_text(d: ImageDraw.ImageDraw, xy, text, fnt, fill, anchor="la", shadow=(0, 0, 0, 170), off=3, stroke=0):
    x, y = xy
    d.text((x + off, y + off), text, font=fnt, fill=shadow, anchor=anchor)
    d.text((x, y), text, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=(10, 12, 20, 255))


def wrap(text: str, fnt, width: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if fnt.getlength(t) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def fit_font(text: str, maker, size: int, width: int):
    f = maker(size)
    while f.getlength(text) > width and size > 40:
        size -= 6
        f = maker(size)
    return f


_ICON_CACHE: dict = {}


def storm_icon(size: int, color=PINK) -> Image.Image:
    key = (size, color)
    if key in _ICON_CACHE:
        return _ICON_CACHE[key]
    S = size * 3
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S / 2
    for arm in (0, math.pi):
        pts = []
        for i in range(60):
            th = i / 59 * 2.4
            r = S * 0.12 + th * S * 0.14
            a = arm + th
            pts.append((c + r * math.cos(a), c + r * math.sin(a)))
        for i in range(len(pts) - 1):
            wdt = int(S * 0.11 * (1 - i / len(pts)) + 4)
            d.line([pts[i], pts[i + 1]], fill=color + (255,), width=wdt)
    d.ellipse([c - S * 0.2, c - S * 0.2, c + S * 0.2, c + S * 0.2], outline=color + (255,), width=int(S * 0.08))
    d.ellipse([c - S * 0.07, c - S * 0.07, c + S * 0.07, c + S * 0.07], fill=(255, 255, 255, 255))
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    _ICON_CACHE[key] = im
    return im


def paste_icon(base: Image.Image, icon: Image.Image, x: float, y: float, angle: float):
    r = icon.rotate(angle, resample=Image.Resampling.BICUBIC)
    base.alpha_composite(r, (int(x - r.width / 2), int(y - r.height / 2)))


def dashed(d, p, q, fill, width=5, dash=18, gap=12):
    (x1, y1), (x2, y2) = p, q
    L = math.hypot(x2 - x1, y2 - y1)
    if L == 0:
        return
    n = int(L / (dash + gap)) + 1
    for i in range(n):
        a = i * (dash + gap) / L
        b = min(1, (i * (dash + gap) + dash) / L)
        d.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)], fill=fill, width=width)


def wind_field_points(fix: nhc.Fix, radii: dict, to_xy) -> list[tuple[float, float]]:
    pts = []
    order = ["NE", "SE", "SW", "NW"]  # centros de cuadrante: 45, 135, 225, 315°
    for deg in range(0, 361, 4):
        u = ((deg - 45) % 360) / 90.0
        i0 = int(u) % 4
        f = u - int(u)
        f = (1 - math.cos(math.pi * f)) / 2
        km = (radii.get(order[i0], 0) * (1 - f) + radii.get(order[(i0 + 1) % 4], 0) * f) * 1.852
        km = max(km, 5)
        dlat = km / 111.0 * math.cos(math.radians(deg))
        dlon = km / (111.0 * math.cos(math.radians(fix.lat))) * math.sin(math.radians(deg))
        pts.append(to_xy(fix.lon + dlon, fix.lat + dlat))
    return pts


def local(dt: datetime) -> datetime:
    return dt.astimezone(TZ)


def hour_txt(dt: datetime) -> str:
    l = local(dt)
    h = l.hour % 12 or 12
    if l.hour == 12 and l.minute == 0:
        return "mediodía"
    return f"{h} {'a.m.' if l.hour < 12 else 'p.m.'}"


def round_km(km: float) -> int:
    return int(round(km / 10.0) * 10)


def mm(inches: float) -> int:
    v = inches * 25.4
    return int(round(v / 50.0) * 50) if v >= 100 else int(round(v / 10.0) * 10)


# ------------------------------------------------------------ guion (story)

@dataclass
class Scene:
    kind: str
    dur: float
    cam: tuple[float, float, float]
    title: str = ""
    title_color: tuple = YELLOW
    sub: str = ""
    small: str = ""
    data: dict = field(default_factory=dict)
    voice: str = ""  # lo que narra la voz en esta escena


def hour_spoken(dt: datetime) -> str:
    """Hora como se dice: "4 de la tarde", "mediodía"."""
    l = local(dt)
    if l.hour == 12 and l.minute < 30:
        return "el mediodía"
    if l.hour == 0 and l.minute < 30:
        return "la medianoche"
    h = l.hour % 12 or 12
    part = "de la mañana" if 5 <= l.hour < 12 else "de la tarde" if 12 <= l.hour < 19 else "de la noche" if l.hour >= 19 else "de la madrugada"
    return f"las {h} {part}" if h != 1 else f"la 1 {part}"


def build_story(adv: nhc.Advisory, tas: nhc.PublicInfo, cone: list, ww: list, public_adv: str | None = None) -> dict:
    name = adv.storm_name
    cur = adv.current
    if tas.lat is not None and tas.lon is not None:  # el aviso público más reciente actualiza la posición
        cur = nhc.Fix(cur.time, tas.lat, tas.lon, cur.wind_kt, cur.radii34, cur.radii64, "CURRENT")
    kt = cur.wind_kt
    kmh = tas.wind_kmh or nhc.kt_to_kmh(kt)
    cat_short, cat_long = nhc.category(kt)
    word = nhc.storm_word(kt)
    d_now = nhc.haversine_km((cur.lat, cur.lon), nhc.PV)
    move = COMPASS[int(((adv.move_dir + 22.5) % 360) // 45)]
    move_kmh = int(round(adv.move_kt * 1.852))
    best, d_best = nhc.closest_approach(adv)
    status = nhc.place_status(ww) if ww else None
    adv_label = (public_adv or tas.adv_num or adv.adv_num).upper()
    issued_txt = tas.issued_text or local(adv.issued).strftime("%d/%m %H:%M")

    scenes: list[Scene] = []
    wide = fit_cam([nhc.PV, (cur.lat, cur.lon)], pad_deg=0.9)
    scenes.append(Scene("hook", 4.0, wide, f"¿Y {('EL HURACÁN' if kt >= 64 else 'LA TORMENTA')} {name.upper()}?", YELLOW,
                        "Lo que dice el Centro Nacional de Huracanes para Vallarta", "", {"cur": cur},
                        f"Esto es lo que dice el Centro Nacional de Huracanes sobre {('el huracán' if kt >= 64 else 'la ' + word)} {name} y Puerto Vallarta."))
    scenes.append(Scene("now", 4.2, fit_cam([nhc.PV, (cur.lat, cur.lon)], pad_deg=0.4), f"{kmh} km/h", PINK,
                        f"{cat_long} · se mueve al {move} a {move_kmh} km/h",
                        f"Ahora está a unos {round_km(d_now)} km de Puerto Vallarta", {"cur": cur},
                        f"Tiene vientos de {kmh} kilómetros por hora. Es {('un ' if kt >= 64 else 'una ') + cat_long.lower()}, se mueve al {move} y está a unos {round_km(d_now)} kilómetros de Vallarta."))
    track_pts = [nhc.PV, (cur.lat, cur.lon)] + [(f.lat, f.lon) for f in adv.forecasts[:5]]
    scenes.append(Scene("track", 5.2, fit_cam(track_pts, pad_deg=0.7), "SU CAMINO", YELLOW,
                        "Pronóstico oficial para los próximos días",
                        "El cono marca por dónde podría pasar el centro", {"cur": cur, "cone": cone, "fc": adv.forecasts},
                        "Este es su pronóstico oficial. El cono marca por dónde podría pasar el centro."))
    if ww:
        if status:
            title = WW_NAMES[status].upper().replace("AVISO DE ", "AVISO: ").replace("VIGILANCIA DE ", "VIGILANCIA: ")
            sub = f"Vallarta y Bahía de Banderas: {WW_NAMES[status].lower()}"
            small = {"HWR": "Se esperan condiciones de huracán", "HWA": "Son posibles condiciones de huracán",
                     "TWR": "Se esperan condiciones de tormenta tropical", "TWA": "Son posibles condiciones de tormenta tropical"}[status]
            col = WW_COLORS[status] if status != "TWR" else YELLOW
            vo = f"Vallarta y Bahía de Banderas están bajo {WW_NAMES[status].lower()}. {small}."
        else:
            title, sub, small, col = "AVISOS EN LA COSTA", "Vallarta todavía no está en zona de aviso", "Sigue los próximos boletines", YELLOW
            vo = "Hay avisos en la costa, pero Vallarta todavía no está en zona de aviso."
        scenes.append(Scene("ww", 4.8, (-105.15, 20.05, 4.2), title, col, sub, small, {"ww": ww, "status": status}, vo))
    l = local(best.time)
    scenes.append(Scene("closest", 4.8, fit_cam([nhc.PV, (best.lat, best.lon)], pad_deg=0.5, min_span=3.0),
                        f"{DAYS[l.weekday()]} {hour_txt(best.time).upper()}", YELLOW,
                        f"Lo más cerca de Vallarta: el centro pasaría a unos {round_km(d_best)} km",
                        "Es un pronóstico y puede cambiar", {"best": best, "d": d_best},
                        f"Lo más cerca pasaría el {DAYS[l.weekday()].lower()} a {hour_spoken(best.time)}, a unos {round_km(d_best)} kilómetros. Es un pronóstico y puede cambiar."))
    q = nhc.quadrant_toward((best.lat, best.lon), nhc.PV)
    r34 = (best.radii34 or {}).get(q, 0) * 1.852
    r64 = (best.radii64 or {}).get(q, 0) * 1.852
    if r64 and d_best <= r64:
        wt, ws = "VIENTOS DE HURACÁN", "Vallarta quedaría en la zona de vientos de huracán (119 km/h o más)"
        wv = "Vallarta quedaría dentro de la zona de vientos de huracán, de 119 kilómetros por hora o más."
    elif r34 and d_best <= r34:
        wt, ws = "VIENTO FUERTE", "Vallarta quedaría en la zona de vientos de tormenta tropical (63 km/h o más)"
        wv = "Vallarta quedaría dentro de la zona de vientos de tormenta tropical, de 63 kilómetros por hora o más."
    elif r34:
        wt, ws = "VIENTOS", f"La zona de vientos de tormenta tropical quedaría a unos {round_km(d_best - r34)} km de Vallarta"
        wv = f"La zona de vientos de tormenta tropical quedaría a unos {round_km(d_best - r34)} kilómetros de Vallarta."
    else:
        wt, ws = "VIENTOS", "El NHC no pronostica vientos de tormenta tropical cerca de Vallarta"
        wv = "El Centro Nacional de Huracanes no pronostica vientos de tormenta tropical cerca de Vallarta."
    max34 = max((cur.radii34 or {"x": 0}).values()) * 1.852
    r_view = max((best.radii34 or {"x": 60}).values()) * 1.852 / 111.0
    scenes.append(Scene("wind", 4.6, fit_cam([nhc.PV, (best.lat + r_view, best.lon), (best.lat - r_view, best.lon)], pad_deg=0.3, min_span=3.4), wt, PINK if "HURACÁN" in wt else YELLOW, ws,
                        f"Hoy alcanzan hasta {round_km(max34)} km del centro" if max34 else "",
                        {"best": best}, wv))
    rain = None
    for r in tas.rain:
        if "Jalisco" in r[3]:
            rain = r
            break
    if not rain:
        rain = next((r for r in tas.rain if "Nayarit" in r[3]), None)
    if rain:
        states = rain[3].split(" en ")[-1].strip()
        scenes.append(Scene("rain", 4.4, (-105.25, 20.55, 2.6), f"{mm(rain[0])}–{mm(rain[1])} mm", (110, 190, 255),
                            f"De lluvia en {states}" + (f", hasta {mm(rain[2])} mm en algunos puntos" if rain[2] else ""),
                            "Riesgo de inundaciones y deslaves en zonas de cerro", {},
                            f"Se esperan de {mm(rain[0])} a {mm(rain[1])} milímetros de lluvia" + (f", y hasta {mm(rain[2])} en algunos puntos" if rain[2] else "") + ". Cuidado con inundaciones y deslaves."))
    if tas.surf:
        scenes.append(Scene("sea", 3.8, (-105.35, 20.6, 2.3), "NO AL MAR", PINK,
                            "Oleaje y corrientes peligrosas en la costa",
                            "Posible marejada en zonas bajas" if tas.surge else "Respeta las banderas de playa", {},
                            "No te metas al mar: hay oleaje y corrientes peligrosas" + (", y posible marejada en zonas bajas." if tas.surge else ".")))
    scenes.append(Scene("prep", 4.6, (-105.25, 20.6, 3.0), "PREPÁRATE", YELLOW,
                        "Ten listo lo básico y sigue las indicaciones de Protección Civil", "", {},
                        "Ten agua y comida para tres días, linterna, pilas, tus documentos protegidos y el celular cargado. Ubica tu refugio más cercano."))
    nxt = f"Próximo boletín del NHC: {hour_txt(adv.next_advisory)}" if adv.next_advisory else ""
    scenes.append(Scene("cta", 4.2, (-105.25, 20.6, 4.5), "SÍGUENOS", YELLOW,
                        "Te contamos cada boletín oficial, sin alarmismo", nxt, {},
                        "Síguenos en Qué Pasa Vallarta. Te contamos cada boletín oficial, sin alarmismo."))

    source = f"Fuente: Centro Nacional de Huracanes (NHC, Miami) · boletín {adv_label} · {issued_txt.replace('CST', 'hora centro')} · distancias: cálculo Qué Pasa Vallarta"
    return {"scenes": scenes, "badge": f"{word.upper()} {name.upper()} · BOLETÍN {adv_label}", "source": source,
            "name": name, "kmh": kmh, "cat": cat_long, "d_now": d_now, "best": best, "d_best": d_best, "status": status,
            "adv_label": adv_label, "move": move, "move_kmh": move_kmh, "word": word, "rain": rain, "issued_txt": issued_txt}


# --------------------------------------------------------------- render

class Renderer:
    def __init__(self, story: dict):
        self.story = story
        self.scenes: list[Scene] = story["scenes"]
        self.map = Map()
        self.logo = Image.open(os.path.join(A, "logo.png")).convert("RGBA")
        self.logo_small = self.logo.copy()
        self.logo_small.thumbnail((230, 154), Image.Resampling.LANCZOS)
        self.logo_big = self.logo.copy()
        self.logo_big.thumbnail((620, 420), Image.Resampling.LANCZOS)
        self.icon = storm_icon(150)
        # Patrocinador "Presentado por" (opcional; logo ya descargado por generate.py)
        self.sponsor = None
        sp = story.get("sponsor") or {}
        if sp.get("logo_path") and os.path.exists(sp["logo_path"]):
            try:
                im = Image.open(sp["logo_path"]).convert("RGBA")
                im.thumbnail((340, 96), Image.Resampling.LANCZOS)
                self.sponsor = im
            except Exception:
                self.sponsor = None
        self.icon_small = storm_icon(92)
        grad = Image.new("L", (1, H), 0)
        for y in range(H):
            t = max(0.0, (y - 1150) / (H - 1150))
            grad.putpixel((0, y), int(235 * min(1.0, t * 1.25) ** 1.4))
        self.bottom = Image.new("RGBA", (W, H), NIGHT + (0,))
        self.bottom.putalpha(grad.resize((W, H)))
        topg = Image.new("L", (1, H), 0)
        for y in range(H):
            topg.putpixel((0, y), int(160 * max(0.0, 1 - y / 330)))
        self.top = Image.new("RGBA", (W, H), NIGHT + (0,))
        self.top.putalpha(topg.resize((W, H)))
        rnd = random.Random(7)
        self.drops = [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(26, 60), rnd.uniform(0.6, 1.4)) for _ in range(260)]
        self.starts = []
        t = 0.0
        for s in self.scenes:
            self.starts.append(t)
            t += s.dur
        self.total = t

    # cámara con transición suave entre escenas
    def camera(self, i: int, lt: float):
        s = self.scenes[i]
        prev = self.scenes[i - 1].cam if i > 0 else s.cam
        k = ease(lt / 1.0)
        lon = prev[0] + (s.cam[0] - prev[0]) * k
        lat = prev[1] + (s.cam[1] - prev[1]) * k
        span = prev[2] + (s.cam[2] - prev[2]) * k
        span *= 1 - 0.035 * ease(lt / s.dur)  # acercamiento lento
        return lon, lat, span

    def city_labels(self, d, to_xy, highlight_pv=True, only=None):
        for name, la, lo, side in CITIES:
            if only and name not in only:
                continue
            x, y = to_xy(lo, la)
            if not (-50 < x < W + 50 and 230 < y < 1350):
                continue
            if side == "pv":
                d.ellipse([x - 13, y - 13, x + 13, y + 13], outline=YELLOW + (255,), width=4)
                d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=YELLOW + (255,))
                f = F_SEMI(36)
                if x + 24 + f.getlength("Puerto Vallarta") > W - 20:
                    shadow_text(d, (x - 24, y), "Puerto Vallarta", f, YELLOW + (255,), "rm")
                else:
                    shadow_text(d, (x + 24, y), "Puerto Vallarta", f, YELLOW + (255,), "lm")
            else:
                d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=INK + (230,))
                f = F_SEMI(28)
                if side == "r" and x + 16 + f.getlength(name) > W - 16:
                    side = "l"
                if side == "l" and x - 16 - f.getlength(name) < 16:
                    side = "r"
                if side == "r":
                    shadow_text(d, (x + 16, y), name, F_SEMI(28), INK + (235,), "lm")
                else:
                    shadow_text(d, (x - 16, y), name, F_SEMI(28), INK + (235,), "rm")

    def draw_frame(self, t: float) -> Image.Image:
        i = max(j for j, st in enumerate(self.starts) if st <= t)
        s = self.scenes[i]
        lt = t - self.starts[i]
        cam = self.camera(i, lt)
        base, to_xy, km_px = self.map.frame(cam)
        frame = base.convert("RGBA")
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        self.scene_layer(s, lt, frame, ov, d, to_xy, km_px, t)
        frame.alpha_composite(ov)
        frame.alpha_composite(self.top)
        frame.alpha_composite(self.bottom)
        ui = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.chrome(ui, i, lt)
        self.texts(ui, s, lt)
        frame.alpha_composite(ui)
        return frame.convert("RGB")

    # ------------------------------------------------------- capas de escena
    def scene_layer(self, s: Scene, lt, frame, ov, d, to_xy, km_px, t):
        k = s.kind
        cur = s.data.get("cur") or self.story["scenes"][0].data["cur"]
        if k in ("hook", "now"):
            self.city_labels(d, to_xy)
            x, y = to_xy(cur.lon, cur.lat)
            for n in range(3):
                ph = ((lt * 0.8 + n / 3) % 1.0)
                r = 60 + ph * 170
                d.ellipse([x - r, y - r, x + r, y + r], outline=PINK + (int(200 * (1 - ph)),), width=5)
            paste_icon(ov, self.icon, x, y, -t * 120)
        elif k == "track":
            cone = s.data.get("cone") or []
            a = ease((lt - 0.3) / 0.9)
            if len(cone) > 2 and a > 0:
                pts = [to_xy(lo, la) for lo, la in cone]
                d.polygon(pts, fill=(255, 255, 255, int(46 * a)))
                d.line(pts + [pts[0]], fill=(255, 255, 255, int(150 * a)), width=3)
            self.city_labels(d, to_xy, only={"Puerto Vallarta", "Manzanillo", "Mazatlán", "Cabo Corrientes", "Islas Marías", "Los Cabos"})
            fc = s.data["fc"]
            pts = [(cur.lon, cur.lat, None)] + [(f.lon, f.lat, f) for f in fc]
            prog = ease((lt - 0.6) / 3.0) * (len(pts) - 1)
            xy = [to_xy(p[0], p[1]) for p in pts]
            n_full = int(prog)
            line = xy[: n_full + 1]
            if n_full < len(xy) - 1:
                f = prog - n_full
                a_, b_ = xy[n_full], xy[n_full + 1]
                line.append((a_[0] + (b_[0] - a_[0]) * f, a_[1] + (b_[1] - a_[1]) * f))
            if len(line) > 1:
                d.line(line, fill=PINK + (255,), width=8, joint="curve")
            lbl_font = F_SEMI(26)
            shown = 0
            for j, p in enumerate(pts[1:], start=1):
                if j > prog + 0.01:
                    break
                fx = p[2]
                x, y = xy[j]
                col = PINK if fx.wind_kt >= 64 else (YELLOW if fx.wind_kt >= 34 else INK)
                d.ellipse([x - 11, y - 11, x + 11, y + 11], fill=col + (255,), outline=(20, 20, 30, 255), width=3)
                if j % 2 == 1 or j == len(pts) - 1:
                    l = local(fx.time)
                    shadow_text(d, (x - 20, y), f"{DAYS_SHORT[l.weekday()]} {hour_txt(fx.time)}", lbl_font, INK + (240,), "rm")
                shown += 1
            x, y = xy[0]
            paste_icon(ov, self.icon_small, x, y, -t * 120)
            # leyenda de puntos
            lx, ly = 70, 1235
            for txt, col in (("Huracán", PINK), ("Tormenta tropical", YELLOW), ("Depresión o remanente", INK)):
                d.ellipse([lx, ly - 10, lx + 20, ly + 10], fill=col + (255,))
                shadow_text(d, (lx + 30, ly), txt, F_SEMI(26), INK + (230,), "lm")
                lx += 60 + int(F_SEMI(26).getlength(txt))
        elif k == "ww":
            a = ease((lt - 0.2) / 0.8)
            ww = s.data["ww"]
            if "coast" not in s.data:
                s.data["coast"] = coast_assignments(ww)
            r_ = max(6, int(km_px * 2.6))
            for lo, la, typ in s.data["coast"]:
                x, y = to_xy(lo, la)
                if -20 < x < W + 20 and -20 < y < H + 20:
                    d.ellipse([x - r_ - 3, y - r_ - 3, x + r_ + 3, y + r_ + 3], fill=(10, 10, 20, int(160 * a)))
            for lo, la, typ in s.data["coast"]:
                x, y = to_xy(lo, la)
                if -20 < x < W + 20 and -20 < y < H + 20:
                    d.ellipse([x - r_, y - r_, x + r_, y + r_], fill=WW_COLORS.get(typ, INK) + (int(255 * a),))
            self.city_labels(d, to_xy)
            present = [c for c in ("HWR", "HWA", "TWR", "TWA") if any(g["type"] == c for g in ww)]
            ly = 300
            if present:
                pw = max(F_SEMI(32).getlength(WW_NAMES[c]) for c in present) + 150
                d.rounded_rectangle([40, ly - 50, 40 + pw, ly - 50 + 58 * len(present) + 26], radius=22, fill=(10, 14, 26, 215))
            for c in present:
                d.rounded_rectangle([60, ly - 26, 60 + 70, ly + 6], radius=8, fill=WW_COLORS[c] + (255,))
                shadow_text(d, (150, ly - 10), WW_NAMES[c], F_SEMI(32), INK + (255,), "lm")
                ly += 58
            x, y = to_xy(cur.lon, cur.lat)
            paste_icon(ov, self.icon_small, x, y, -t * 120)
        elif k == "closest":
            best = s.data["best"]
            bx, by = to_xy(best.lon, best.lat)
            px, py = to_xy(nhc.PV[1], nhc.PV[0])
            a = ease((lt - 0.3) / 1.0)
            dashed(d, (px, py), (px + (bx - px) * a, py + (by - py) * a), INK + (255,), width=5)
            self.city_labels(d, to_xy)
            if a > 0.6:
                mx, my = (px + bx) / 2, (py + by) / 2
                tag = f"~{round_km(s.data['d'])} km"
                f = F_DISPLAY(70)
                tw = f.getlength(tag)
                d.rounded_rectangle([mx - tw / 2 - 22, my - 50, mx + tw / 2 + 22, my + 40], radius=18, fill=(10, 14, 26, 220), outline=YELLOW + (255,), width=3)
                d.text((mx, my - 4), tag, font=f, fill=YELLOW + (255,), anchor="mm")
            paste_icon(ov, self.icon, bx, by, -t * 120)
        elif k == "wind":
            best = s.data["best"]
            a = ease((lt - 0.2) / 1.0)
            if best.radii34:
                pts = wind_field_points(best, best.radii34, to_xy)
                d.polygon(pts, fill=(245, 228, 0, int(55 * a)))
                d.line(pts, fill=YELLOW + (int(230 * a),), width=4)
            if best.radii64:
                pts = wind_field_points(best, best.radii64, to_xy)
                d.polygon(pts, fill=PINK + (int(90 * a),))
                d.line(pts, fill=PINK + (int(240 * a),), width=4)
            self.city_labels(d, to_xy)
            bx, by = to_xy(best.lon, best.lat)
            paste_icon(ov, self.icon_small, bx, by, -t * 120)
            lx, ly = 70, 1235
            for txt, col in (("Viento de tormenta tropical (63+ km/h)", YELLOW), ("Viento de huracán (119+ km/h)", PINK)):
                d.rounded_rectangle([lx, ly - 12, lx + 26, ly + 12], radius=6, fill=col + (230,))
                shadow_text(d, (lx + 38, ly), txt, F_SEMI(26), INK + (230,), "lm")
                ly -= 42
        elif k == "rain":
            self.city_labels(d, to_xy, only={"Puerto Vallarta", "Cabo Corrientes", "Punta de Mita"})
            a = ease(lt / 0.6)
            d.rectangle([0, 0, W, H], fill=(20, 40, 70, int(70 * a)))
            for (x0, y0, ln, sp) in self.drops:
                y = (y0 + lt * 900 * sp) % (H + 100) - 50
                x = (x0 - lt * 180 * sp) % W
                d.line([(x, y), (x - ln * 0.28, y + ln)], fill=(170, 210, 255, int(150 * a)), width=3)
        elif k == "sea":
            self.city_labels(d, to_xy, only={"Puerto Vallarta", "Punta de Mita", "Cabo Corrientes"})
            a = ease(lt / 0.6)
            for row in range(14):
                yb = 520 + row * 52
                pts = []
                for x in range(0, W + 20, 20):
                    pts.append((x, yb + 14 * math.sin(x / 70 + lt * 3.2 + row * 0.9)))
                d.line(pts, fill=(255, 255, 255, int((40 + row * 6) * a)), width=3)
        elif k == "prep":
            d.rectangle([0, 0, W, H], fill=(8, 12, 22, 150))
            items = ["Agua y comida para 3 días", "Linterna, pilas y radio", "Documentos en bolsa de plástico", "Celular y batería cargados", "Ubica tu refugio más cercano"]
            for j, it in enumerate(items):
                a = ease((lt - 0.35 - j * 0.42) / 0.35)
                if a <= 0:
                    continue
                y = 330 + j * 168
                x0 = 80 - (1 - a) * 60
                d.rounded_rectangle([x0, y, x0 + 920, y + 132], radius=26, fill=(30, 34, 46, int(235 * a)), outline=TEAL + (int(200 * a),), width=3)
                cx, cy = x0 + 70, y + 66
                d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=TEAL + (int(255 * a),))
                d.line([(cx - 16, cy + 1), (cx - 4, cy + 14), (cx + 18, cy - 12)], fill=(12, 20, 30, int(255 * a)), width=8)
                d.text((x0 + 130, cy), it, font=F_SEMI(42), fill=INK + (int(255 * a),), anchor="lm")
        elif k == "cta":
            d.rectangle([0, 0, W, H], fill=(8, 12, 22, 175))
            a = ease(lt / 0.6)
            lg = self.logo_big
            ov.alpha_composite(lg, (int(W / 2 - lg.width / 2), int(560 - lg.height / 2 + (1 - a) * 40)))
            d.text((W / 2, 900), "quepasavta.com", font=F_SEMI(52), fill=INK + (int(255 * a),), anchor="mm")
            d.text((W / 2, 975), "facebook.com/quepasavallarta", font=F_REG(38), fill=MUTED + (int(255 * a),), anchor="mm")
            if self.sponsor is not None:
                sp = self.sponsor
                bw, bh = max(520, sp.width + 80), sp.height + 110
                bx, by = int(W / 2 - bw / 2), 1035
                d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=28, fill=(255, 255, 255, int(245 * a)))
                d.text((W / 2, by + 42), "PRESENTADO POR", font=F_SEMI(30), fill=(10, 31, 58, int(255 * a)), anchor="mm")
                spa = sp.copy()
                spa.putalpha(Image.eval(sp.getchannel("A"), lambda v: int(v * a)))
                ov.alpha_composite(spa, (int(W / 2 - sp.width / 2), by + 80))

    # ---------------------------------------------- marco fijo (logo, barra)
    def chrome(self, ui: Image.Image, i: int, lt: float):
        d = ImageDraw.Draw(ui)
        n = len(self.scenes)
        gap, x0, x1, y = 10, 40, W - 40, 34
        seg = (x1 - x0 - gap * (n - 1)) / n
        for j in range(n):
            xa = x0 + j * (seg + gap)
            d.rounded_rectangle([xa, y, xa + seg, y + 7], radius=4, fill=(255, 255, 255, 70))
            f = 1.0 if j < i else (min(1.0, lt / self.scenes[i].dur) if j == i else 0.0)
            if f > 0:
                d.rounded_rectangle([xa, y, xa + seg * f, y + 7], radius=4, fill=(255, 255, 255, 235))
        if self.scenes[i].kind != "cta":
            ui.alpha_composite(self.logo_small, (40, 66))
        badge = self.story["badge"]
        f = F_SEMI(26)
        tw = f.getlength(badge)
        bx1, by0 = W - 40, 96
        d.rounded_rectangle([bx1 - tw - 64, by0, bx1, by0 + 56], radius=28, fill=(10, 14, 26, 210), outline=PINK + (255,), width=3)
        d.ellipse([bx1 - tw - 46, by0 + 20, bx1 - tw - 30, by0 + 36], fill=PINK + (255,))
        d.text((bx1 - 22, by0 + 28), badge, font=f, fill=INK + (255,), anchor="rm")
        # fuente
        src = self.story["source"]
        sf = F_REG(23)
        lines = wrap(src, sf, W - 100)
        for j, ln in enumerate(lines[:2]):
            d.text((W / 2, H - 92 + j * 30), ln, font=sf, fill=(160, 166, 180, 230), anchor="mm")

    def texts(self, ui: Image.Image, s: Scene, lt: float):
        d = ImageDraw.Draw(ui)
        a = ease((lt - 0.15) / 0.45)
        if a <= 0:
            return
        off = (1 - a) * 50
        tf = fit_font(s.title, F_DISPLAY, 168, W - 100)
        y = 1405 + off
        shadow_text(d, (W / 2, y), s.title, tf, s.title_color + (int(255 * a),), "mm", shadow=(0, 0, 0, int(190 * a)), off=5)
        y += tf.size * 0.62
        if s.sub:
            sf = F_SEMI(46)
            for ln in wrap(s.sub, sf, W - 120)[:3]:
                shadow_text(d, (W / 2, y + 10), ln, sf, INK + (int(255 * a),), "mt", shadow=(0, 0, 0, int(170 * a)))
                y += 58
        if s.small:
            b = ease((lt - 0.55) / 0.45)
            mf = F_REG(36)
            for ln in wrap(s.small, mf, W - 140)[:1]:
                d.text((W / 2, y + 22), ln, font=mf, fill=MUTED + (int(255 * b),), anchor="mt")
                y += 46


def render_video(story: dict, out_path: str, preview_dir: str | None = None, premade_voice: str | None = None) -> str:
    import audio  # voz + música

    work = os.path.join(os.path.dirname(os.path.abspath(out_path)), "_audio")
    clips = audio.prepare_voice(story["scenes"], work, premade_voice)  # puede alargar escenas
    r = Renderer(story)
    n = int(r.total * FPS)
    wav = audio.mix(r.scenes, r.starts, r.total, clips, os.path.join(work, "mix.wav"))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav,
           "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-maxrate", "1800k", "-bufsize", "3600k",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(n):
        t = f / FPS
        img = r.draw_frame(t)
        if preview_dir and f % FPS == int(FPS * 0.9):
            img.resize((360, 640)).save(os.path.join(preview_dir, f"p_{f // FPS:02d}.png"))
        p.stdin.write(img.tobytes())
    p.stdin.close()
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("ffmpeg falló")
    return out_path
