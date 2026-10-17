"""Lectura de los productos del Centro Nacional de Huracanes (NHC, Miami).

Todo sale de fuentes oficiales del NHC:
  - CurrentStorms.json            → ciclones activos y enlaces a sus productos
  - Forecast Advisory (TCM)       → posición, viento, radios y pronóstico
  - Aviso público en español (TAS)→ vigilancias/avisos, lluvia, oleaje
  - KMZ de cono y de avisos       → geometría para el mapa
"""
from __future__ import annotations

import io
import json
import math
import re
import urllib.request
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

NHC = "https://www.nhc.noaa.gov"
UA = {"User-Agent": "QuePasaVallarta/1.0 (quepasavta.com; contacto via sitio)"}

# Puerto Vallarta (centro)
PV = (20.62, -105.23)

MONTHS = {m: i + 1 for i, m in enumerate("JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split())}


# ----------------------------------------------------------------- utilidades

def fetch(url: str, binary: bool = False, timeout: int = 30):
    req = urllib.request.Request(url if url.startswith("http") else NHC + url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def pre_text(html: str) -> str:
    """Los avisos en nhc.noaa.gov/text/*.shtml vienen dentro de <pre>."""
    m = re.search(r"<pre[^>]*>(.*?)</pre>", html, re.S | re.I)
    txt = m.group(1) if m else html
    txt = re.sub(r"<[^>]+>", "", txt)
    return txt.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def bearing_deg(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    y = math.sin(lon2 - lon1) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def kt_to_kmh(kt: float) -> int:
    return int(round(kt * 1.852 / 5.0) * 5)


def nm_to_km(nm: float) -> int:
    return int(round(nm * 1.852))


def category(kt: float) -> tuple[str, str]:
    """(nombre corto, etiqueta larga) según Saffir-Simpson."""
    if kt >= 137:
        return "Categoría 5", "Huracán categoría 5"
    if kt >= 113:
        return "Categoría 4", "Huracán categoría 4"
    if kt >= 96:
        return "Categoría 3", "Huracán categoría 3"
    if kt >= 83:
        return "Categoría 2", "Huracán categoría 2"
    if kt >= 64:
        return "Categoría 1", "Huracán categoría 1"
    if kt >= 34:
        return "Tormenta tropical", "Tormenta tropical"
    return "Depresión tropical", "Depresión tropical"


def storm_word(kt: float) -> str:
    if kt >= 64:
        return "huracán"
    if kt >= 34:
        return "tormenta tropical"
    return "depresión tropical"


# ------------------------------------------------------------ forecast (TCM)

@dataclass
class Fix:
    time: datetime
    lat: float
    lon: float
    wind_kt: float
    radii34: dict = field(default_factory=dict)  # NE/SE/SW/NW en millas náuticas
    radii64: dict = field(default_factory=dict)
    label: str = ""  # "FORECAST" | "OUTLOOK" | "CURRENT"


@dataclass
class Advisory:
    storm_name: str
    storm_id: str
    adv_num: str
    issued: datetime
    current: Fix
    gust_kt: float
    pressure_mb: int
    move_dir: int
    move_kt: float
    forecasts: list[Fix]
    next_advisory: datetime | None


def _ll(lat: str, lon: str) -> tuple[float, float]:
    la = float(lat[:-1]) * (1 if lat.endswith("N") else -1)
    lo = float(lon[:-1]) * (-1 if lon.endswith("W") else 1)
    return la, lo


def _radii(block: str, kt: int) -> dict:
    m = re.search(rf"{kt} KT\.+\s*(\d+)NE\s+(\d+)SE\s+(\d+)SW\s+(\d+)NW", block)
    if not m:
        return {}
    return dict(zip(["NE", "SE", "SW", "NW"], map(int, m.groups())))


def parse_tcm(text: str) -> Advisory:
    head = re.search(r"(?:HURRICANE|TROPICAL STORM|TROPICAL DEPRESSION|POST-TROPICAL CYCLONE|POTENTIAL TROPICAL CYCLONE|REMNANTS OF)\s+([A-Z\-]+)\s+FORECAST/ADVISORY NUMBER\s+(\w+)", text)
    sid = re.search(r"\b(EP|AL|CP)(\d{2})(\d{4})\b", text)
    issued_m = re.search(r"(\d{4}) UTC \w{3} (\w{3}) (\d{1,2}) (\d{4})", text)
    hhmm, mon, day, year = issued_m.groups()
    issued = datetime(int(year), MONTHS[mon], int(day), int(hhmm[:2]), int(hhmm[2:]), tzinfo=timezone.utc)

    def at(dd: int, hhmm: str) -> datetime:
        y, m = issued.year, issued.month
        if dd < issued.day - 10:  # cambio de mes
            m += 1
            if m > 12:
                m, y = 1, y + 1
        return datetime(y, m, dd, int(hhmm[:2]), int(hhmm[2:]), tzinfo=timezone.utc)

    cm = re.search(r"CENTER LOCATED NEAR\s+([\d.]+[NS])\s+([\d.]+[EW])\s+AT\s+(\d{2})/(\d{4})Z", text)
    clat, clon = _ll(cm.group(1), cm.group(2))
    wind = re.search(r"MAX SUSTAINED WINDS\s+(\d+) KT WITH GUSTS TO\s+(\d+) KT", text)
    pres = re.search(r"MINIMUM CENTRAL PRESSURE\s+(\d+) MB", text)
    mv = re.search(r"PRESENT MOVEMENT TOWARD THE .*? OR (\d+) DEGREES AT\s+(\d+) KT", text)
    first_block = text[cm.start(): text.find("FORECAST VALID") if "FORECAST VALID" in text else len(text)]
    current = Fix(at(int(cm.group(3)), cm.group(4)), clat, clon, float(wind.group(1)), _radii(first_block, 34), _radii(first_block, 64), "CURRENT")

    forecasts: list[Fix] = []
    for m in re.finditer(r"(FORECAST|OUTLOOK) VALID (\d{2})/(\d{4})Z\s+(?:([\d.]+[NS])\s+([\d.]+[EW]))?(.*?)(?=(?:FORECAST|OUTLOOK) VALID|EXTENDED OUTLOOK|REQUEST FOR|NEXT ADVISORY|\$\$|$)", text, re.S):
        kind, dd, hm, la, lo, block = m.groups()
        if not la:
            continue  # DISSIPATED
        wm = re.search(r"MAX WIND\s+(\d+) KT", block)
        lat, lon = _ll(la, lo)
        forecasts.append(Fix(at(int(dd), hm), lat, lon, float(wm.group(1)) if wm else 0.0, _radii(block, 34), _radii(block, 64), kind))

    nm = re.search(r"NEXT ADVISORY AT (\d{2})/(\d{4})Z", text)
    return Advisory(
        storm_name=(head.group(1).title() if head else "Ciclón"),
        storm_id=(sid.group(0).lower() if sid else ""),
        adv_num=(head.group(2) if head else ""),
        issued=issued,
        current=current,
        gust_kt=float(wind.group(2)),
        pressure_mb=int(pres.group(1)) if pres else 0,
        move_dir=int(mv.group(1)) if mv else 0,
        move_kt=float(mv.group(2)) if mv else 0.0,
        forecasts=forecasts,
        next_advisory=at(int(nm.group(1)), nm.group(2)) if nm else None,
    )


# --------------------------------------------- aviso público en español (TAS)

@dataclass
class PublicInfo:
    adv_num: str = ""
    issued_text: str = ""
    lat: float | None = None
    lon: float | None = None
    wind_kmh: int | None = None
    warnings: dict = field(default_factory=dict)  # tipo → [zonas]
    rain: list = field(default_factory=list)  # [(min_in, max_in, max_total_in|None, texto_estados)]
    surf: bool = False
    surge: bool = False
    next_text: str = ""


WW_HEADS = {
    "Un Aviso de Huracán": "HWR",
    "Una Vigilancia de Huracán": "HWA",
    "Un Aviso de Tormenta Tropical": "TWR",
    "Una Vigilancia de Tormenta Tropical": "TWA",
}


def parse_tas(text: str) -> PublicInfo:
    info = PublicInfo()
    m = re.search(r"(?:Advertencia|Aviso)(?: Intermedia)? Número\s+(\w+)", text)
    info.adv_num = m.group(1) if m else ""
    m = re.search(r"^(\d{3,4} [AP]M \w+ .+?\d{4})\s*$", text, re.M)
    info.issued_text = m.group(1).strip() if m else ""
    m = re.search(r"UBICACIÓN\.+\s*([\d.]+)N\s+([\d.]+)W", text)
    if m:
        info.lat, info.lon = float(m.group(1)), -float(m.group(2))
    m = re.search(r"VIENTOS MÁXIMOS SOSTENIDOS\.+.*?(\d+) KM/H", text)
    if m:
        info.wind_kmh = int(m.group(1))

    summary = text.split("RESUMEN DE VIGILANCIAS Y AVISOS EN EFECTO", 1)[-1].split("DISCUSIÓN", 1)[0]
    current = None
    in_bullet = False  # la línea anterior era parte de una zona (*)
    for line in summary.splitlines():
        s = line.strip()
        head_code = next((code for head, code in WW_HEADS.items() if s.startswith(head) and "está en efecto" in s), None)
        if head_code:
            current = head_code
            info.warnings.setdefault(current, [])
            in_bullet = False
        elif s.startswith("*") and current:
            info.warnings[current].append(s.lstrip("* ").strip())
            in_bullet = True
        elif s and in_bullet and current:
            info.warnings[current][-1] += " " + s  # continuación de la zona
        else:
            in_bullet = False

    rain = re.search(r"LLUVIA:(.*?)(?:\n\s*\n[A-ZÁÉÍÓÚ ]+:|MAREJADA|OLEAJE|PRÓXIMA)", text, re.S)
    if rain:
        body = " ".join(rain.group(1).split())
        for pm in re.finditer(r"de (\d+) a (\d+) pulgadas(?: con totales (?:más altos |más altos aislados )?(?:aislados )?alrededor de (\d+) pulgadas)?(.*?)(?:\.|$)", body):
            info.rain.append((int(pm.group(1)), int(pm.group(2)), int(pm.group(3)) if pm.group(3) else None, pm.group(4)))
    info.surf = "OLEAJE:" in text
    info.surge = "MAREJADA CICLÓNICA:" in text
    m = re.search(r"Próxima advertencia (?:completa |intermedia )?a las ([^.\n]+)", text)
    info.next_text = m.group(0).strip() if m else ""
    return info


# --------------------------------------------------------------------- KMZ

def kml_from_kmz(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".kml"))
        return z.read(name).decode("utf-8", "replace")


def _coords(text: str) -> list[list[float]]:
    out = []
    for p in text.split():
        parts = p.split(",")
        if len(parts) >= 2:
            out.append([float(parts[0]), float(parts[1])])
    return out


def parse_cone_kml(kml: str) -> list[list[float]]:
    root = ET.fromstring(kml)
    cs = [c.text for c in root.iter() if c.tag.endswith("coordinates") and c.text]
    return _coords(cs[0]) if cs else []


def parse_ww_kml(kml: str) -> list[dict]:
    root = ET.fromstring(kml)
    out = []
    for pm in root.iter():
        if not pm.tag.endswith("Placemark"):
            continue
        style = next((e.text for e in pm.iter() if e.tag.endswith("styleUrl")), "") or ""
        for c in pm.iter():
            if c.tag.endswith("coordinates") and c.text:
                out.append({"type": style.lstrip("#")[:3], "coords": _coords(c.text)})
    return out


# ------------------------------------------------------------- análisis

def interpolate_track(adv: Advisory, step_h: float = 1.0) -> list[Fix]:
    pts = [adv.current] + adv.forecasts
    out: list[Fix] = []
    for a, b in zip(pts, pts[1:]):
        hours = (b.time - a.time).total_seconds() / 3600
        n = max(1, int(hours / step_h))
        for i in range(n):
            f = i / n
            out.append(Fix(a.time + (b.time - a.time) * f, a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f,
                           a.wind_kt + (b.wind_kt - a.wind_kt) * f, a.radii34 if f < 0.5 else b.radii34, {}, "I"))
    out.append(pts[-1])
    return out


def closest_approach(adv: Advisory, place=PV) -> tuple[Fix, float]:
    best = min(interpolate_track(adv), key=lambda f: haversine_km((f.lat, f.lon), place))
    return best, haversine_km((best.lat, best.lon), place)


def quadrant_toward(center: tuple[float, float], place: tuple[float, float]) -> str:
    b = bearing_deg(center, place)
    if b < 90:
        return "NE"
    if b < 180:
        return "SE"
    if b < 270:
        return "SW"
    return "NW"


def point_segment_km(p, a, b) -> float:
    """Distancia aproximada (km) de p (lat,lon) al segmento a-b (lon,lat KML)."""
    k = math.cos(math.radians(p[0]))
    ax, ay = a[0] * k, a[1]
    bx, by = b[0] * k, b[1]
    px, py = p[1] * k, p[0]
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return haversine_km((py, px / k), (qy, qx / k))


def place_status(ww: list[dict], place=PV, max_km: float = 60) -> str | None:
    """Tipo de aviso/vigilancia más fuerte que cubre el lugar (o None)."""
    # El tramo de costa MÁS CERCANO decide (los tramos se tocan en los
    # puntos de corte: Vallarta queda a ~50 km del final del aviso de
    # huracán en Cabo Corrientes, pero dentro del de tormenta tropical).
    order = ["HWR", "HWA", "TWR", "TWA"]
    best: dict[str, float] = {}
    for seg in ww:
        c = seg["coords"]
        for a, b in zip(c, c[1:]):
            d = point_segment_km(place, a, b)
            best[seg["type"]] = min(best.get(seg["type"], 1e9), d)
    if not best:
        return None
    dmin = min(best.values())
    if dmin > max_km:
        return None
    near = [t for t in order if t in best and best[t] <= dmin + 5]
    return near[0] if near else None


def point_in_poly(lon: float, lat: float, poly: list[list[float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def is_relevant(adv: Advisory, cone: list, ww: list, place=PV) -> tuple[bool, str]:
    """¿Vale la pena publicar video para Vallarta?"""
    if place_status(ww, place, 120):
        return True, "aviso o vigilancia cerca de Vallarta"
    if cone and point_in_poly(place[1], place[0], cone):
        return True, "Vallarta dentro del cono"
    _, d = closest_approach(adv, place)
    if d <= 450:
        return True, f"paso a {d:.0f} km"
    return False, f"lejos ({d:.0f} km)"


# ------------------------------------------------------------- descarga

def active_storms() -> list[dict]:
    data = json.loads(fetch("/CurrentStorms.json"))
    return [s for s in data.get("activeStorms", []) if s.get("binNumber", "").startswith("EP")]


def load_storm(storm: dict) -> dict:
    """Descarga todo lo necesario de un ciclón activo del Pacífico Este."""
    tcm = parse_tcm(pre_text(fetch(storm["forecastAdvisory"]["url"])))
    n = storm["binNumber"][-1]
    try:
        tas = parse_tas(pre_text(fetch(f"/text/MIATASEP{n}.shtml")))
    except Exception:  # noqa: BLE001 — sin aviso en español, se sigue con el resto
        tas = PublicInfo()
    cone, ww = [], []
    try:
        cone = parse_cone_kml(kml_from_kmz(fetch(storm["trackCone"]["kmzFile"], binary=True)))
    except Exception:  # noqa: BLE001
        pass
    try:
        ww = parse_ww_kml(kml_from_kmz(fetch(storm["windWatchesWarnings"]["kmzFile"], binary=True)))
    except Exception:  # noqa: BLE001
        pass
    return {"tcm": tcm, "tas": tas, "cone": cone, "ww": ww, "raw": storm}
