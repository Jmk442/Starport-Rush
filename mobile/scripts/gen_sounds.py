"""Generates the original synthesized STARPORT RUSH sound effects and upbeat music loop.
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
random.seed(7)
noise = [random.uniform(-1, 1) * 0.25 * (1 - i / int(SR * 0.55)) for i in range(int(SR * 0.55))]
write("blocked.wav", seq(tone(lambda t: 220, 0.08, 0.4, tri), tone(lambda t: 180, 0.12, 0.4, tri)))
write("win.wav", seq(*[tone(lambda t, f=f: f, 0.13, 0.4, tri) for f in (523, 659, 784)], tone(lambda t: 1047, 0.4, 0.45, tri)))
write("deadlock.wav", seq(tone(lambda t: 392, 0.18, 0.4, tri), tone(lambda t: 330, 0.18, 0.4, tri), tone(lambda t: 262, 0.35, 0.4, tri)))

# Pitch-rising variants: boarding seats 1-8 climb a major scale; combo launches climb by fifths.
SCALE = [0, 2, 4, 5, 7, 9, 11, 12]
for i, st in enumerate(SCALE):
    f0 = 880 * 2 ** (st / 12)
    write(f"board_{i + 1}.wav", tone(lambda t, f0=f0: f0 + 900 * t, 0.06, 0.32))
for c in range(1, 6):
    k = 2 ** ((c - 1) * 3 / 12)
    nz = [random.uniform(-1, 1) * 0.22 * (1 - i / int(SR * 0.4)) for i in range(int(SR * 0.4))]
    write(f"launch_{c}.wav", mix(tone(lambda t, k=k: (200 + 1100 * t * t) * k, 0.4, 0.45, tri), nz,
                                  tone(lambda t, k=k: 1320 * k, 0.12, 0.12 if c > 1 else 0)))
# Goofy alien voices (wobbly squeaks)
write("squeak.wav", tone(lambda t: 700 + 900 * t + 120 * math.sin(2 * math.pi * 30 * t), 0.22, 0.4, tri))
write("grumble.wav", tone(lambda t: 150 - 40 * t + 25 * math.sin(2 * math.pi * 14 * t), 0.45, 0.45, tri))
write("cheer.wav", seq(tone(lambda t: 900 + 1200 * t, 0.09, 0.35, tri), tone(lambda t: 1300 + 1500 * t, 0.12, 0.35, tri)))
write("combo.wav", seq(*[tone(lambda t, f=f: f, 0.06, 0.35, tri) for f in (1047, 1319, 1568, 2093)]))

# Upbeat 8s arcade loop @120bpm: bass on beats, arpeggio 16ths, light hat.
bpm = 120; beat = 60 / bpm; dur = 16 * beat; n = int(SR * dur)
prog = [(220.0, [440, 523.3, 659.3]), (174.6, [349.2, 440, 523.3]), (196.0, [392, 493.9, 587.3]), (164.8, [329.6, 415.3, 493.9])]
music = []
random.seed(3)
for i in range(n):
    t = i / SR; bar = int(t // (4 * beat)) % 4; root, arp = prog[bar]
    tb = t % beat; t16 = t % (beat / 4); idx = int(t // (beat / 4)) % 4
    bass = tri(2 * math.pi * root * t) * math.exp(-tb * 6) * 0.35
    a = tri(2 * math.pi * arp[idx % 3] * (1 if idx < 3 else 2) * t) * math.exp(-t16 * 18) * 0.16
    hat = random.uniform(-1, 1) * math.exp(-((t + beat / 2) % beat) * 60) * 0.05
    music.append((bass + a + hat) * 0.9)
write("music.wav", music)
print("ok")
