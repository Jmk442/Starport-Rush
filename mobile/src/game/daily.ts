// Daily Challenge: one deterministic puzzle per UTC day, generated on-device
// (works offline). Everyone gets the same puzzle for the same date.
import { candidate, fleet, type GenSpec } from "./generator";
import type { LevelDef } from "./types";

export const DAILY_LEVEL_ID = 1000;

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export function dateSeed(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000000) + 1;
}

const NAMES = ["Rush", "Jam", "Shuffle", "Scramble", "Frenzy", "Gridlock", "Mixup"];

const cache = new Map<string, LevelDef>();

/** Deterministic daily level. ~8 ships, 3 bays, trap-heavy but always solvable. */
export function dailyLevel(key: string): LevelDef {
  const hit = cache.get(key);
  if (hit) return hit;
  const base = dateSeed(key);
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
  const spec: GenSpec = {
    levelId: DAILY_LEVEL_ID,
    name: `Daily ${NAMES[weekday]}`,
    size: 7,
    bays: 3,
    ships: fleet(8, 1, 2, 6, base % 8),
    minWinRatio: 0.008,
    maxWinRatio: 0.09,
  };
  let found: LevelDef | null = null;
  let fallback: LevelDef | null = null;
  for (let i = 0; i < 400 && !found; i++) {
    const c = candidate(spec, base + i);
    if (!c) continue;
    if (!fallback) fallback = c.level;
    if (c.ratio >= spec.minWinRatio && c.ratio <= spec.maxWinRatio) found = c.level;
  }
  const level = found ?? fallback!;
  cache.set(key, level);
  return level;
}

export interface DailyScoreInput {
  moves: number;
  undos: number;
  seconds: number;
  bestCombo: number;
}

/** Higher is better. Rewards combos, punishes undos and slowness. */
export function dailyScore({ undos, seconds, bestCombo }: DailyScoreInput) {
  return Math.max(100, 1000 + bestCombo * 150 - undos * 120 - Math.min(600, seconds * 3));
}
