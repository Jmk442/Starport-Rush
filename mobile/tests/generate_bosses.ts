// Seeded search for the three Sector Boss puzzles (Round 5): one 12-seat 3x3 mothership
// in the middle of the yard plus escorts. Each boss must be harder (lower win-path ratio)
// than its sector's final level. Run:
//   npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/generate_bosses.js [id...] [seeds]
import { candidate, fleet, type GenSpec } from "../src/game/generator";
import type { AlienColor } from "../src/game/types";

declare const console: { log: (...a: unknown[]) => void };
declare const process: { argv: string[] };

// id, name, boss colour, escorts, galaxies, cruisers, colours, offset, ratio window
const BOSSES: [number, string, AlienColor, number, number, number, number, number, [number, number]][] = [
  [120, "Magma Leviathan", "red", 8, 1, 2, 6, 3, [0.0085, 0.0122]],
  [220, "Magma Leviathan", "red", 9, 1, 2, 6, 3, [0.0085, 0.0122]],
  [320, "Magma Leviathan", "red", 8, 1, 3, 6, 1, [0.0085, 0.0122]],
  [125, "Frost Colossus", "blue", 9, 1, 3, 7, 4, [0.0018, 0.0068]],
  [130, "Neon Overlord", "purple", 9, 2, 2, 7, 5, [0.0003, 0.0024]],
  // retry variants (picked result renumbered: 2xx/3xx/4xx -> 1xx)
  [225, "Frost Colossus", "blue", 10, 1, 3, 7, 4, [0.0018, 0.0068]],
  [325, "Frost Colossus", "blue", 10, 2, 2, 6, 2, [0.0018, 0.0068]],
  [230, "Neon Overlord", "purple", 10, 2, 3, 8, 5, [0.0003, 0.0024]],
  [330, "Neon Overlord", "purple", 11, 2, 3, 7, 1, [0.0003, 0.0024]],
  [430, "Neon Overlord", "purple", 10, 1, 3, 6, 0, [0.0003, 0.0024]],
  [530, "Neon Overlord", "purple", 10, 1, 3, 6, 2, [0.0003, 0.0024]],
  [630, "Neon Overlord", "purple", 10, 2, 2, 6, 0, [0.0003, 0.0024]],
  [730, "Neon Overlord", "purple", 9, 1, 3, 6, 0, [0.0003, 0.0024]],
  [830, "Neon Overlord", "purple", 10, 1, 3, 5, 0, [0.0003, 0.0024]],
  [930, "Neon Overlord", "purple", 11, 1, 3, 6, 0, [0.0003, 0.0024]],
];
const args = process.argv.slice(2).map(Number);
const only = args.filter((a) => a >= 100 && a < 1000);
const seeds = args.find((a) => a >= 1000) ?? 2500;

for (const [levelId, name, color, n, g, c, colours, offset, [lo, hi]] of BOSSES) {
  if (only.length && !only.includes(levelId)) continue;
  const escorts = fleet(n, g, c, colours, offset);
  const spec: GenSpec = { levelId, name, size: 7, bays: 4, ships: [{ color, cap: 12 }, ...escorts], minWinRatio: lo, maxWinRatio: hi };
  const target = (lo + hi) / 2;
  let best: ReturnType<typeof candidate> = null;
  let bestSeed = 0;
  let minSeen = 1;
  for (let seed = 1; seed <= seeds; seed++) {
    const cand = candidate(spec, seed);
    if (!cand) continue;
    minSeen = Math.min(minSeen, cand.ratio);
    if (cand.ratio < lo || cand.ratio > hi) continue;
    if (!best || Math.abs(cand.ratio - target) < Math.abs(best.ratio - target)) {
      best = cand;
      bestSeed = seed;
    }
  }
  if (!best) console.log(`BOSS ${levelId}: NO CANDIDATE (lowest solvable ratio seen ${minSeen.toFixed(4)})`);
  else {
    console.log(`BOSS ${levelId} seed=${bestSeed} winPaths=${best.wins}/${best.total} ratio=${best.ratio.toFixed(4)} initialMoves=${best.initial}`);
    console.log(JSON.stringify(best.level));
  }
}
