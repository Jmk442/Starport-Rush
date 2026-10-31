// Seeded level generation shared by the offline level search (tests/) and the
// on-device Daily Challenge. Pure TS, deterministic: same seed -> same level.
import { createInitialState, legalMoves } from "./engine";
import { countPaths, solve } from "./solver";
import type { AlienColor, Direction, LevelDef, ShapeSymbol, ShipDef } from "./types";

const SYMBOL: Record<AlienColor, ShapeSymbol> = {
  cyan: "triangle", yellow: "star", orange: "square", pink: "circle",
  purple: "diamond", green: "heart", blue: "moon", red: "flame",
};
const DIRS: Direction[] = ["NORTH", "SOUTH", "EAST", "WEST"];
export const PALETTE: AlienColor[] = ["cyan", "yellow", "pink", "green", "orange", "purple", "blue", "red"];

export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface GenSpec {
  levelId: number;
  name: string;
  size: number;
  bays: number;
  ships: { color: AlienColor; cap: 4 | 6 | 8 }[];
  minWinRatio: number;
  maxWinRatio: number;
}

export function fleet(n: number, galaxies: number, cruisers: number, colours: number, offset: number) {
  const out: { color: AlienColor; cap: 4 | 6 | 8 }[] = [];
  for (let i = 0; i < n; i++) {
    const cap: 4 | 6 | 8 = i < galaxies ? 8 : i < galaxies + cruisers ? 6 : 4;
    out.push({ color: PALETTE[(i + offset) % colours], cap });
  }
  return out;
}

export function place(spec: GenSpec, r: () => number): ShipDef[] | null {
  const occ = new Set<string>();
  const out: ShipDef[] = [];
  const counter: Record<string, number> = {};
  for (const s of spec.ships) {
    const [breadth, length] = s.cap === 4 ? [1, 2] : s.cap === 6 ? [1, 3] : [2, 3];
    let ok = false;
    for (let t = 0; t < 300 && !ok; t++) {
      const dir = DIRS[Math.floor(r() * 4)];
      const vertical = dir === "NORTH" || dir === "SOUTH";
      const w = vertical ? breadth : length;
      const h = vertical ? length : breadth;
      const x = Math.floor(r() * (spec.size - w + 1));
      const y = Math.floor(r() * (spec.size - h + 1));
      const cells: string[] = [];
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) cells.push(`${x + dx},${y + dy}`);
      if (cells.some((c) => occ.has(c))) continue;
      cells.forEach((c) => occ.add(c));
      counter[s.color] = (counter[s.color] ?? 0) + 1;
      out.push({ id: `${s.color}-${String(counter[s.color]).padStart(2, "0")}`, color: s.color, symbol: SYMBOL[s.color], x, y, width: w, height: h, exitDirection: dir, capacity: s.cap });
      ok = true;
    }
    if (!ok) return null;
  }
  return out;
}

export function queueFor(ships: ShipDef[], r: () => number) {
  const chunks: { color: AlienColor; count: number }[] = [];
  for (const s of ships) {
    let left = s.capacity as number;
    while (left > 0) {
      const n = left <= 3 ? left : Math.min(left, 2 + Math.floor(r() * 3));
      chunks.push({ color: s.color, count: n });
      left -= n;
    }
  }
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }
  const merged: typeof chunks = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && last.color === c.color) last.count += c.count;
    else merged.push({ ...c });
  }
  return merged;
}

export interface Candidate {
  level: LevelDef;
  ratio: number;
  wins: number;
  total: number;
  initial: number;
}

/** Builds + verifies one seeded candidate. null if invalid/unsolvable/too easy at start. */
export function candidate(spec: GenSpec, seed: number, withRatio = true): Candidate | null {
  const r = rng(seed * 31 + spec.levelId);
  const ships = place(spec, r);
  if (!ships) return null;
  const level: LevelDef = {
    levelId: spec.levelId, name: spec.name, board: { width: spec.size, height: spec.size },
    dockingBayCount: spec.bays, ships, passengerGroups: queueFor(ships, r), expectedSolution: [],
  };
  const st = createInitialState(level);
  const initial = legalMoves(st).length;
  if (initial < 2 || initial > Math.ceil(ships.length / 2)) return null; // some ships must start blocked
  const sol = solve(st);
  if (!sol.solvable) return null;
  level.expectedSolution = sol.solution;
  if (!withRatio) return { level, ratio: 0, wins: 0, total: 0, initial };
  const p = countPaths(st);
  return { level, ...p, initial };
}
