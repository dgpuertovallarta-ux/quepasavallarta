"""Genera el video de ciclón para Qué Pasa Vallarta.

  python generate.py --sample            # con los datos de prueba (Trudy 17A)
  python generate.py --live --out dir    # consulta el NHC y genera si aplica

En modo --live escribe en --out:
  video.mp4, story.json (texto del post y datos) y deja SKIP si no aplica.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import nhc  # noqa: E402
import render  # noqa: E402


def patrocinador(out: str) -> dict | None:
    """Patrocinador vigente de los videos de huracán ("Presentado por"), si hay."""
    import urllib.request
    site = os.environ.get("SITE", "https://quepasavta.com")
    try:
        with urllib.request.urlopen(f"{site}/api/patrocinio?seccion=huracanes", timeout=20) as r:
            p = json.load(r)
        if not p or not p.get("logo"):
            return None
        path = os.path.join(out, "_sponsor_logo")
        req = urllib.request.Request(p["logo"], headers={"User-Agent": "QuePasaVallartaBot/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r, open(path, "wb") as f:
            f.write(r.read())
        return {"nombre": p.get("nombre", ""), "logo_path": path}
    except Exception as e:
        print("sin patrocinador:", e)
        return None


def caption(story: dict) -> str:
    best = story["best"]
    l = render.local(best.time)
    word = story["word"].capitalize()
    parts = [
        f"{word} {story['name']}: lo que dice el Centro Nacional de Huracanes para Puerto Vallarta y Bahía de Banderas (boletín {story['adv_label']}).",
        f"Vientos de {story['kmh']} km/h. El pronóstico lo acerca a unos {render.round_km(story['d_best'])} km de Vallarta el {render.DAYS[l.weekday()].lower()} cerca de las {render.hour_txt(best.time).rstrip('.')}.",
    ]
    if story.get("status"):
        parts.append(f"Vallarta y Bahía de Banderas están bajo {render.WW_NAMES[story['status']].lower()}.")
    parts.append("Sigue las indicaciones de Protección Civil. Fuente: NHC (Miami).")
    return " ".join(parts)


def story_json(story: dict, extra: dict) -> dict:
    return {
        "caption": caption(story),
        "title": f"{story['word'].capitalize()} {story['name']} · boletín {story['adv_label']}",
        "adv_label": story["adv_label"],
        "name": story["name"],
        "status": story["status"],
        "d_best_km": round(story["d_best"]),
        **extra,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--out", default=".")
    ap.add_argument("--force", action="store_true", help="genera aunque el ciclón esté lejos")
    ap.add_argument("--preview", default=None)
    ap.add_argument("--voice-dir", default=None, help="voces ya hechas (scene_00.mp3…)")
    ap.add_argument("--print-voice", action="store_true", help="solo imprime el guion de la voz")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    if a.sample:
        S = os.path.join(HERE, "sample")
        adv = nhc.parse_tcm(open(os.path.join(S, "trudy_017_tcm.txt")).read())
        tas = nhc.parse_tas(open(os.path.join(S, "trudy_017a_tas.txt")).read())
        g = json.load(open(os.path.join(S, "trudy_017a_gis.json")))
        story = render.build_story(adv, tas, g["cone"], g["ww"], "17A")
        if a.print_voice:
            print(json.dumps([sc.voice for sc in story["scenes"]], ensure_ascii=False))
            return
        render.render_video(story, os.path.join(a.out, "video.mp4"), a.preview, a.voice_dir)
        json.dump(story_json(story, {"storm_id": "ep212026", "key": "ep212026-17a-sample"}), open(os.path.join(a.out, "story.json"), "w"), ensure_ascii=False, indent=1)
        print("ok sample")
        return

    storms = nhc.active_storms()
    for st in storms:
        data = nhc.load_storm(st)
        adv, tas, cone, ww = data["tcm"], data["tas"], data["cone"], data["ww"]
        ok, why = nhc.is_relevant(adv, cone, ww)
        print(st["id"], st["name"], why)
        if not ok and not a.force:
            continue
        public_adv = (st.get("publicAdvisory") or {}).get("advNum") or adv.adv_num
        fc_adv = (st.get("forecastAdvisory") or {}).get("advNum") or adv.adv_num
        key = f"{st['id']}-{fc_adv}".lower()  # un video por boletín completo
        story = render.build_story(adv, tas, cone, ww, public_adv)
        story["sponsor"] = patrocinador(a.out)
        render.render_video(story, os.path.join(a.out, "video.mp4"), a.preview)
        json.dump(story_json(story, {"storm_id": st["id"], "key": key, "reason": why}), open(os.path.join(a.out, "story.json"), "w"), ensure_ascii=False, indent=1)
        print("ok", key)
        return  # un video por corrida (el ciclón más relevante)
    open(os.path.join(a.out, "SKIP"), "w").write("sin ciclones relevantes para Vallarta\n")
    print("skip")


if __name__ == "__main__":
    main()
