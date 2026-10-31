"""Generates the original synthesized STARPORT RUSH sound effects and ambient loop.
Run: python3 scripts/gen_sounds.py  (writes assets/sounds/*.wav)"""
import math, struct, wave, os, random

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")
os.makedirs(OUT, exist_ok=True)


def write(name, samples):
    with wave.open(os.path.join(OUT, name), "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32000)) for s in samples))


def env(i, n, a=0.01, r=0.2):
    t = i / SR; dur = n / SR
    if t < a: return t / a
    return max(0.0, 1 - (t - a) / max(0.0001, dur - a)) ** (1 / max(r, 0.01) * 0.5)


def tone(freq_fn, dur, vol=0.5, wave_fn=math.sin, a=0.005, r=0.3):
    n = int(SR * dur); out = []; ph = 0.0
    for i in range(n):
        ph += 2 * math.pi * freq_fn(i / SR) / SR
        out.append(wave_fn(ph) * vol * env(i, n, a, r))
    return out


def tri(ph): return 2 / math.pi * math.asin(math.sin(ph))


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) for i in range(n)]


def seq(*parts):
    out = []
    for p in parts: out += p
    return out


write("tap.wav", tone(lambda t: 880 + 600 * t, 0.07, 0.4, tri))
write("dock.wav", mix(tone(lambda t: 520 - 200 * t, 0.22, 0.45, tri), tone(lambda t: 1040, 0.12, 0.15)))
write("board.wav", tone(lambda t: 1200 + 1800 * t, 0.06, 0.3))
random.seed(7)
noise = [random.uniform(-1, 1) * 0.25 * (1 - i / int(SR * 0.55)) for i in range(int(SR * 0.55))]
write("launch.wav", mix(tone(lambda t: 180 + 900 * t * t, 0.55, 0.45, tri), noise))
write("blocked.wav", seq(tone(lambda t: 220, 0.08, 0.4, tri), tone(lambda t: 180, 0.12, 0.4, tri)))
write("win.wav", seq(*[tone(lambda t, f=f: f, 0.13, 0.4, tri) for f in (523, 659, 784)], tone(lambda t: 1047, 0.4, 0.45, tri)))
write("deadlock.wav", seq(tone(lambda t: 392, 0.18, 0.4, tri), tone(lambda t: 330, 0.18, 0.4, tri), tone(lambda t: 262, 0.35, 0.4, tri)))

# 8 second ambient pad loop (seamless: whole-cycle frequencies, crossfaded LFO)
dur = 8.0; n = int(SR * dur); chords = [(220, 277.2, 329.6), (196, 246.9, 293.7)]
music = []
for i in range(n):
    t = i / SR; c = chords[int(t // 4) % 2]
    fade = min(1, (t % 4) / 0.4, (4 - t % 4) / 0.4)
    s = sum(math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2 * t) for f in c) / 6
    sp = 0.5 + 0.5 * math.sin(2 * math.pi * t / dur)
    music.append(s * 0.28 * (0.6 + 0.4 * fade) * (0.85 + 0.15 * sp))
write("ambient.wav", music)
print("ok")
