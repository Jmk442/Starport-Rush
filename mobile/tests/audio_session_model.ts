// REPRODUCTION MODEL for the Round 3 bug "music stopped suddenly on level 3 (iPhone, Expo Go)".
// No iPhone is available in this environment, so this replays the exact iOS
// session rules from node_modules/expo-audio/ios/AudioModule.swift:
//   - a non-looping player finishing calls deactivateSession() (if !keepAudioSessionActive)
//   - JS pause() calls deactivateSession() (if !keepAudioSessionActive)
//   - deactivateSession() runs 100 ms later and deactivates when no activity keepers are
//     registered and no player reports isPlaying (timeControlStatus == .playing)
//   - play() registers an activity keeper only when keepAudioSessionActive is true
// ASSUMPTIONS (model, not measured): the looping music reports "not .playing" for a short
// window at each 8 s loop boundary (AVQueuePlayer item hand-off, 0-60 ms) and while it
// re-primes after pause()->play() (40-140 ms). A deactivated session silences the music
// permanently unless JS calls play() again.
// It is driven by the REAL engine event timelines and app sound mapping for levels 1 -> 3.
// Run: npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/audio_session_model.js
import { applyTap, createInitialState } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import type { GameEvent } from "../src/game/types";
import { DURATION_TABLE } from "../src/game/timing";

declare const console: { log: (...a: unknown[]) => void };
declare const process: { exitCode: number };

const SFX_LEN: Record<string, number> = { tap: 70, dock: 220, board: 60, launch: 400, combo: 240, win: 790, cheer: 210 };
const LOOP_MS = 8000;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

interface Policy {
  name: string;
  keepSessionActive: boolean; // createAudioPlayer(..., { keepAudioSessionActive })
  pauseOnLevelChange: boolean; // game screen effect cleanup paused music on remount
}

function sfxFor(e: GameEvent, combo: number): [string, number][] {
  switch (e.type) {
    case "DISPATCH": return [["tap", 0]];
    case "DOCK": return [["dock", 0]];
    case "BOARD": return [["board", 0]];
    case "DEPART": return combo >= 2 ? [["launch", 0], ["combo", 120]] : [["launch", 0]];
    case "WIN": return [["win", 0], ["cheer", 350]];
    default: return [];
  }
}

/** Returns the level (1-3) where music died, or 0 if it survived. */
function simulate(policy: Policy, seed: number): number {
  const r = rng(seed);
  const gapAtBoundary = r() * 60; // per-device hand-off window
  const sfx: { start: number; end: number }[] = [];
  const checks: { at: number; level: number }[] = [];
  // music timeline segments: from `from`, not .playing until `primeUntil`, loop phase origin = primeUntil
  const segments: { from: number; primeUntil: number }[] = [{ from: 0, primeUntil: 0 }];
  let t = 500;
  const levelSpans: [number, number, number][] = [];

  for (const level of LEVELS.slice(0, 3)) {
    const startT = t;
    if (level.levelId > 1 && policy.pauseOnLevelChange) {
      // cleanup pause() -> deactivate check in 100 ms; play() again immediately
      checks.push({ at: t + 100, level: level.levelId });
      segments.push({ from: t, primeUntil: t + 40 + r() * 100 });
    }
    let s = createInitialState(level);
    let lastDepart = -1e9;
    let combo = 0;
    for (const id of level.expectedSolution) {
      t += 700 + r() * 2300; // player think time
      const out = applyTap(s, id);
      s = out.state;
      let et = t;
      for (const te of out.events) {
        if (te.event.type === "DEPART") {
          combo = et - lastDepart < 2600 ? combo + 1 : 1;
          lastDepart = et;
        }
        for (const [name, off] of sfxFor(te.event, combo)) {
          const st = et + off;
          const end = st + SFX_LEN[name];
          sfx.push({ start: st, end });
          if (!policy.keepSessionActive) checks.push({ at: end + 100, level: level.levelId });
        }
        et += DURATION_TABLE[te.event.type];
      }
      t = et;
    }
    t += 2000 + r() * 3000; // victory screen, then Next Level
    levelSpans.push([level.levelId, startT, t]);
  }

  const musicPlayingAt = (at: number) => {
    const seg = [...segments].reverse().find((x) => x.from <= at)!;
    if (at < seg.primeUntil) return false;
    const phase = (at - seg.primeUntil) % LOOP_MS;
    return !(phase < gapAtBoundary / 2 || phase > LOOP_MS - gapAtBoundary / 2);
  };
  const anySfxAt = (at: number) => sfx.some((x) => x.start <= at && at < x.end);

  checks.sort((a, b) => a.at - b.at);
  let deadAt: number | null = null;
  for (const c of checks) {
    if (!musicPlayingAt(c.at) && !anySfxAt(c.at)) {
      deadAt = c.at;
      break;
    }
  }
  if (deadAt === null) return 0;
  return levelSpans.find(([, st, en]) => st <= deadAt! && deadAt! < en)?.[0] ?? 3;
}

const RUNS = 2000;
const POLICIES: Policy[] = [
  { name: "Round 2 build (bug)", keepSessionActive: false, pauseOnLevelChange: true },
  { name: "Round 3 fix", keepSessionActive: true, pauseOnLevelChange: false },
];
const results: Record<string, number[]> = {};
for (const p of POLICIES) {
  const byLevel = [0, 0, 0, 0];
  for (let i = 1; i <= RUNS; i++) byLevel[simulate(p, i)]++;
  results[p.name] = byLevel;
  console.log(
    `${p.name}: music silenced in ${RUNS - byLevel[0]}/${RUNS} play-throughs of L1->L3 ` +
      `(L1: ${byLevel[1]}, L2: ${byLevel[2]}, L3: ${byLevel[3]})`,
  );
}
const bug = results[POLICIES[0].name];
const fix = results[POLICIES[1].name];
const ok = RUNS - bug[0] > 0 && fix[0] === RUNS;
console.log(ok ? "REPRODUCED with old policy; 0 failures with fix" : "MODEL DID NOT REPRODUCE / FIX FAILED");
if (!ok) process.exitCode = 1;
