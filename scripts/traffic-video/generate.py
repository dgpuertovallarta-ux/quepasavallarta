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


def recorte(m: Mapa, lat: float, lon: float, ancho_px: float) -> Image.Image:
    """Recorta el mapa centrado en (lat, lon) con proporción 9:16 y lo escala a WxH."""
    cx, cy = m.px(lat, lon)
    alto = ancho_px * H / W
    x0 = min(max(0, cx - ancho_px / 2), max(0, m.img.width - ancho_px))
    y0 = min(max(0, cy - alto / 2), max(0, m.img.height - alto))
    return m.img.crop((int(x0), int(y0), int(x0 + ancho_px), int(y0 + alto))).resize((W, H), Image.LANCZOS)


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
    n = n.replace("Francisco Medina Ascencio", "Medina Ascencio").replace("Av.", "avenida").replace("→", "rumbo a")
    n = n.replace(" (", ", ").replace("(", "").replace(")", "")
    return " ".join(n.split())


def guion_resumen(p: dict) -> list[Scene]:
    dt = datetime.fromisoformat(p["hora"]).astimezone(TZ)
    corta, voz_h = hora_texto(dt)
    corr = sorted(p.get("corredores", []), key=lambda c: -c["retrasoMin"])
    lentos = [c for c in corr if c["nivel"] != "fluido" and c["retrasoMin"] >= 2]
    incs = [i for i in p.get("incidentes", []) if not i.get("soloMapa") and i["tipo"] in ("accidente", "cierre", "inundacion", "obra")][:3]
    s = [Scene("intro", f"Así va el tráfico en Puerto Vallarta a las {voz_h}.", 2.6, {"hora": corta})]
    if lentos:
        nombres = " y ".join(dict.fromkeys(nombre_voz(c["nombre"]).split(",")[0] for c in lentos[:2]))
        general = f"Hay tráfico lento en {nombres}. El resto circula con normalidad."
    else:
        general = "Las principales vialidades circulan con fluidez."
    s.append(Scene("mapa", general, 4.0, {"hora": corta}))
    for c in lentos[:3]:
        v = f"En {nombre_voz(c['nombre'])}, el trayecto toma {c['minutos']} minutos, {c['retrasoMin']} más de lo normal."
        s.append(Scene("corredor", v, 3.2, {"c": c}))
    if not lentos and corr:
        s.append(Scene("fluido", "Buen momento para salir: no hay retrasos importantes en los corredores que medimos.", 3.0, {"corr": corr[:5]}))
    if incs:
        partes = []
        for i in incs:
            et = {"accidente": "un accidente", "cierre": "un cierre", "obra": "obras", "inundacion": "encharcamiento"}[i["tipo"]]
            partes.append(f"{et} en {nombre_voz(i['calle'])}")
        s.append(Scene("incidentes", "Toma en cuenta: " + ", ".join(partes) + ".", 3.5, {"incs": incs}))
    s.append(Scene("outro", "¿Ves algo en el camino? Repórtalo en que pasa v t a punto com.", 3.0))
    return s


def guion_urgente(p: dict) -> list[Scene]:
    u = p["urgente"]
    dt = datetime.fromisoformat(p["hora"]).astimezone(TZ)
    corta, _ = hora_texto(dt)
    lugar = nombre_voz(u["calle"]) + (f", a la altura de {nombre_voz(u['cruce'])}" if u.get("cruce") else "")
    s = [
        Scene("urg_intro", f"Atención: se reporta un {u.get('tipoTexto', 'accidente')} en {nombre_voz(u['calle'])}.", 2.8, {"hora": corta, "u": u}),
        Scene("urg_mapa", f"Es en {lugar}." + (f" Hay un retraso de unos {u['retrasoMin']} minutos." if u.get("retrasoMin") else ""), 4.0, {"u": u}),
        Scene("urg_consejo", "Maneja con precaución y, si puedes, busca una ruta alterna.", 3.0, {"u": u}),
        Scene("outro", "Te seguimos informando en Qué Pasa Vallarta.", 2.6),
    ]
    return s


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


def pin(d, x, y, color, r=22, pulso=0.0):
    if pulso:
        rr = r + 30 * pulso
        d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=color + (int(200 * (1 - pulso)),), width=6)
    d.ellipse((x - r, y - r, x + r, y + r), fill=color, outline=WHITE, width=5)


