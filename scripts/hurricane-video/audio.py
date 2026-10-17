"""Audio del video: voz narradora (neural, es-MX) + música de fondo propia.

La voz sale de edge-tts (voces neuronales de Microsoft, gratis, sin llave).
Si la voz falla, el video sale solo con música — nunca se detiene la
publicación por el audio. La música se genera aquí mismo (sin derechos
de terceros).
"""
from __future__ import annotations

import asyncio
import os
import subprocess

import numpy as np

SR = 44100
VOICE = os.environ.get("HURRICANE_VOICE", "es-MX-DaliaNeural")
RATE = os.environ.get("HURRICANE_VOICE_RATE", "+6%")
LEAD = 0.35   # segundos de la escena antes de que hable
TAIL = 0.75   # respiro después de la frase


def _decode(path: str) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def _tts(text: str, out: str) -> bool:
    try:
        import edge_tts  # type: ignore

        async def go():
            await edge_tts.Communicate(text, VOICE, rate=RATE).save(out)

        asyncio.run(go())
        return os.path.exists(out) and os.path.getsize(out) > 1000
    except Exception as e:  # sin red / servicio caído → sin voz
        print("tts falló:", e)
        return False


def prepare_voice(scenes, work_dir: str, premade_dir: str | None = None) -> list[np.ndarray | None]:
    """Sintetiza la voz de cada escena y alarga la escena si la frase no cabe."""
    os.makedirs(work_dir, exist_ok=True)
    clips: list[np.ndarray | None] = []
    for i, s in enumerate(scenes):
        clip = None
        if s.voice:
            pre = os.path.join(premade_dir, f"scene_{i:02d}.mp3") if premade_dir else None
            path = pre if pre and os.path.exists(pre) else os.path.join(work_dir, f"scene_{i:02d}.mp3")
            if path == pre or _tts(s.voice, path):
                clip = _decode(path)
                # recorta silencios de los extremos
                nz = np.flatnonzero(np.abs(clip) > 0.01)
                if nz.size:
                    clip = clip[max(0, nz[0] - 800): nz[-1] + 2000]
                s.dur = max(s.dur, LEAD + len(clip) / SR + TAIL)
        clips.append(clip)
    return clips


# ------------------------------------------------------------ música propia

def _note(f: float, t: np.ndarray) -> np.ndarray:
    # pad suave: fundamental + armónicos con leve desafinación (coro)
    w = np.zeros_like(t)
    for k, amp in ((1, 1.0), (2, 0.35), (3, 0.12)):
        for det in (-0.12, 0.12):
            w += amp * np.sin(2 * np.pi * (f * k + det * k) * t)
    return w


def music(total: float) -> np.ndarray:
    n = int(total * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float64)
    # La menor – Fa – Do – Sol (serio, sin dramatismo)
    chords = [(110.0, 130.81, 164.81), (87.31, 130.81, 174.61), (130.81, 164.81, 196.0), (98.0, 146.83, 196.0)]
    bar = 4.0
    i = 0
    while i * bar < total + bar:
        start = i * bar - 0.6
        a, b = int(max(0, start) * SR), int(min(total, start + bar + 1.2) * SR)
        if b > a:
            tt = t[a:b] - start
            L = bar + 1.2
            env = np.clip(tt / 1.1, 0, 1) * np.clip((L - tt) / 1.1, 0, 1)
            seg = sum(_note(f, t[a:b]) for f in chords[i % 4])
            seg += 0.5 * np.sin(2 * np.pi * chords[i % 4][0] / 2 * t[a:b])  # bajo
            out[a:b] += seg * env
        i += 1
    # pulso suave tipo noticiero (latido grave cada 0.5 s)
    beat = np.zeros(n)
    for k in range(int(total / 0.5)):
        a = int(k * 0.5 * SR)
        m = min(n - a, int(0.25 * SR))
        if m <= 0:
            break
        tt = np.arange(m) / SR
        beat[a:a + m] += (1.0 if k % 2 == 0 else 0.45) * np.sin(2 * np.pi * (55 + 30 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
    out = out / (np.abs(out).max() + 1e-9) * 0.8 + beat * 0.35
    # pasa-bajos sencillo para que no estorbe a la voz
    k = 9
    out = np.convolve(out, np.ones(k) / k, mode="same")
    fade = np.clip(t / 1.0, 0, 1) * np.clip((total - t) / 1.8, 0, 1)
    return (out * fade).astype(np.float32)


def whoosh(n: int) -> np.ndarray:
    rng = np.random.default_rng(3)
    x = rng.standard_normal(n)
    x = np.convolve(x, np.ones(40) / 40, mode="same")
    tt = np.linspace(0, 1, n)
    return (x * np.sin(np.pi * tt) ** 2).astype(np.float32)


def mix(scenes, starts: list[float], total: float, clips, out_wav: str) -> str:
    n = int(total * SR) + SR
    voice = np.zeros(n, dtype=np.float32)
    for s, st, c in zip(scenes, starts, clips):
        if c is None:
            continue
        a = int((st + LEAD) * SR)
        m = min(len(c), n - a)
        voice[a:a + m] += c[:m]
    if np.abs(voice).max() > 0:
        voice = voice / np.abs(voice).max() * 0.92
    mus = np.zeros(n, dtype=np.float32)
    mus[: int(total * SR)] = music(total)
    # ducking: la música baja cuando habla la voz
    envv = np.convolve(np.abs(voice), np.ones(4410) / 4410, mode="same")
    talking = np.clip(envv / 0.02, 0, 1)
    sm = np.convolve(talking, np.ones(8820) / 8820, mode="same")
    gain = 0.30 - 0.19 * sm
    sfx = np.zeros(n, dtype=np.float32)
    w = whoosh(int(0.7 * SR))
    for st in starts[1:]:
        a = int((st - 0.35) * SR)
        if 0 <= a < n - len(w):
            sfx[a:a + len(w)] += w * 0.5
    sfx = sfx / (np.abs(sfx).max() + 1e-9) * 0.10
    y = voice + mus * gain + sfx
    y = np.clip(y, -0.98, 0.98)
    stereo = np.repeat(y[:, None], 2, axis=1)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", out_wav],
                   input=stereo.astype(np.float32).tobytes(), check=True)
    return out_wav
