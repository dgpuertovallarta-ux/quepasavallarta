"""Video de tráfico de Qué Pasa Vallarta («QPV al Volante»), 2026-11-06.

Arma un video vertical (1080x1920) con voz de mujer (es-MX), música propia y el
mapa de Vallarta con el tráfico real de TomTom (mosaicos de mapa + flujo). Dos tipos:

  resumen   7 a. m., 2 p. m. y 6 p. m.: mapa general, los corredores más lentos,
            accidentes y cierres, y la invitación a reportar.
  urgente   accidente en un corredor principal: mapa acercado al lugar con el
            punto marcado, qué pasó y la recomendación de buscar rutas alternas.

Uso:
  python scripts/traffic-video/generate.py --payload datos.json --out out

`datos.json` lo arma el robot (src/lib/trafico/videoTrafico.ts). Deja en out/:
video.mp4, story.json (key, title, caption para Facebook) y portada.jpg.
Sin TOMTOM_API_KEY o sin red, el mapa sale dibujado con la costa (sin flujo).
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import subprocess
import sys
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
HV = os.path.join(HERE, "..", "hurricane-video")
sys.path.insert(0, HV)
import audio  # noqa: E402  (voz edge-tts + música propia, la misma de los videos de ciclón)

A = os.path.join(HV, "assets")
W, H = 1080, 1920
FPS = 30
TZ = ZoneInfo("America/Mexico_City")

NAVY = (8, 16, 38)
WHITE = (255, 255, 255)
YELLOW = (255, 210, 0)
RED = (232, 35, 52)
ORANGE = (255, 140, 0)
GREEN = (40, 200, 110)
GRAY = (150, 160, 180)
SEM = {"fluido": GREEN, "lento": ORANGE, "pesado": RED}
TIPO = {
    "accidente": ("ACCIDENTE", RED),
    "cierre": ("CIERRE", ORANGE),
    "obra": ("OBRA", YELLOW),
    "inundacion": ("INUNDACIÓN", (60, 150, 255)),
    "carril": ("CARRIL CERRADO", YELLOW),
    "congestion": ("TRÁFICO", ORANGE),
}

# Área del mapa general: de Bucerías a Mismaloya.
BBOX = (-105.36, 20.55, -105.18, 20.78)  # minLon, minLat, maxLon, maxLat


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(A, "fonts", name), size)


F_BLACK = "SofiaSansXC-Black.ttf"
F_SEMI = "WorkSans-SemiBold.ttf"
F_REG = "WorkSans-Regular.ttf"


# ------------------------------------------------------------------ mapa base

def _tile_xy(lon: float, lat: float, z: int) -> tuple[float, float]:
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def _get(url: str) -> bytes | None:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "QPV-Robot/1.0"}), timeout=20) as r:
            return r.read()
    except Exception as e:  # sin red / llave → mapa de respaldo
        cuerpo = ""
        if hasattr(e, "read"):
            try:
                cuerpo = e.read().decode("utf-8", "replace")[:200]
            except Exception:
                pass
        print("mosaico falló:", str(e)[:120], url.split("?")[0][-60:], cuerpo)
        return None


@dataclass
class Mapa:
    img: Image.Image
    z: int
    x0: float  # esquina superior izquierda en coordenadas de mosaico
    y0: float
    tomtom: bool

    def px(self, lat: float, lon: float) -> tuple[float, float]:
        x, y = _tile_xy(lon, lat, self.z)
        return (x - self.x0) * 256, (y - self.y0) * 256


def mapa_tomtom(bbox, z: int) -> Mapa | None:
    key = os.environ.get("TOMTOM_API_KEY")
    if not key:
        return None
    x0, y1 = _tile_xy(bbox[0], bbox[1], z)
    x1, y0 = _tile_xy(bbox[2], bbox[3], z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    img = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), NAVY)
    ok = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            base = _get(f"https://api.tomtom.com/map/1/tile/basic/night/{z}/{tx}/{ty}.png?key={key}&tileSize=256")
            if not base:
                continue
            t = Image.open(io.BytesIO(base)).convert("RGBA")
            # thickness solo lo aceptan algunos estilos (TomTom contesta 400 con relative0-dark).
            for estilo, extra in (("relative0-dark", ""), ("relative", "&thickness=8")):
                flujo = _get(f"https://api.tomtom.com/traffic/map/4/tile/flow/{estilo}/{z}/{tx}/{ty}.png?key={key}{extra}")
                if flujo:
                    f = Image.open(io.BytesIO(flujo)).convert("RGBA")
                    t.alpha_composite(f)
                    break
            img.paste(t.convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))
            ok += 1
    if not ok:
        return None
    return Mapa(img, z, tx0, ty0, True)


def mapa_respaldo(bbox) -> Mapa:
    """Sin TomTom: fondo azul noche con la costa (de los videos de ciclón)."""
    z = 12
    x0, y1 = _tile_xy(bbox[0], bbox[1], z)
    x1, y0 = _tile_xy(bbox[2], bbox[3], z)
    tx0, ty0 = int(x0), int(y0)
    w, h = (int(x1) - tx0 + 1) * 256, (int(y1) - ty0 + 1) * 256
    img = Image.new("RGB", (w, h), (14, 40, 70))
    m = Mapa(img, z, tx0, ty0, False)
    d = ImageDraw.Draw(img)
    coast = json.load(open(os.path.join(A, "coast.json")))
    pts = [m.px(lat, lon) for lon, lat in coast if -105.7 < lon < -104.9 and 20.3 < lat < 21.0]
    pts.sort(key=lambda p: p[1])
    # tierra al este de la línea de costa
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        d.polygon([(xa, ya), (xb, yb), (w, yb), (w, ya)], fill=(34, 38, 48))
    return m


def preparar_mapa(bbox, z: int) -> Mapa:
    return mapa_tomtom(bbox, z) or mapa_respaldo(bbox)


_MAPAS: dict = {}


def mapa_para(lat: float, lon: float, span_lat: float) -> tuple[Mapa, float]:
    """Mapa (en caché) que cubre un área de `span_lat` grados de alto centrada en (lat, lon).
    Devuelve el mapa y el ancho en píxeles de mapa que corresponde a la vista 9:16."""
    span_lat = max(span_lat, 0.012)
    span_lon = span_lat * W / H / math.cos(math.radians(lat))
    z = 15 if span_lat < 0.03 else 14 if span_lat < 0.07 else 13
    bbox = (lon - span_lon * 0.75, lat - span_lat * 0.75, lon + span_lon * 0.75, lat + span_lat * 0.75)
    clave = (round(lat, 3), round(lon, 3), round(span_lat, 3), z)
    if clave not in _MAPAS:
        _MAPAS[clave] = preparar_mapa(bbox, z)
    m = _MAPAS[clave]
    x0, _ = m.px(lat, lon - span_lon / 2)
    x1, _ = m.px(lat, lon + span_lon / 2)
    return m, abs(x1 - x0)


def vista(m: Mapa, lat: float, lon: float, ancho: float, frac_y: float = 0.5):
    """Recorte 9:16 de `ancho` px de mapa con (lat, lon) a la altura `frac_y` de la
    pantalla (0.36 = arriba de la tarjeta), escalado a WxH, y la función que
    convierte (lat, lon) a píxeles de pantalla."""
    cx, cy = m.px(lat, lon)
    alto = ancho * H / W
    x0 = min(max(0, cx - ancho / 2), max(0, m.img.width - ancho))
    y0 = min(max(0, cy - alto * frac_y), max(0, m.img.height - alto))
    img = m.img.crop((int(x0), int(y0), int(x0 + ancho), int(y0 + alto))).resize((W, H), Image.LANCZOS)

    def a_pantalla(la, lo):
        px, py = m.px(la, lo)
        return (px - int(x0)) * W / ancho, (py - int(y0)) * H / alto

    return img, a_pantalla


def caja(linea, lat, lon):
    if not linea or len(linea) < 2:
        return lat, lon, 0.03  # solo un punto: se ve el barrio alrededor
    pts = linea
    las = [p[0] for p in pts]
    los = [p[1] for p in pts]
    clat, clon = (min(las) + max(las)) / 2, (min(los) + max(los)) / 2
    span = max(max(las) - min(las), (max(los) - min(los)) * H / W * math.cos(math.radians(clat)))
    return clat, clon, span * 2.4 + 0.008  # la línea cabe arriba de la tarjeta


# ------------------------------------------------------------------ escenas

@dataclass
class Scene:
    kind: str
    voice: str
    dur: float = 3.0
    data: dict = field(default_factory=dict)


def hora_texto(dt: datetime) -> tuple[str, str]:
    h, mi = dt.hour, dt.minute
    h12 = h % 12 or 12
    parte = "de la mañana" if h < 12 else "de la tarde" if h < 19 else "de la noche"
    corta = f"{h12}:{mi:02d} {'AM' if h < 12 else 'PM'}"
    voz = f"{h12} {parte}" if mi == 0 else f"{h12} y {mi} {parte}"
    return corta, voz


def nombre_voz(n: str) -> str:
    n = n.replace("Francisco Medina Ascencio", "Medina Ascencio").replace("Av.", "avenida").replace("Blvd.", "bulevar")
    n = n.replace("Prol.", "prolongación").replace("Carr.", "carretera").replace("→", "rumbo a")
    n = n.replace(" (", ", ").replace("(", "").replace(")", "")
    return " ".join(n.split())


def color_foco(f: dict):
    if f["tipo"] == "congestion":
        return RED if f.get("retrasoMin", 0) >= 8 or f.get("magnitud", 0) >= 3 else ORANGE
    return TIPO.get(f["tipo"], ("", ORANGE))[1]


def etiqueta_foco(f: dict) -> str:
    if f["tipo"] == "congestion":
        return "TRÁFICO PESADO" if color_foco(f) == RED else "TRÁFICO LENTO"
    return TIPO.get(f["tipo"], ("AVISO", YELLOW))[0]


def voz_foco(f: dict) -> str:
    calle = nombre_voz(f["calle"])
    donde = calle + (f", rumbo a {nombre_voz(f['hacia'])}" if f.get("hacia") else "") + (f", en {f['zona']}" if f.get("zona") else "")
    r = f.get("retrasoMin", 0)
    km = f.get("largoKm", 0)
    if f["tipo"] == "congestion":
        nivel = "pesado" if color_foco(f) == RED else "lento"
        extra = f": unos {r} minutos de retraso" if r >= 1 else ""
        extra += f" en {str(km).replace('.0', '')} kilómetros" if km >= 0.5 and extra else ""
        return f"En {donde} hay tráfico {nivel}{extra}."
    if f["tipo"] == "accidente":
        return f"En {donde} se reporta un accidente" + (f"; el retraso es de unos {r} minutos." if r >= 1 else ".")
    if f["tipo"] == "cierre":
        return f"Hay un cierre en {donde}. Busca una ruta alterna."
    if f["tipo"] in ("obra", "carril"):
        return f"Obras en {donde} reducen la circulación" + (f"; unos {r} minutos de retraso." if r >= 1 else ".")
    return f"Encharcamiento en {donde}. Maneja con precaución."


def guion_resumen(p: dict) -> list[Scene]:
    dt = datetime.fromisoformat(p["hora"]).astimezone(TZ)
    corta, voz_h = hora_texto(dt)
    focos = list(p.get("focos", []))[:3]
    corr = sorted(p.get("corredores", []), key=lambda c: -c["retrasoMin"])
    if not focos:
        # Sin embotellamientos reportados: los corredores medidos que vayan lentos, con su ruta real.
        for c in corr:
            if c["nivel"] != "fluido" and c.get("ruta"):
                focos.append({"tipo": "congestion", "calle": c["nombre"].split("(")[0].strip(), "hacia": "",
                              "zona": "", "retrasoMin": c["retrasoMin"], "largoKm": 0,
                              "magnitud": 3 if c["nivel"] == "pesado" else 2,
                              "lat": c["ruta"][len(c["ruta"]) // 2][0], "lon": c["ruta"][len(c["ruta"]) // 2][1], "linea": c["ruta"]})
        focos = focos[:2]
    s = [Scene("intro", f"Así va el tráfico en Puerto Vallarta a las {voz_h}.", 2.6, {"hora": corta})]
    if focos:
        nombres = list(dict.fromkeys(nombre_voz(f["calle"]) for f in focos))
        lista = nombres[0] if len(nombres) == 1 else ", ".join(nombres[:-1]) + " y " + nombres[-1]
        s.append(Scene("mapa", f"Donde hay más tráfico ahora: {lista}.", 4.0, {"focos": focos}))
        for k, f in enumerate(focos):
            s.append(Scene("foco", voz_foco(f), 3.6, {"f": f, "n": k + 1}))
    else:
        s.append(Scene("mapa", "Las principales vialidades circulan con fluidez.", 3.5, {"focos": []}))
        if corr:
            s.append(Scene("fluido", "Buen momento para salir: no hay retrasos importantes en las avenidas principales.", 3.0, {"corr": corr[:5]}))
    s.append(Scene("outro", "¿Ves algo en el camino? Repórtalo en que pasa v t a punto com.", 3.0))
    return s


def guion_urgente(p: dict) -> list[Scene]:
    u = p["urgente"]
    dt = datetime.fromisoformat(p["hora"]).astimezone(TZ)
    corta, _ = hora_texto(dt)
    lugar = nombre_voz(u["calle"]) + (f", a la altura de {nombre_voz(u['cruce'])}" if u.get("cruce") else "") + (f", en {u['zona']}" if u.get("zona") else "")
    return [
        Scene("urg_intro", f"Atención: se reporta un {u.get('tipoTexto', 'accidente')} en {nombre_voz(u['calle'])}.", 2.8, {"hora": corta, "u": u}),
        Scene("urg_mapa", f"Es en {lugar}." + (f" Hay un retraso de unos {u['retrasoMin']} minutos." if u.get("retrasoMin") else ""), 4.0, {"u": u}),
        Scene("urg_consejo", "Maneja con precaución y, si puedes, busca una ruta alterna.", 3.0, {"u": u}),
        Scene("outro", "Te seguimos informando en Qué Pasa Vallarta.", 2.6),
    ]


# ------------------------------------------------------------------ dibujo

def texto_centrado(d: ImageDraw.ImageDraw, y: int, t: str, f, fill=WHITE, max_w: int = W - 120) -> int:
    lineas, linea = [], ""
    for p in t.split():
        prueba = (linea + " " + p).strip()
        if d.textlength(prueba, font=f) <= max_w:
            linea = prueba
        else:
            lineas.append(linea)
            linea = p
    lineas.append(linea)
    for l in lineas:
        w = d.textlength(l, font=f)
        d.text(((W - w) / 2, y), l, font=f, fill=fill)
        y += int(f.size * 1.08)
    return y


def oscurecer(img: Image.Image, a: float) -> Image.Image:
    return Image.blend(img, Image.new("RGB", img.size, NAVY), a)


def barra_progreso(d, t_total: float, t: float):
    d.rectangle((40, 40, W - 40, 48), fill=(255, 255, 255, 60))
    d.rectangle((40, 40, 40 + (W - 80) * min(1, t / t_total), 48), fill=YELLOW)


def pin(d, x, y, color, r=22, pulso=0.0, texto=""):
    if pulso:
        rr = r + 30 * pulso
        d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=color + (int(200 * (1 - pulso)),), width=6)
    d.ellipse((x - r, y - r, x + r, y + r), fill=color, outline=WHITE, width=5)
    if texto:
        f = font(F_BLACK, int(r * 1.3))
        w = d.textlength(texto, font=f)
        d.text((x - w / 2, y - r * 0.78), texto, font=f, fill=WHITE)


def trazo(d, pts, color, avance=1.0, ancho=16):
    """Dibuja el tramo afectado (con borde blanco) hasta el `avance` (0..1)."""
    if len(pts) < 2:
        return
    n = max(2, int(round(len(pts) * min(1.0, avance))))
    tramo = pts[:n]
    d.line(tramo, fill=(255, 255, 255, 230), width=ancho + 10, joint="curve")
    d.line(tramo, fill=color + (255,), width=ancho, joint="curve")


class Render:
    def __init__(self, p: dict, scenes: list[Scene]):
        self.p = p
        self.scenes = scenes
        self.logo = Image.open(os.path.join(A, "logo.png")).convert("RGBA")
        self.logo.thumbnail((220, 220))
        # Mapa general: Vallarta y, si un foco queda afuera (Punta Mita, Sayulita), se abre para incluirlo.
        las = [BBOX[1], BBOX[3]] + [f["lat"] for s0 in scenes for f in s0.data.get("focos", [])]
        los = [BBOX[0], BBOX[2]] + [f["lon"] for s0 in scenes for f in s0.data.get("focos", [])]
        self.clat, self.clon = (min(las) + max(las)) / 2 + 0.005, (min(los) + max(los)) / 2
        span = max(max(las) - min(las), (max(los) - min(los)) * H / W * math.cos(math.radians(self.clat)))
        self.general, self.ancho_general = mapa_para(self.clat, self.clon, span * 0.95)
        self.tomtom = self.general.tomtom
        # mapas acercados (se piden una sola vez)
        self.zoom = {}
        for s in scenes:
            f = s.data.get("f") or s.data.get("u")
            if f is not None and id(f) not in self.zoom:
                clat, clon, span = caja(f.get("linea"), f["lat"], f["lon"])
                self.zoom[id(f)] = (mapa_para(clat, clon, span), clat, clon)
                self.tomtom = self.tomtom or self.zoom[id(f)][0][0].tomtom
        self.f_big = font(F_BLACK, 150)
        self.f_mid = font(F_BLACK, 92)
        self.f_sm = font(F_SEMI, 46)
        self.f_xs = font(F_REG, 34)

    def marca(self, img: Image.Image, t: float, total: float):
        img = img.convert("RGBA")
        d = ImageDraw.Draw(img, "RGBA")
        barra_progreso(d, total, t)
        img.alpha_composite(self.logo, (W - self.logo.width - 40, 70))
        fuente = "Mapa y tráfico: © TomTom" if self.tomtom else "Datos: TomTom"
        d.text((40, H - 60), fuente, font=self.f_xs, fill=(255, 255, 255, 170))
        return img.convert("RGB")

    def _general(self, escala=1.0, oscuro=0.0):
        img, conv = vista(self.general, self.clat, self.clon, self.ancho_general * escala)
        return (oscurecer(img, oscuro) if oscuro else img), conv

    def _zoom(self, f, escala=1.0, oscuro=0.0, frac_y=0.36):
        (m, ancho), clat, clon = self.zoom[id(f)]
        img, conv = vista(m, clat, clon, ancho * escala, frac_y)
        return (oscurecer(img, oscuro) if oscuro else img), conv

    def tarjeta(self, d, f, y0=1250):
        col = color_foco(f)
        d.rectangle((0, y0, W, 1740), fill=NAVY + (232,))
        d.rectangle((0, y0, 22, 1740), fill=col)
        et = etiqueta_foco(f)
        d.rounded_rectangle((70, y0 + 34, 70 + d.textlength(et, font=self.f_sm) + 50, y0 + 104), 14, fill=col)
        d.text((95, y0 + 42), et, font=self.f_sm, fill=WHITE)
        y = texto_centrado(d, y0 + 128, f["calle"].upper(), font(F_BLACK, 78 if len(f["calle"]) > 22 else 90), WHITE)
        sub = " · ".join(x for x in (f"hacia {f['hacia']}" if f.get("hacia") else "", f.get("zona", "")) if x)
        if sub:
            y = texto_centrado(d, y, sub, self.f_sm, YELLOW)
        partes = []
        if f.get("retrasoMin", 0) >= 1:
            partes.append(f"+{f['retrasoMin']} min")
        if f.get("largoKm", 0) >= 0.3:
            partes.append(f"{str(f['largoKm']).replace('.0', '')} km")
        if partes:
            texto_centrado(d, y + 6, "  ·  ".join(partes), font(F_BLACK, 96), col)

    def frame(self, s: Scene, u: float, t: float, total: float) -> Image.Image:
        """u = avance dentro de la escena (0..1)."""
        if s.kind == "intro":
            img, _ = self._general(1.1 - 0.05 * u, 0.55)
            d = ImageDraw.Draw(img, "RGBA")
            d.text((70, 560), "QPV AL VOLANTE", font=self.f_sm, fill=YELLOW)
            y = 630
            for l in ("ASÍ VA EL", "TRÁFICO"):
                d.text((64, y), l, font=self.f_big, fill=WHITE)
                y += 150
            d.rectangle((70, y + 30, 70 + 520, y + 120), fill=RED)
            d.text((96, y + 40), f"VALLARTA · {s.data['hora']}", font=self.f_sm, fill=WHITE)
        elif s.kind == "mapa":
            img, conv = self._general(1.0 - 0.15 * u)
            d = ImageDraw.Draw(img, "RGBA")
            for q in self.p.get("puntos", [])[:10]:
                x, y = conv(q["lat"], q["lon"])
                if 0 < x < W and 0 < y < H:
                    pin(d, x, y, TIPO.get(q["tipo"], ("", YELLOW))[1], 12)
            for k, f in enumerate(s.data["focos"]):
                if f.get("linea"):
                    trazo(d, [conv(a, b) for a, b in f["linea"]], color_foco(f), min(1, u * 2.2), 12)
                x, y = conv(f["lat"], f["lon"])
                pin(d, x, y, color_foco(f), 30, (t * 0.8) % 1, str(k + 1))
            d.rectangle((0, 140, W, 300), fill=NAVY + (215,))
            d.text((60, 160), "EN VIVO", font=self.f_sm, fill=RED)
            d.text((60, 210), "Donde hay más tráfico" if s.data["focos"] else "Tráfico ahora en Vallarta", font=self.f_sm, fill=WHITE)
            self._leyenda(d)
        elif s.kind == "foco":
            f = s.data["f"]
            img, conv = self._zoom(f, 1.08 - 0.12 * u, 0.1)
            d = ImageDraw.Draw(img, "RGBA")
            if f.get("linea"):
                trazo(d, [conv(a, b) for a, b in f["linea"]], color_foco(f), min(1, 0.15 + u * 1.8), 18)
            x, y = conv(f["lat"], f["lon"])
            pin(d, x, y, color_foco(f), 30, (t * 0.9) % 1, str(s.data["n"]))
            self.tarjeta(d, f)
        elif s.kind == "fluido":
            img, _ = self._general(0.82, 0.6)
            d = ImageDraw.Draw(img, "RGBA")
            d.text((70, 420), "TODO FLUYE", font=self.f_big, fill=GREEN)
            y = 640
            for c in s.data["corr"]:
                d.ellipse((70, y + 12, 104, y + 46), fill=SEM.get(c["nivel"], GREEN))
                d.text((126, y), f"{c['nombre'].replace('→', 'hacia').split('(')[0].strip()} · {c['minutos']} min", font=self.f_sm, fill=WHITE)
                y += 92
        elif s.kind in ("urg_intro", "urg_mapa", "urg_consejo"):
            uu = s.data["u"]
            esc = {"urg_intro": 1.3, "urg_mapa": 1.05 - 0.15 * u, "urg_consejo": 0.9}[s.kind]
            img, conv = self._zoom(uu, esc, 0.5 if s.kind == "urg_intro" else 0.05, 0.5 if s.kind == "urg_intro" else 0.38)
            d = ImageDraw.Draw(img, "RGBA")
            if s.kind != "urg_intro":
                if uu.get("linea"):
                    trazo(d, [conv(a, b) for a, b in uu["linea"]], RED, 1.0, 18)
                x, y = conv(uu["lat"], uu["lon"])
                pin(d, x, y, RED, 32, (t * 1.2) % 1)
            if s.kind == "urg_intro":
                parpadeo = int(t * 3) % 2 == 0
                d.rectangle((0, 520, W, 760), fill=(RED if parpadeo else (170, 20, 35)) + (240,))
                texto_centrado(d, 560, uu.get("etiqueta", "ACCIDENTE"), self.f_big, WHITE)
                texto_centrado(d, 820, uu["calle"].upper(), self.f_mid, WHITE)
                texto_centrado(d, 1060, s.data["hora"], self.f_sm, YELLOW)
            elif s.kind == "urg_mapa":
                d.rectangle((0, 1380, W, 1740), fill=NAVY + (235,))
                d.rectangle((0, 1380, 22, 1740), fill=RED)
                yy = texto_centrado(d, 1410, uu["calle"].upper(), self.f_mid, WHITE)
                sub = " · ".join(x for x in (f"a la altura de {uu['cruce']}" if uu.get("cruce") else "", uu.get("zona", "")) if x)
                if sub:
                    texto_centrado(d, yy + 10, sub, self.f_sm, YELLOW)
            else:
                d.rectangle((0, 1300, W, 1720), fill=NAVY + (235,))
                texto_centrado(d, 1340, "PRECAUCIÓN", self.f_mid, YELLOW)
                texto_centrado(d, 1460, "Busca una ruta alterna", self.f_sm, WHITE)
        else:  # outro
            img = Image.new("RGB", (W, H), NAVY)
            d = ImageDraw.Draw(img, "RGBA")
            big = Image.open(os.path.join(A, "logo.png")).convert("RGBA")
            big.thumbnail((520, 520))
            img.paste(big, ((W - big.width) // 2, 420), big)
            texto_centrado(d, 1060, "¿Ves algo en el camino?", self.f_mid, WHITE)
            texto_centrado(d, 1200, "Repórtalo en quepasavta.com/reporte", self.f_sm, YELLOW)
        return self.marca(img, t, total)

    def _leyenda(self, d):
        y = H - 190
        d.rounded_rectangle((40, y - 20, W - 40, y + 80), 18, fill=NAVY + (215,))
        x = 70
        for txt, col in (("Fluido", GREEN), ("Lento", ORANGE), ("Pesado", RED), ("Accidente", RED)):
            if txt == "Accidente":
                d.ellipse((x + 8, y + 8, x + 40, y + 40), fill=col, outline=WHITE, width=3)
            else:
                d.rectangle((x, y + 18, x + 46, y + 34), fill=col)
            d.text((x + 58, y + 4), txt, font=self.f_xs, fill=WHITE)
            x += 240


def generar(p: dict, out: str) -> dict:
    os.makedirs(out, exist_ok=True)
    scenes = guion_urgente(p) if p.get("urgente") else guion_resumen(p)
    clips = audio.prepare_voice(scenes, os.path.join(out, "voz"))
    total = sum(s.dur for s in scenes)
    starts, acc = [], 0.0
    for s in scenes:
        starts.append(acc)
        acc += s.dur
    r = Render(p, scenes)
    wav = audio.mix(scenes, starts, total, clips, os.path.join(out, "audio.wav"))
    video = os.path.join(out, "video.mp4")
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
         "-shortest", "-movflags", "+faststart", video],
        stdin=subprocess.PIPE,
    )
    n = int(total * FPS)
    portada = None
    for k in range(n):
        t = k / FPS
        i = max(j for j, st in enumerate(starts) if st <= t)
        u = (t - starts[i]) / scenes[i].dur
        img = r.frame(scenes[i], u, t, total)
        if portada is None and scenes[i].kind in ("mapa", "urg_mapa") and u > 0.6:
            portada = img
        ff.stdin.write(img.tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("ffmpeg falló")
    (portada or img).save(os.path.join(out, "portada.jpg"), quality=88)

    dt = datetime.fromisoformat(p["hora"]).astimezone(TZ)
    corta, _ = hora_texto(dt)
    if p.get("urgente"):
        u = p["urgente"]
        title = f"🔴 {u.get('etiqueta', 'ACCIDENTE')} EN {u['calle'].upper()}"
        caption = (f"{title}\n\n{scenes[0].voice} {scenes[1].voice} Maneja con precaución y busca una ruta alterna.\n\n"
                   "Dato preliminar del monitor QPV al Volante (TomTom). ¿Estás cerca? Mándanos foto o video en quepasavta.com/reporte")
        key = f"trafico-urgente-{u['id']}"
    else:
        title = f"🚦 ASÍ VA EL TRÁFICO EN VALLARTA · {corta}"
        caption = f"{title}\n\n" + " ".join(s.voice for s in scenes[1:-1]) + \
            "\n\nTráfico en vivo: quepasavta.com/trafico\n¿Ves algo en el camino? Repórtalo en quepasavta.com/reporte"
        key = f"trafico-{dt.strftime('%Y%m%d-%H')}"
    story = {"key": key, "title": title, "caption": caption, "duracion": round(total, 1), "voz": any(c is not None for c in clips), "tomtom": r.tomtom}
    json.dump(story, open(os.path.join(out, "story.json"), "w"), ensure_ascii=False, indent=2)
    return story


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    print(json.dumps(generar(json.load(open(a.payload)), a.out), ensure_ascii=False))
