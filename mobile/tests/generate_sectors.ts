// Seeded search for the themed sector packs (Levels 16-30). Each pack ramps on its own.
// Run: tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/generate_sectors.js <levelId...>
import { candidate, fleet, type GenSpec } from "../src/game/generator";

declare const console: { log: (...a: unknown[]) => void };
declare const process: { argv: string[] };

// id, name, bays, ships, galaxies, cruisers, colours, target win-path ratio
const PACKS: [number, string, number, number, number, number, number, number][] = [
  // Sector 2 - Lava Moon
  [16, "Magma Merge", 3, 7, 1, 2, 5, 0.045],
  [17, "Cinder Circuit", 3, 8, 1, 2, 5, 0.034],
  [18, "Ember Exit", 3, 8, 1, 3, 6, 0.025],
  [19, "Obsidian Overpass", 3, 9, 1, 2, 6, 0.018],
  [20, "Eruption Express", 3, 9, 2, 2, 6, 0.012],
  // Sector 3 - Ice Nebula
  [21, "Frostbite Ferry", 4, 8, 1, 2, 6, 0.035],
  [22, "Glacier Gate", 4, 8, 1, 3, 6, 0.026],
  [23, "Snowdrift Shuttle", 4, 9, 1, 3, 7, 0.019],
  [24, "Permafrost Pileup", 4, 9, 2, 2, 7, 0.013],
  [25, "Blizzard Bypass", 4, 10, 2, 3, 7, 0.009],
  // Sector 4 - Neon Bazaar
  [26, "Arcade Arrivals", 4, 9, 1, 3, 7, 0.025],
  [27, "Hologram Hub", 4, 9, 2, 2, 7, 0.018],
  [28, "Synthwave Sorting", 4, 10, 1, 3, 8, 0.012],
  [29, "Laser Lane", 4, 10, 2, 3, 8, 0.008],
  [30, "Grand Glitch Terminal", 4, 11, 2, 3, 8, 0.004],
  // retry variants (picked result renumbered: 1xx/2xx -> xx), explicit windows below
  [120, "Eruption Express", 4, 9, 2, 2, 6, 0.014],
  [220, "Eruption Express", 4, 10, 2, 3, 6, 0.014],
  [129, "Laser Lane", 4, 10, 2, 3, 7, 0.0075],
  [229, "Laser Lane", 4, 10, 2, 3, 6, 0.0075],
  [130, "Grand Glitch Terminal", 4, 10, 2, 3, 6, 0.003],
  [230, "Grand Glitch Terminal", 4, 11, 2, 3, 7, 0.003],
];
const WINDOWS: Record<number, [number, number]> = {
  120: [0.009, 0.0205], 220: [0.009, 0.0205], 129: [0.0045, 0.0101], 229: [0.0045, 0.0101], 130: [0.0012, 0.0044], 230: [0.0012, 0.0044],
};
const SEEDS = (id: number) => (id > 100 ? 6000 : 3000);

const only = process.argv.slice(2).map(Number);
for (const [levelId, name, bays, n, g, c, colours, t] of PACKS) {
  if (only.length && !only.includes(levelId)) continue;
  const [lo, hi] = WINDOWS[levelId] ?? [t * 0.75, t * 1.25];
  const spec: GenSpec = { levelId, name, size: 7, bays, ships: fleet(n, g, c, colours, levelId), minWinRatio: lo, maxWinRatio: hi };
  let best: ReturnType<typeof candidate> = null;
  let bestSeed = 0;
  let minSeen = 1;
  for (let seed = 1; seed <= SEEDS(levelId); seed++) {
    const cand = candidate(spec, seed);
    if (!cand) continue;
    minSeen = Math.min(minSeen, cand.ratio);
    if (cand.ratio < spec.minWinRatio || cand.ratio > spec.maxWinRatio) continue;
    if (!best || Math.abs(cand.ratio - t) < Math.abs(best.ratio - t)) {
      best = cand;
      bestSeed = seed;
    }
  }
  if (!best) console.log(`LEVEL ${levelId}: NO CANDIDATE (lowest solvable ratio seen ${minSeen.toFixed(4)})`);
  else {
    console.log(`LEVEL ${levelId} seed=${bestSeed} winPaths=${best.wins}/${best.total} ratio=${best.ratio.toFixed(4)} initialMoves=${best.initial}`);
    console.log(JSON.stringify(best.level));
  }
}