class Render:
    def __init__(self, p: dict, scenes: list[Scene]):
        self.p = p
        self.scenes = scenes
        self.logo = Image.open(os.path.join(A, "logo.png")).convert("RGBA")
        self.logo.thumbnail((220, 220))
        urg = p.get("urgente")
        if urg:
            self.mapa = preparar_mapa((urg["lon"] - 0.035, urg["lat"] - 0.05, urg["lon"] + 0.035, urg["lat"] + 0.05), 15)
        else:
            self.mapa = preparar_mapa(BBOX, 13)
        self.f_big = font(F_BLACK, 150)
        self.f_mid = font(F_BLACK, 92)
        self.f_sm = font(F_SEMI, 46)
        self.f_xs = font(F_REG, 34)

    def fondo(self, lat, lon, ancho, oscuro=0.0):
        img = recorte(self.mapa, lat, lon, ancho)
        return oscurecer(img, oscuro) if oscuro else img

    def marca(self, img: Image.Image, t: float, total: float):
        img = img.convert("RGBA")
        d = ImageDraw.Draw(img, "RGBA")
        barra_progreso(d, total, t)
        img.alpha_composite(self.logo, (W - self.logo.width - 40, 70))
        fuente = "Mapa y tráfico: © TomTom" if self.mapa.tomtom else "Datos: TomTom"
        d.text((40, H - 60), fuente, font=self.f_xs, fill=(255, 255, 255, 170))
        return img.convert("RGB")

    def frame(self, s: Scene, u: float, t: float, total: float) -> Image.Image:
        """u = avance dentro de la escena (0..1)."""
        cx_lat, cx_lon = (BBOX[1] + BBOX[3]) / 2, (BBOX[0] + BBOX[2]) / 2
        ancho_general = self.mapa.img.width * 0.62
        if s.kind == "intro":
            img = self.fondo(cx_lat, cx_lon, ancho_general * (1.1 - 0.05 * u), 0.55)
            d = ImageDraw.Draw(img, "RGBA")
            d.text((70, 560), "QPV AL VOLANTE", font=self.f_sm, fill=YELLOW)
            y = 630
            for l in ("ASÍ VA EL", "TRÁFICO"):
                d.text((64, y), l, font=self.f_big, fill=WHITE)
                y += 150
            d.rectangle((70, y + 30, 70 + 520, y + 120), fill=RED)
            d.text((96, y + 40), f"VALLARTA · {s.data['hora']}", font=self.f_sm, fill=WHITE)
        elif s.kind == "mapa":
            img = self.fondo(cx_lat, cx_lon, ancho_general * (1.0 - 0.18 * u), 0.0)
            d = ImageDraw.Draw(img, "RGBA")
            self._pins(d, img_ancho=ancho_general * (1.0 - 0.18 * u), clat=cx_lat, clon=cx_lon, t=t)
            d.rectangle((0, 140, W, 300), fill=NAVY + (215,))
            d.text((60, 160), "EN VIVO", font=self.f_sm, fill=RED)
            d.text((60, 210), "Tráfico ahora en Vallarta", font=self.f_sm, fill=WHITE)
            self._leyenda(d)
        elif s.kind == "corredor":
            c = s.data["c"]
            lat = (c["origen"][0] + c["destino"][0]) / 2
            lon = (c["origen"][1] + c["destino"][1]) / 2
            img = self.fondo(lat, lon, ancho_general * 0.55 * (1.0 - 0.08 * u), 0.15)
            d = ImageDraw.Draw(img, "RGBA")
            col = SEM.get(c["nivel"], ORANGE)
            d.rectangle((0, 1180, W, 1720), fill=NAVY + (230,))
            d.rectangle((0, 1180, 22, 1720), fill=col)
            limpio = c["nombre"].replace("→", "hacia")  # la tipografía no trae flecha
            nombre = limpio.split("(")[0].strip()
            sentido = limpio.split("(")[1].rstrip(")") if "(" in limpio else ""
            y = texto_centrado(d, 1220, nombre.upper(), self.f_mid, WHITE)
            if sentido:
                y = texto_centrado(d, y, sentido, self.f_sm, YELLOW)
            d.text((80, y + 20), f"{c['minutos']} min", font=self.f_big, fill=col)
            d.text((80, y + 190), f"+{c['retrasoMin']} min de lo normal", font=self.f_sm, fill=WHITE)
        elif s.kind == "fluido":
            img = self.fondo(cx_lat, cx_lon, ancho_general * 0.82, 0.6)
            d = ImageDraw.Draw(img, "RGBA")
            d.text((70, 420), "TODO FLUYE", font=self.f_big, fill=GREEN)
            y = 640
            for c in s.data["corr"]:
                d.ellipse((70, y + 12, 104, y + 46), fill=SEM.get(c["nivel"], GREEN))
                d.text((126, y), f"{c['nombre'].replace('→', 'hacia').split('(')[0].strip()} · {c['minutos']} min", font=self.f_sm, fill=WHITE)
                y += 92
        elif s.kind == "incidentes":
            img = self.fondo(cx_lat, cx_lon, ancho_general * 0.82, 0.62)
            d = ImageDraw.Draw(img, "RGBA")
            d.text((70, 420), "TOMA EN CUENTA", font=self.f_mid, fill=YELLOW)
            y = 580
            for k, i in enumerate(s.data["incs"]):
                if u < k * 0.18:
                    break
                etiqueta, col = TIPO.get(i["tipo"], ("AVISO", YELLOW))
                d.rounded_rectangle((70, y, 70 + d.textlength(etiqueta, font=self.f_sm) + 50, y + 70), 14, fill=col)
                d.text((95, y + 8), etiqueta, font=self.f_sm, fill=WHITE if col != YELLOW else NAVY)
                y = texto_centrado(d, y + 90, i["texto"], self.f_sm, WHITE, W - 140) + 50
        elif s.kind in ("urg_intro", "urg_mapa", "urg_consejo"):
            uu = s.data["u"]
            acerc = {"urg_intro": 1.0, "urg_mapa": 0.75 - 0.15 * u, "urg_consejo": 0.6}[s.kind]
            ancho = self.mapa.img.width * acerc
            img = self.fondo(uu["lat"], uu["lon"], ancho, 0.5 if s.kind == "urg_intro" else 0.05)
            d = ImageDraw.Draw(img, "RGBA")
            x, y = self._a_pantalla(uu["lat"], uu["lon"], uu["lat"], uu["lon"], ancho)
            if s.kind != "urg_intro":
                pin(d, x, y, RED, 30, (t * 1.2) % 1)
            if s.kind == "urg_intro":
                parpadeo = int(t * 3) % 2 == 0
                d.rectangle((0, 520, W, 760), fill=(RED if parpadeo else (170, 20, 35)) + (240,))
                texto_centrado(d, 560, uu.get("etiqueta", "ACCIDENTE"), self.f_big, WHITE)
                texto_centrado(d, 820, uu["calle"].upper(), self.f_mid, WHITE)
                texto_centrado(d, 1060, s.data["hora"], self.f_sm, YELLOW)
            elif s.kind == "urg_mapa":
                d.rectangle((0, 1380, W, 1720), fill=NAVY + (235,))
                d.rectangle((0, 1380, 22, 1720), fill=RED)
                yy = texto_centrado(d, 1410, uu["calle"].upper(), self.f_mid, WHITE)
                if uu.get("cruce"):
                    texto_centrado(d, yy + 10, f"a la altura de {uu['cruce']}", self.f_sm, YELLOW)
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

    def _a_pantalla(self, lat, lon, clat, clon, ancho):
        """Coordenadas del mapa → píxeles de pantalla para un recorte centrado en (clat, clon)."""
        cx, cy = self.mapa.px(clat, clon)
        alto = ancho * H / W
        x0 = min(max(0, cx - ancho / 2), max(0, self.mapa.img.width - ancho))
        y0 = min(max(0, cy - alto / 2), max(0, self.mapa.img.height - alto))
        px, py = self.mapa.px(lat, lon)
        return (px - x0) * W / ancho, (py - y0) * H / alto

    def _pins(self, d, img_ancho, clat, clon, t):
        for i in self.p.get("incidentes", [])[:8]:
            if i["tipo"] not in TIPO or "lat" not in i:
                continue
            x, y = self._a_pantalla(i["lat"], i["lon"], clat, clon, img_ancho)
            if 0 < x < W and 0 < y < H:
                pin(d, x, y, TIPO[i["tipo"]][1], 18, (t * 0.9) % 1 if i["tipo"] == "accidente" else 0)

    def _leyenda(self, d):
        y = H - 190
        d.rounded_rectangle((40, y - 20, W - 40, y + 80), 18, fill=NAVY + (215,))
        x = 70
        for txt, col in (("Fluido", GREEN), ("Lento", ORANGE), ("Pesado", RED), ("Accidente", RED)):
            d.rectangle((x, y + 18, x + 46, y + 34), fill=col) if txt != "Accidente" else d.ellipse((x + 8, y + 8, x + 40, y + 40), fill=col, outline=WHITE, width=3)
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
        if portada is None and scenes[i].kind in ("mapa", "urg_mapa") and u > 0.5:
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
    story = {"key": key, "title": title, "caption": caption, "duracion": round(total, 1), "voz": any(c is not None for c in clips), "tomtom": r.mapa.tomtom}
    json.dump(story, open(os.path.join(out, "story.json"), "w"), ensure_ascii=False, indent=2)
    return story


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    print(json.dumps(generar(json.load(open(a.payload)), a.out), ensure_ascii=False))
