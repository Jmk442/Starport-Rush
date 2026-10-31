// Reproduction for the "false jam" report (Daily Challenge, two ships left, fast taps).
// Explores every reachable state of the daily puzzles + all levels and bosses. For every state
// with exactly two parked ships and >= 2 free bays it taps both ships back-to-back (both orders)
// and records any DEADLOCK, plus whether a winning sequence existed from that state.
// Run: npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/false_jam_repro.js
import { dailyLevel, todayKey } from "../src/game/daily";
import { applyTap, createInitialState, legalMoves } from "../src/game/engine";
import { BOSS_LEVELS, LEVELS } from "../src/game/levels";
import { canonicalKey, solve } from "../src/game/solver";
import type { GameState, LevelDef } from "../src/game/types";

declare const console: { log: (...a: unknown[]) => void };

const freeBays = (s: GameState) => s.bays.filter((b) => b === null).length;

export function falseJams(level: LevelDef) {
  const found: { state: GameState; taps: string[]; winnable: boolean }[] = [];
  const seen = new Set<string>();
  const stack = [createInitialState(level)];
  let pairs = 0;
  while (stack.length) {
    const s = stack.pop()!;
    const k = canonicalKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    if (s.status !== "PLAYING") continue;
    const parked = s.ships.filter((x) => x.status === "PARKED");
    if (parked.length === 2 && freeBays(s) >= 2) {
      for (const [a, b] of [[parked[0].id, parked[1].id], [parked[1].id, parked[0].id]]) {
        const r1 = applyTap(s, a);
        if (r1.result !== "OK") continue;
        const r2 = r1.state.status === "PLAYING" ? applyTap(r1.state, b) : r1;
        pairs++;
        const end = r2.state.status === "PLAYING" ? r2.state : r2.state;
        if (r1.state.status === "DEADLOCK" || end.status === "DEADLOCK") found.push({ state: s, taps: [a, b], winnable: solve(s).solvable });
      }
    }
    for (const id of legalMoves(s)) stack.push(applyTap(s, id).state);
  }
  return { found, pairs, states: seen.size };
}

const days = Array.from({ length: 45 }, (_, i) => todayKey(new Date(Date.now() + (i - 30) * 86400000)));
const targets: [string, LevelDef][] = [...days.map((d) => [`daily ${d}`, dailyLevel(d)] as [string, LevelDef]), ...[...LEVELS, ...BOSS_LEVELS].map((l) => [`level ${l.levelId}`, l] as [string, LevelDef])];
let total = 0;
for (const [name, lvl] of targets) {
  const { found, pairs, states } = falseJams(lvl);
  total += found.length;
  if (found.length) {
    const f = found[0];
    const bays = f.state.bays.map((id) => (id ? `${id}(${f.state.ships.find((x) => x.id === id)!.boarded})` : "open")).join(" ");
    console.log(`${name}: ${found.length} jam(s) of ${pairs} two-ship finishes (${states} states). e.g. bays [${bays}] queue ${f.state.queue.map((g) => g.color + g.count).join(",")} taps ${f.taps.join(" -> ")} winnableBefore=${f.winnable}`);
  }
}
console.log(`TOTAL two-ships-left jams: ${total}`);
