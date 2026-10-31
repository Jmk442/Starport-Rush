// Automated engine tests. Run:
//   npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/engine.test.js
import { applyTap, checkInvariants, createInitialState, findBlocker, legalMoves, step } from "../src/game/engine";
import { LEVEL_1, LEVELS } from "../src/game/levels";
import { canonicalKey, countPaths, hint, solve } from "../src/game/solver";
import type { GameState } from "../src/game/types";

declare const process: { exitCode: number };
declare const console: { log: (...a: unknown[]) => void };

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}
function eq<T>(a: T, b: T, msg = "") {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg} expected ${sb} got ${sa}`);
}
function ok(c: boolean, msg: string) {
  if (!c) throw new Error(msg);
}
const ship = (s: GameState, id: string) => s.ships.find((x) => x.id === id)!;
const noViolations = (s: GameState) => eq(checkInvariants(LEVEL_1, s), [], "invariants");

console.log("STARPORT RUSH engine tests");

test("initial state is valid and only cyan + pink are dispatchable", () => {
  const s = createInitialState(LEVEL_1);
  noViolations(s);
  eq(legalMoves(s), ["cyan-01", "pink-01"]);
  eq(findBlocker(s, ship(s, "yellow-01"))?.id, "cyan-01", "yellow blocked by");
});

test("tapping yellow first is BLOCKED by cyan and state unchanged", () => {
  const s = createInitialState(LEVEL_1);
  const r = applyTap(s, "yellow-01");
  eq(r.result, "BLOCKED");
  ok(r.state === s, "state must be unchanged");
  eq(r.events.map((e) => e.event), [{ type: "BLOCKED", shipId: "yellow-01", blockerId: "cyan-01" }]);
});

test("critical flow: cyan -> yellow -> pink wins with exact event trace", () => {
  let s = createInitialState(LEVEL_1);
  let h: GameState[] = [];
  const r1 = step(LEVEL_1, s, h, { type: "TAP_SHIP", shipId: "cyan-01" });
  eq(r1.result, "OK");
  eq(r1.events.map((e) => e.event.type), ["DISPATCH", "DOCK"]);
  eq(r1.state.bays, ["cyan-01", null], "cyan in bay 1");
  eq(ship(r1.state, "cyan-01").boarded, 0, "cyan waits (yellow at front)");
  noViolations(r1.state);
  s = r1.state; h = r1.history;

  const r2 = step(LEVEL_1, s, h, { type: "TAP_SHIP", shipId: "yellow-01" });
  eq(r2.result, "OK");
  const t2 = r2.events.map((e) => e.event.type);
  eq(t2, ["DISPATCH", "DOCK", "BOARD", "BOARD", "BOARD", "BOARD", "QUEUE_ADVANCE", "DEPART",
    "BOARD", "BOARD", "BOARD", "BOARD", "QUEUE_ADVANCE", "DEPART"]);
  eq((r2.events[0].event as { bay: number }).bay, 1, "yellow dispatched to bay 2");
  eq((r2.events[7].event as { shipId: string }).shipId, "yellow-01", "yellow departs first");
  eq((r2.events[13].event as { shipId: string }).shipId, "cyan-01", "cyan departs second");
  eq(r2.state.bays, [null, null]);
  r2.events.forEach((e) => noViolations(e.snapshot));
  s = r2.state; h = r2.history;

  const r3 = step(LEVEL_1, s, h, { type: "TAP_SHIP", shipId: "pink-01" });
  eq(r3.events.map((e) => e.event.type), ["DISPATCH", "DOCK", "BOARD", "BOARD", "BOARD", "BOARD", "QUEUE_ADVANCE", "DEPART", "WIN"]);
  eq((r3.events[0].event as { bay: number }).bay, 0, "pink takes lowest free bay (bay 1)");
  eq(r3.state.status, "WON");
  eq(r3.state.replay, LEVEL_1.expectedSolution);
  eq(r3.state.moves, 3);
  noViolations(r3.state);
});

test("negative: Pink then Cyan -> forward DEADLOCK with yellow at queue front", () => {
  let s = createInitialState(LEVEL_1);
  s = applyTap(s, "pink-01").state;
  eq(s.status, "PLAYING");
  const r = applyTap(s, "cyan-01");
  eq(r.state.status, "DEADLOCK");
  eq(r.state.bays, ["pink-01", "cyan-01"]);
  eq(r.state.queue[0].color, "yellow");
  eq(r.events[r.events.length - 1].event, { type: "DEADLOCK", frontColor: "yellow" });
  eq(legalMoves(r.state), []);
  eq(applyTap(r.state, "yellow-01").result, "GAME_OVER");
  noViolations(r.state);
});

test("undo recovers from deadlock and restart resets", () => {
  let s = createInitialState(LEVEL_1);
  let h: GameState[] = [];
  for (const id of ["pink-01", "cyan-01"]) {
    const r = step(LEVEL_1, s, h, { type: "TAP_SHIP", shipId: id });
    s = r.state; h = r.history;
  }
  eq(s.status, "DEADLOCK");
  const u = step(LEVEL_1, s, h, { type: "UNDO" });
  eq(u.result, "UNDONE");
  eq(u.state.status, "PLAYING");
  eq(u.state.bays, ["pink-01", null]);
  eq(u.state.undos, 1);
  const rs = step(LEVEL_1, u.state, u.history, { type: "RESTART" });
  eq(canonicalKey(rs.state), canonicalKey(createInitialState(LEVEL_1)));
  eq(rs.history.length, 0);
  eq(step(LEVEL_1, rs.state, rs.history, { type: "UNDO" }).result, "NOTHING_TO_UNDO");
});

test("engine is deterministic and does not mutate input state", () => {
  const s = createInitialState(LEVEL_1);
  const before = JSON.stringify(s);
  const a = applyTap(s, "cyan-01");
  const b = applyTap(s, "cyan-01");
  eq(JSON.stringify(s), before, "input mutated");
  eq(JSON.stringify(a), JSON.stringify(b));
});

test("solver finds expected shortest solution from start", () => {
  const r = solve(createInitialState(LEVEL_1));
  eq(r.solvable, true);
  eq(r.solution, LEVEL_1.expectedSolution);
});

test("solver: after pink first, the level is no longer winnable", () => {
  const s = applyTap(createInitialState(LEVEL_1), "pink-01").state;
  const r = solve(s);
  eq(r.solvable, false, "pink first leaves only cyan (deadlock) -> unsolvable");
});

test("hint recommends cyan at start and is on a winning path", () => {
  const s = createInitialState(LEVEL_1);
  eq(hint(s), "cyan-01");
  const s2 = applyTap(s, "cyan-01").state;
  eq(hint(s2), "yellow-01");
});

test("exhaustive: every reachable state satisfies invariants", () => {
  const seen = new Set<string>();
  const stack = [createInitialState(LEVEL_1)];
  while (stack.length) {
    const s = stack.pop()!;
    const k = canonicalKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    noViolations(s);
    for (const id of s.ships.map((x) => x.id)) {
      const r = applyTap(s, id);
      r.events.forEach((e) => noViolations(e.snapshot));
      if (r.result === "OK") stack.push(r.state);
    }
  }
  ok(seen.size > 3, "explored states");
});

for (const level of LEVELS) {
  test(`level ${level.levelId}: passengers per colour exactly match ship capacity`, () => {
    const need: Record<string, number> = {};
    const have: Record<string, number> = {};
    level.ships.forEach((s) => (need[s.color] = (need[s.color] ?? 0) + s.capacity));
    level.passengerGroups.forEach((g) => (have[g.color] = (have[g.color] ?? 0) + g.count));
    eq(Object.keys(have).sort(), Object.keys(need).sort(), "colours");
    for (const c of Object.keys(need)) eq(have[c], need[c], `colour ${c}`);
  });
  test(`level ${level.levelId}: layout valid, solver-verified, expectedSolution wins`, () => {
    const s0 = createInitialState(level);
    eq(checkInvariants(level, s0), [], "invariants");
    const r = solve(s0);
    eq(r.solvable, true, "solvable");
    eq(r.solution, level.expectedSolution, "BFS solution");
    let s = s0;
    for (const id of level.expectedSolution) {
      const out = applyTap(s, id);
      eq(out.result, "OK", `tap ${id}`);
      out.events.forEach((e) => eq(checkInvariants(level, e.snapshot), [], "snapshot invariants"));
      s = out.state;
    }
    eq(s.status, "WON");
  });
  if (level.levelId > 1)
    test(`level ${level.levelId}: has traps (some play paths deadlock) and ships start blocked`, () => {
      const s0 = createInitialState(level);
      const p = countPaths(s0);
      ok(p.wins > 0 && p.wins < p.total, `wins ${p.wins}/${p.total}`);
      ok(legalMoves(s0).length < level.ships.length, "some ships blocked at start");
    });
}

test("difficulty ramps: winning-path ratio strictly decreases from level 2 to the last level", () => {
  const ratios = LEVELS.filter((l) => l.levelId > 1).map((l) => countPaths(createInitialState(l)).ratio);
  for (let i = 1; i < ratios.length; i++) ok(ratios[i] < ratios[i - 1], `ratios ${ratios.map((r) => r.toFixed(3)).join(",")}`);
});

test("bigger ships and more bays appear in later levels", () => {
  ok(LEVELS.some((l) => l.ships.some((s) => s.capacity === 6)), "cruiser present");
  ok(LEVELS.some((l) => l.ships.some((s) => s.capacity === 8)), "galaxy transport present");
  eq(LEVELS.slice(0, 5).map((l) => l.dockingBayCount), [2, 3, 3, 3, 4]);
  eq(LEVELS.map((l) => l.levelId), Array.from({ length: LEVELS.length }, (_, i) => i + 1), "contiguous ids");
  ok(LEVELS.length === 15, `15 levels (got ${LEVELS.length})`);
  for (let i = 1; i < LEVELS.length; i++) ok(LEVELS[i].ships.length >= LEVELS[i - 1].ships.length - 1, "ship count ramps");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
