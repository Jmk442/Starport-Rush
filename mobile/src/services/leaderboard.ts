// Daily Challenge results: saved locally first (works offline), then synced to the
// simple online leaderboard (handle only, no login) whenever we're online.
import { getPrefs } from "@/src/services/prefs";
import { storage } from "@/src/utils/storage";

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export interface DailyResult {
  score: number;
  seconds: number;
  undos: number;
  bestCombo: number;
  moves: number;
  replayCode: string | null;
}

export interface LeaderEntry {
  rank: number;
  handle: string;
  score: number;
  seconds: number;
  undos: number;
  best_combo: number;
  replay_code: string | null;
  is_you: boolean;
  champion?: boolean;
}

export interface Leaderboard {
  date: string;
  total: number;
  entries: LeaderEntry[];
  you: LeaderEntry | null;
}

const k = (date: string, f: string) => `sr_daily_${date}_${f}`;

export async function getLocalBest(date: string): Promise<DailyResult | null> {
  const score = await storage.getItem(k(date, "score"), 0);
  if (!score) return null;
  return {
    score,
    seconds: (await storage.getItem(k(date, "seconds"), 0)) ?? 0,
    undos: (await storage.getItem(k(date, "undos"), 0)) ?? 0,
    bestCombo: (await storage.getItem(k(date, "combo"), 0)) ?? 0,
    moves: (await storage.getItem(k(date, "moves"), 0)) ?? 0,
    replayCode: (await storage.getItem(k(date, "code"), "")) || null,
  };
}

/** Saves if it beats the local best; returns true when it's a new personal best. */
export async function saveLocal(date: string, r: DailyResult) {
  const prev = await getLocalBest(date);
  if (prev && (prev.score > r.score || (prev.score === r.score && prev.seconds <= r.seconds))) return false;
  await Promise.all([
    storage.setItem(k(date, "score"), r.score),
    storage.setItem(k(date, "seconds"), r.seconds),
    storage.setItem(k(date, "undos"), r.undos),
    storage.setItem(k(date, "combo"), r.bestCombo),
    storage.setItem(k(date, "moves"), r.moves),
    storage.setItem(k(date, "code"), r.replayCode ?? ""),
    storage.setItem(k(date, "synced"), false),
  ]);
  return true;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API}${path}`, { ...init, signal: ctrl.signal, headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Posts the local best if it hasn't been synced yet. Safe to call any time. */
export async function syncDaily(date: string): Promise<"synced" | "nothing" | "offline" | "rejected"> {
  const best = await getLocalBest(date);
  if (!best || (await storage.getItem(k(date, "synced"), false))) return "nothing";
  const p = getPrefs();
  try {
    await request(`/daily/${date}/scores`, {
      method: "POST",
      body: JSON.stringify({
        device_id: p.deviceId,
        handle: p.handle,
        score: best.score,
        seconds: Math.max(1, best.seconds),
        undos: best.undos,
        best_combo: best.bestCombo,
        moves: best.moves,
        replay_code: best.replayCode,
      }),
    });
    await storage.setItem(k(date, "synced"), true);
    return "synced";
  } catch (e) {
    if (e instanceof Error && /^HTTP 4\d\d$/.test(e.message)) {
      await storage.setItem(k(date, "synced"), true); // server rejected it for good (e.g. day over): stop retrying
      return "rejected";
    }
    return "offline";
  }
}

export function fetchLeaderboard(date: string) {
  return request<Leaderboard>(`/daily/${date}/leaderboard?limit=50&device_id=${encodeURIComponent(getPrefs().deviceId)}`);
}

// ---- Weekly Cup (sum of best daily scores, Mon-Sun UTC) ----
export interface WeeklyEntry {
  rank: number;
  handle: string;
  total: number;
  days: number;
  is_you: boolean;
  champion?: boolean;
}
export interface WeeklyBoard {
  week_start: string;
  week_end: string;
  total_players: number;
  entries: WeeklyEntry[];
  you: WeeklyEntry | null;
  last_week_top: WeeklyEntry[];
}
export function fetchWeekly(weekStart: string) {
  return request<WeeklyBoard>(`/weekly/${weekStart}/leaderboard?limit=50&device_id=${encodeURIComponent(getPrefs().deviceId)}`);
}

// ---- Boss Rush (best combined time per device; local first, synced later) ----
export interface RushResult {
  ms: number;
  undos: number;
  splits: number[];
}
export interface RushEntry extends RushResult {
  rank: number;
  handle: string;
  is_you: boolean;
  champion?: boolean;
}
export interface RushBoard {
  total: number;
  entries: RushEntry[];
  you: RushEntry | null;
}

export async function getRushBest(): Promise<RushResult | null> {
  const ms = await storage.getItem("sr_rush_ms", 0);
  if (!ms) return null;
  const splits = String((await storage.getItem("sr_rush_splits", "")) ?? "").split(",").map(Number);
  return { ms, undos: (await storage.getItem("sr_rush_undos", 0)) ?? 0, splits };
}

/** Saves if faster than the local best; returns true for a new personal best. */
export async function saveRushLocal(r: RushResult) {
  const prev = await getRushBest();
  if (prev && prev.ms <= r.ms) return false;
  await Promise.all([
    storage.setItem("sr_rush_ms", r.ms),
    storage.setItem("sr_rush_undos", r.undos),
    storage.setItem("sr_rush_splits", r.splits.join(",")),
    storage.setItem("sr_rush_synced", false),
  ]);
  return true;
}

export async function syncRush(): Promise<"synced" | "nothing" | "offline" | "rejected"> {
  const best = await getRushBest();
  if (!best || (await storage.getItem("sr_rush_synced", false))) return "nothing";
  const p = getPrefs();
  try {
    await request(`/bossrush/scores`, { method: "POST", body: JSON.stringify({ device_id: p.deviceId, handle: p.handle, ...best }) });
    await storage.setItem("sr_rush_synced", true);
    return "synced";
  } catch (e) {
    if (e instanceof Error && /^HTTP 4\d\d$/.test(e.message)) {
      await storage.setItem("sr_rush_synced", true); // server rejected it for good: stop retrying
      return "rejected";
    }
    return "offline";
  }
}

export function fetchRushBoard() {
  return request<RushBoard>(`/bossrush/leaderboard?limit=50&device_id=${encodeURIComponent(getPrefs().deviceId)}`);
}
