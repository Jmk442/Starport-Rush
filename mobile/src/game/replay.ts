// Combo replays: a compact, deterministic replay code (level + tap sequence).
// Because the engine is deterministic, the tap list reproduces the run exactly.
// Format: SR1.<levelRef>.<fromMove>.<combo>.<handle>.<moves joined by ~>
//   levelRef = level id ("12") or daily date ("d2026-09-14")
import type { LevelDef } from "./types";

export interface ReplayData {
  levelRef: string;
  fromMove: number; // replay starts showing at this move index (combo start)
  combo: number;
  handle: string;
  moves: string[];
}

export function encodeReplay(r: ReplayData) {
  return ["SR1", r.levelRef, r.fromMove, r.combo, r.handle, r.moves.join("~")].join(".");
}

export function decodeReplay(code: string): ReplayData | null {
  const parts = code.trim().split(".");
  if (parts.length !== 6 || parts[0] !== "SR1") return null;
  const [, levelRef, from, combo, handle, moves] = parts;
  const fromMove = Number(from);
  const c = Number(combo);
  if (!/^(\d+|d\d{4}-\d{2}-\d{2})$/.test(levelRef) || !Number.isInteger(fromMove) || !Number.isInteger(c)) return null;
  const list = moves ? moves.split("~") : [];
  if (list.some((m) => !/^[a-z]+-\d{2}$/.test(m))) return null;
  return { levelRef, fromMove, combo: c, handle, moves: list };
}

/** Extracts the first valid replay code from free text (e.g. a shared message with a deep link). */
export function findReplayCode(text: string) {
  let plain = text;
  try {
    plain = decodeURIComponent(text);
  } catch {
    // keep raw text if it contains a stray %
  }
  for (const m of plain.match(/SR1\.[^\s&"'<>]+/g) ?? []) if (decodeReplay(m)) return m;
  return null;
}

export function resolveLevel(ref: string, byId: (id: number) => LevelDef | undefined, daily: (key: string) => LevelDef) {
  return ref.startsWith("d") ? daily(ref.slice(1)) : byId(Number(ref));
}
