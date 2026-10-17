"""Genera el mapa base (costa del Pacífico mexicano) una sola vez.

Se ejecuta a mano cuando se quiera cambiar el estilo del mapa:
    pip install global-land-mask pillow numpy
    python scripts/hurricane-video/build_basemap.py

Produce assets/basemap.png + assets/basemap.json (límites y escala), que
el generador de videos usa sin depender de internet.
"""
import json
import os

import numpy as np
from global_land_mask import globe
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

# Región: de Mazatlán/Los Cabos a Acapulco.
LON0, LON1 = -112.0, -98.0
LAT0, LAT1 = 13.0, 27.0
PX_PER_DEG = 300  # resolución (px por grado de latitud)
COS = float(np.cos(np.radians(20.0)))  # corrección de longitud a ~20°N

OCEAN_TOP = np.array([6, 46, 88])
OCEAN_BOTTOM = np.array([3, 30, 60])
LAND = np.array([38, 41, 49])
LAND_HI = np.array([52, 56, 66])
COAST = np.array([0, 214, 192])


def main():
    w = int(round((LON1 - LON0) * PX_PER_DEG * COS))
    h = int(round((LAT1 - LAT0) * PX_PER_DEG))
    lons = LON0 + (np.arange(w) + 0.5) / (PX_PER_DEG * COS)
    lats = LAT1 - (np.arange(h) + 0.5) / PX_PER_DEG
    lon_g, lat_g = np.meshgrid(lons, lats)
    land = globe.is_land(lat_g, lon_g).astype(np.uint8) * 255

    # Suavizado del borde (antialias) y relieve sutil hacia el interior.
    mask = Image.fromarray(land, "L").filter(ImageFilter.GaussianBlur(1.2))
    m = np.asarray(mask).astype(np.float32) / 255.0
    inland = np.asarray(Image.fromarray(land, "L").filter(ImageFilter.GaussianBlur(18))).astype(np.float32) / 255.0

    t = np.linspace(0, 1, h)[:, None, None]
    ocean = OCEAN_TOP * (1 - t) + OCEAN_BOTTOM * t
    ocean = np.broadcast_to(ocean, (h, w, 3)).astype(np.float32)
    # Brillo suave del mar cerca de la costa.
    near = np.asarray(Image.fromarray(land, "L").filter(ImageFilter.GaussianBlur(40))).astype(np.float32) / 255.0
    ocean = ocean + (np.array([20, 60, 90]) * near[..., None] * 0.55)

    land_col = LAND * (1 - inland[..., None]) + LAND_HI * inland[..., None]
    img = ocean * (1 - m[..., None]) + land_col * m[..., None]

    # Línea de costa: borde de la máscara.
    edge = np.asarray(Image.fromarray(land, "L").filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255.0
    edge = np.clip(edge * 2.2, 0, 1)
    edge[:4, :] = 0
    edge[-4:, :] = 0
    edge[:, :4] = 0
    edge[:, -4:] = 0
    img = img * (1 - edge[..., None] * 0.6) + COAST * edge[..., None] * 0.6

    # Cuadrícula de latitud/longitud muy tenue (estilo carta meteorológica).
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")
    grid = Image.new("L", out.size, 0)
    gp = grid.load()
    for lat in range(int(LAT0), int(LAT1) + 1):
        y = int(round((LAT1 - lat) * PX_PER_DEG))
        if 0 <= y < h:
            for x in range(0, w, 3):
                gp[x, y] = 40
    for lon in range(int(LON0), int(LON1) + 1):
        x = int(round((lon - LON0) * PX_PER_DEG * COS))
        if 0 <= x < w:
            for y in range(0, h, 3):
                gp[x, y] = 40
    out = Image.composite(Image.new("RGB", out.size, (120, 170, 200)), out, grid)

    os.makedirs(ASSETS, exist_ok=True)
    out.save(os.path.join(ASSETS, "basemap.png"), optimize=True)
    with open(os.path.join(ASSETS, "basemap.json"), "w") as f:
        json.dump({"lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1, "px_per_deg": PX_PER_DEG, "cos": COS, "width": w, "height": h}, f)
    print("basemap", w, h)


def build_coast():
    """Puntos de la línea de costa (para pintar avisos siguiendo la costa)."""
    step = 0.01
    lons = np.arange(-111.5, -99.0, step)
    lats = np.arange(15.0, 25.5, step)
    lon_g, lat_g = np.meshgrid(lons, lats)
    land = globe.is_land(lat_g, lon_g)
    water = ~land
    nb = np.zeros_like(land)
    nb[1:, :] |= water[:-1, :]
    nb[:-1, :] |= water[1:, :]
    nb[:, 1:] |= water[:, :-1]
    nb[:, :-1] |= water[:, 1:]
    coast = land & nb
    ys, xs = np.nonzero(coast)
    pts = [[round(float(lons[x]), 3), round(float(lats[y]), 3)] for y, x in zip(ys, xs)]
    with open(os.path.join(ASSETS, "coast.json"), "w") as f:
        json.dump(pts, f, separators=(",", ":"))
    print("coast points", len(pts))


if __name__ == "__main__":
    main()
    build_coast()
