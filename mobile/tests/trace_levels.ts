// Prints a full engine event trace of each level's verified solution.
// Run: npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/trace_levels.js
import { applyTap, createInitialState } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { countPaths, solve } from "../src/game/solver";

declare const console: { log: (...a: unknown[]) => void };

for (const level of LEVELS) {
  let s = createInitialState(level);
  const sol = solve(s);
  const paths = countPaths(s);
  console.log(`\n## Level ${level.levelId} "${level.name}" (${level.board.width}x${level.board.height}, ${level.dockingBayCount} bays, ${level.ships.length} ships)`);
  console.log(`BFS shortest solution: ${sol.solution.join(" -> ")} | matches expectedSolution: ${JSON.stringify(sol.solution) === JSON.stringify(level.expectedSolution)}`);
  console.log(`Winning play paths: ${paths.wins}/${paths.total} (${(paths.ratio * 100).toFixed(1)}%)`);
  level.expectedSolution.forEach((id, i) => {
    const r = applyTap(s, id);
    const ev = r.events
      .map((e) => e.event)
      .filter((e) => e.type !== "BOARD")
      .map((e) => ("shipId" in e ? `${e.type}(${e.shipId}${"bay" in e ? `@bay${e.bay + 1}` : ""})` : "color" in e ? `${e.type}(${e.color})` : e.type));
    const boards = r.events.filter((e) => e.event.type === "BOARD").length;
    console.log(`${i + 1}. tap ${id}: ${ev.join(", ")} [${boards} aliens boarded]`);
    s = r.state;
  });
  console.log(`Final status: ${s.status}`);
}
