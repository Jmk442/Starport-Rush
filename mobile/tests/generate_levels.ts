// Seeded level search for Levels 2-5. Every candidate is verified with the real
// engine + BFS solver; difficulty = share of complete play paths that win.
// Run: npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/generate_levels.js
import { applyTap, createInitialState, legalMoves } from "../src/game/engine";
import { countPaths, solve } from "../src/game/solver";
import type { AlienColor, Direction, LevelDef, ShapeSymbol, ShipDef } from "../src/game/types";

declare const console: { log: (...a: unknown[]) => void };
declare const process: { argv: string[] };

const SYMBOL: Record<AlienColor, ShapeSymbol> = {
  cyan: "triangle", yellow: "star", orange: "square", pink: "circle",
  purple: "diamond", green: "heart", blue: "moon", red: "flame",
};
const DIRS: Direction[] = ["NORTH", "SOUTH", "EAST", "WEST"];

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

interface Spec {
  levelId: number;
  name: string;
  size: number;
  bays: number;
  ships: { color: AlienColor; cap: 4 | 6 | 8 }[];
  maxWinRatio: number;
  minWinRatio: number;
}

function place(spec: Spec, r: () => number): ShipDef[] | null {
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

function queueFor(ships: ShipDef[], r: () => number) {
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

const SPECS: Spec[] = [
  { levelId: 2, name: "Cruiser Crossing", size: 6, bays: 3, minWinRatio: 0.15, maxWinRatio: 0.4,
    ships: [{ color: "cyan", cap: 4 }, { color: "yellow", cap: 6 }, { color: "pink", cap: 4 }, { color: "green", cap: 4 }, { color: "cyan", cap: 4 }] },
  { levelId: 3, name: "Rush Hour Ring", size: 6, bays: 3, minWinRatio: 0.06, maxWinRatio: 0.22,
    ships: [{ color: "orange", cap: 6 }, { color: "cyan", cap: 4 }, { color: "purple", cap: 4 }, { color: "yellow", cap: 6 }, { color: "pink", cap: 4 }, { color: "purple", cap: 4 }] },
  { levelId: 4, name: "Galaxy Gate", size: 7, bays: 3, minWinRatio: 0.03, maxWinRatio: 0.12,
    ships: [{ color: "blue", cap: 8 }, { color: "green", cap: 6 }, { color: "red", cap: 4 }, { color: "cyan", cap: 4 }, { color: "yellow", cap: 6 }, { color: "red", cap: 4 }, { color: "pink", cap: 4 }] },
  { levelId: 5, name: "Supernova Shift", size: 7, bays: 4, minWinRatio: 0.005, maxWinRatio: 0.08,
    ships: [{ color: "purple", cap: 8 }, { color: "orange", cap: 6 }, { color: "cyan", cap: 4 }, { color: "blue", cap: 6 }, { color: "red", cap: 8 }, { color: "green", cap: 4 }, { color: "yellow", cap: 4 }, { color: "pink", cap: 4 }, { color: "cyan", cap: 4 }] },
];


// Levels 6-15: gradual ramp. Target win-path ratio decreases ~15-20% per level.
const PALETTE: AlienColor[] = ["cyan", "yellow", "pink", "green", "orange", "purple", "blue", "red"];
function fleet(n: number, galaxies: number, cruisers: number, colours: number, offset: number) {
  const out: { color: AlienColor; cap: 4 | 6 | 8 }[] = [];
  for (let i = 0; i < n; i++) {
    const cap: 4 | 6 | 8 = i < galaxies ? 8 : i < galaxies + cruisers ? 6 : 4;
    out.push({ color: PALETTE[(i + offset) % colours], cap });
  }
  return out;
}
const RAMP: [number, string, number, number, number, number, number, number, number?][] = [
  // id, name, bays, ships, galaxies, cruisers, colours, min ratio, max ratio (default: target ±20%)
  [6, "Comet Carousel", 3, 8, 1, 2, 5, 0.036],
  [7, "Nebula Nook", 4, 8, 1, 3, 6, 0.03],
  [8, "Asteroid Alley", 4, 9, 1, 2, 6, 0.0195, 0.03],
  [9, "Orbit Overflow", 4, 9, 2, 2, 6, 0.021],
  [10, "Wormhole Waltz", 4, 10, 1, 3, 7, 0.017],
  [11, "Gravity Gridlock", 3, 10, 1, 2, 7, 0.014],
  [12, "Pulsar Parade", 4, 10, 2, 3, 7, 0.011],
  [13, "Meteor Mayhem", 4, 10, 2, 3, 6, 0.0075, 0.0118],
  [14, "Quasar Queue", 4, 10, 2, 3, 7, 0.0055, 0.0084],
  [15, "Big Bang Boulevard", 4, 10, 2, 3, 7, 0.002, 0.0054],
  // extra search variants for the hardest level (picked result is renumbered to 15)
  [115, "Big Bang Boulevard", 4, 10, 2, 3, 6, 0.0015, 0.0055],
  [215, "Big Bang Boulevard", 3, 10, 2, 3, 6, 0.0015, 0.0055],
  [315, "Big Bang Boulevard", 4, 11, 2, 3, 7, 0.0015, 0.0055],
];
for (const [levelId, name, bays, n, g, c, colours, lo, hi] of RAMP)
  SPECS.push({ levelId, name, size: 7, bays, ships: fleet(n, g, c, colours, levelId), minWinRatio: hi ? lo : lo * 0.8, maxWinRatio: hi ?? lo * 1.2 });

const only = process.argv.slice(2).map(Number);
for (const spec of SPECS.filter((x) => only.length === 0 || only.includes(x.levelId))) {
  let best: { level: LevelDef; ratio: number; wins: number; total: number; seed: number; initial: number } | null = null;
  const target = (spec.minWinRatio + spec.maxWinRatio) / 2;
  let minSeen = 1;
  for (let seed = 1; seed <= (spec.levelId > 12 ? 6000 : spec.levelId > 5 ? 3000 : 4000); seed++) {
    const r = rng(seed * 31 + spec.levelId);
    const ships = place(spec, r);
    if (!ships) continue;
    const level: LevelDef = {
      levelId: spec.levelId, name: spec.name, board: { width: spec.size, height: spec.size },
      dockingBayCount: spec.bays, ships, passengerGroups: queueFor(ships, r), expectedSolution: [],
    };
    const st = createInitialState(level);
    const initial = legalMoves(st).length;
    if (initial < 2 || initial > Math.ceil(ships.length / 2)) continue; // some ships must start blocked
    const sol = solve(st);
    if (!sol.solvable) continue;
    const p = countPaths(st);
    minSeen = Math.min(minSeen, p.ratio);
    if (p.ratio < spec.minWinRatio || p.ratio > spec.maxWinRatio) continue;
    level.expectedSolution = sol.solution;
    if (!best || Math.abs(p.ratio - target) < Math.abs(best.ratio - target)) best = { level, ...p, seed, initial };
  }
  if (!best) console.log(`LEVEL ${spec.levelId}: NO CANDIDATE (lowest solvable ratio seen ${minSeen.toFixed(4)})`);
  else {
    console.log(`LEVEL ${spec.levelId} seed=${best.seed} winPaths=${best.wins}/${best.total} ratio=${best.ratio.toFixed(3)} initialMoves=${best.initial}`);
    console.log(JSON.stringify(best.level));
  }
}
