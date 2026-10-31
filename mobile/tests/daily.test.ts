// Daily Challenge + replay tests. Run: node /tmp/starport-tests/tests/daily.test.js
import { applyTap, createInitialState, legalMoves, step } from "../src/game/engine";
import { dailyLevel, dailyScore, todayKey } from "../src/game/daily";
import { BOSS_LEVELS, LEVELS } from "../src/game/levels";
import { decodeReplay, encodeReplay, findReplayCode } from "../src/game/replay";
import { canonicalKey, countPaths, solve } from "../src/game/solver";
import { busyActionPolicy, resetsResult } from "../src/game/timing";
import { abandonRush, addRushUndo, advanceRush, clockMs, formatMs, getRush, isRushUnlocked, resumeClock, startRush, stopClock, totalMs, UNDO_PENALTY_MS } from "../src/game/bossRush";
import { daysElapsed, formatCountdown, msUntilWeekEnd, shiftWeek, weekEndKey, weekStartKey } from "../src/game/weekly";

declare const console: { log: (...a: unknown[]) => void };
declare const process: { exitCode: number };
declare const Date: { now(): number; parse(s: string): number; new (s?: string | number): { toISOString(): string; getUTCDay(): number } };

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}
function ok(c: boolean, msg: string) {
  if (!c) throw new Error(msg);
}

const DAYS = Array.from({ length: 14 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

test("today key is YYYY-MM-DD", () => ok(/^\d{4}-\d{2}-\d{2}$/.test(todayKey()), todayKey()));

test("daily puzzle is deterministic per date and differs across dates", () => {
  const a = JSON.stringify(dailyLevel("2026-09-14"));
  ok(a === JSON.stringify(dailyLevel("2026-09-14")), "same date same puzzle");
  const set = new Set(DAYS.map((d) => JSON.stringify(dailyLevel(d).ships)));
  ok(set.size === DAYS.length, `distinct puzzles ${set.size}/${DAYS.length}`);
});

test("every daily puzzle (14 days) is solvable, wins with its solution, and has traps", () => {
  for (const d of DAYS) {
    const lvl = dailyLevel(d);
    const s0 = createInitialState(lvl);
    ok(solve(s0).solvable, `${d} solvable`);
    let s = s0;
    for (const id of lvl.expectedSolution) s = applyTap(s, id).state;
    ok(s.status === "WON", `${d} expected solution wins`);
    const p = countPaths(s0);
    ok(p.wins < p.total, `${d} has losing paths`);
  }
});

test("daily generation is fast enough for a phone (< 1.5s per day in Node)", () => {
  const t = Date.now();
  dailyLevel("2027-01-01");
  const ms = Date.now() - t;
  console.log(`        generated in ${ms} ms`);
  ok(ms < 1500, `${ms}ms`);
});

test("daily score rewards combos, punishes undos/time, floors at 100", () => {
  ok(dailyScore({ moves: 8, undos: 0, seconds: 30, bestCombo: 3 }) > dailyScore({ moves: 8, undos: 1, seconds: 30, bestCombo: 3 }), "undo");
  ok(dailyScore({ moves: 8, undos: 0, seconds: 30, bestCombo: 4 }) > dailyScore({ moves: 8, undos: 0, seconds: 30, bestCombo: 2 }), "combo");
  ok(dailyScore({ moves: 8, undos: 20, seconds: 900, bestCombo: 0 }) === 100, "floor");
});

test("replay code round-trips and reproduces the exact run", () => {
  const lvl = dailyLevel("2026-09-14");
  const code = encodeReplay({ levelRef: "d2026-09-14", fromMove: 2, combo: 3, handle: "SneakyGlorp42", moves: lvl.expectedSolution });
  const back = decodeReplay(code)!;
  ok(!!back && back.handle === "SneakyGlorp42" && back.combo === 3 && back.fromMove === 2, "fields");
  ok(JSON.stringify(back.moves) === JSON.stringify(lvl.expectedSolution), "moves");
  let s = createInitialState(lvl);
  for (const m of back.moves) s = applyTap(s, m).state;
  ok(s.status === "WON", "replayed run wins");
  ok(findReplayCode(`Watch my combo! ${code} 🚀`) === code, "extract from text");
  const link = `exp://host/--/replay?code=${encodeURIComponent(code).replace(/~/g, "%7E")}`;
  ok(findReplayCode(`Watch my COMBO!\nOpen: ${link}\nor paste this code: ${code}`) === code, "extract from full shared message (encoded link first)");
  ok(decodeReplay("SR1.x.y") === null && decodeReplay("garbage") === null, "rejects bad codes");
});

test("false-jam regression (Round 5): fast taps on the last two ships of the daily", () => {
  // Exact user steps on the 2026-10-31 daily: play to two ships left, then tap both quickly.
  const key = "2026-10-31";
  const lvl = dailyLevel(key);
  let s = createInitialState(lvl);
  const sol = lvl.expectedSolution;
  for (const id of sol.slice(0, -2)) s = applyTap(s, id).state;
  const before = s;
  ok(before.ships.filter((x) => x.status === "PARKED").length === 2, "two ships left");
  // winning order never jams, even with the second tap fast-forwarding the first timeline
  let w = applyTap(before, sol[sol.length - 2]);
  ok(w.state.status === "PLAYING" && busyActionPolicy(w.state.status, true, "TAP_SHIP") === "fast-forward", "2nd tap fast-forwards");
  w = applyTap(w.state, sol[sol.length - 1]);
  ok(w.state.status === "WON", "winning order wins");
  // wrong order: the engine jam is genuine (no winning sequence), and a fast 2nd tap is now ignored
  const wrong = applyTap(before, sol[sol.length - 1]);
  ok(wrong.state.status === "DEADLOCK", "wrong order jams");
  ok(!solve(wrong.state).solvable, "jam only when no winning sequence exists");
  ok(busyActionPolicy("DEADLOCK", true, "TAP_SHIP") === "ignore", "tap after the decided jam does not skip the animation");
  ok(busyActionPolicy("DEADLOCK", true, "RESTART") === "fast-forward" && busyActionPolicy("DEADLOCK", false, "TAP_SHIP") === "apply", "restart/undo still work");
  // jam screen Restart returns the daily puzzle to its exact starting state
  const r = step(lvl, wrong.state, [before], { type: "RESTART" });
  ok(JSON.stringify(r.state) === JSON.stringify(createInitialState(lvl)) && r.history.length === 0, "restart = start state");
});

test("jam check is exact: every reachable jam has no winning sequence; 2 ships + 2 free bays never jam (45 dailies, all levels + bosses)", () => {
  const days = Array.from({ length: 45 }, (_, i) => todayKey(new Date(Date.now() + (i - 30) * 86400000) as never));
  const levels = [...days.map((d) => dailyLevel(d)), ...LEVELS, ...BOSS_LEVELS];
  let jams = 0;
  for (const lvl of levels) {
    const seen = new Set<string>();
    const stack = [createInitialState(lvl)];
    while (stack.length) {
      const s = stack.pop()!;
      const k = canonicalKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      if (s.status === "DEADLOCK") {
        jams++;
        ok(legalMoves(s).length === 0, `lvl ${lvl.levelId}: jam with legal moves`);
        continue;
      }
      if (s.status !== "PLAYING") continue;
      const parked = s.ships.filter((x) => x.status === "PARKED");
      if (parked.length === 2 && s.bays.filter((b) => b === null).length >= 2)
        for (const [a, b] of [[parked[0].id, parked[1].id], [parked[1].id, parked[0].id]]) {
          const r1 = applyTap(s, a);
          if (r1.result !== "OK") continue;
          const end = r1.state.status === "PLAYING" ? applyTap(r1.state, b).state : r1.state;
          ok(end.status !== "DEADLOCK", `lvl ${lvl.levelId}: false jam tapping ${a} -> ${b}`);
        }
      for (const id of legalMoves(s)) stack.push(applyTap(s, id).state);
    }
  }
  ok(jams > 0, "explored jams");
});

test("missing-jam regression (Round 5, Level 3): full bays that can't board are always a reported jam", () => {
  // Same user steps on Level 3: fill all 3 bays with ships the front aliens can't board.
  const l3 = LEVELS[2];
  let s = createInitialState(l3);
  for (const id of ["purple-02", "pink-01", "yellow-01", "purple-01"]) s = applyTap(s, id).state;
  ok(s.bays.every((b) => b !== null) && s.status === "DEADLOCK", "Level 3 full-bay jam is detected");
  ok(!solve(s).solvable, "no winning sequence remains");
  // the overlay can't be hidden by taps the engine rejects; only real board changes reset it
  for (const r of ["GAME_OVER", "BLOCKED", "NOT_PARKED", "NO_FREE_BAY", "NOTHING_TO_UNDO"]) ok(!resetsResult(r), `${r} keeps the jam overlay`);
  ok(resetsResult("UNDONE") && resetsResult("RESTARTED") && resetsResult("OK"), "undo/restart/launch reset it");
  ok(applyTap(s, "cyan-01").result === "GAME_OVER", "tap after jam is rejected");
  // every level + boss: any reachable state with full bays and no boarding is a DEADLOCK, never PLAYING
  for (const lvl of [...LEVELS, ...BOSS_LEVELS]) {
    const seen = new Set<string>();
    const stack = [createInitialState(lvl)];
    while (stack.length) {
      const x = stack.pop()!;
      const k = canonicalKey(x);
      if (seen.has(k)) continue;
      seen.add(k);
      if (x.bays.every((b) => b !== null)) ok(x.status !== "PLAYING" || legalMoves(x).length > 0, `lvl ${lvl.levelId}: silent full-bay jam`);
      if (x.status === "PLAYING" && legalMoves(x).length === 0) throw new Error(`lvl ${lvl.levelId}: stuck without jam`);
      if (x.status === "PLAYING") for (const id of legalMoves(x)) stack.push(applyTap(x, id).state);
    }
  }
});

test("weekly cup: UTC Monday weeks, countdown and days elapsed", () => {
  ok(weekStartKey("2026-10-31") === "2026-10-26", "Sat -> Mon");
  ok(weekStartKey("2026-10-26") === "2026-10-26" && weekStartKey("2026-11-01") === "2026-10-26", "Mon/Sun same week");
  ok(weekStartKey("2026-11-02") === "2026-11-02", "next Monday");
  ok(shiftWeek("2026-10-26", -1) === "2026-10-19" && weekEndKey("2026-10-26") === "2026-11-01", "shift/end");
  const sunLate = Date.parse("2026-11-01T23:00:00Z");
  ok(msUntilWeekEnd("2026-10-26", sunLate) === 3600000 && daysElapsed("2026-10-26", sunLate) === 7, "countdown/days");
  ok(formatCountdown(3600000) === "1h 0m" && formatCountdown(2 * 86400000 + 5 * 3600000) === "2d 5h", "format");
});

test("boss rush: clock only while playing, undo penalty, splits, unlock", () => {
  const r = startRush();
  ok(clockMs(r, 0) === 0, "clock idle during intro");
  resumeClock(1000);
  addRushUndo();
  stopClock(31000); // boss 1: 30s
  ok(advanceRush() === 125, "next boss 125");
  ok(clockMs(r, 99999) === 30000, "paused between bosses");
  resumeClock(100000);
  stopClock(140000); // boss 2: 40s
  ok(advanceRush() === 130, "next boss 130");
  resumeClock(200000);
  stopClock(250000); // boss 3: 50s
  ok(JSON.stringify(r.splits) === "[30000,40000,50000]", `splits ${r.splits}`);
  ok(totalMs(r) === 120000 + UNDO_PENALTY_MS, "total = splits + 5s per undo");
  ok(advanceRush() === null, "rush done after 3 bosses");
  ok(formatMs(83456) === "1:23.4", "format");
  ok(!isRushUnlocked({ 120: 3, 125: 1 }) && isRushUnlocked({ 120: 3, 125: 1, 130: 2 }), "unlock after all 3");
  abandonRush();
  ok(getRush() === null, "abandon");
});

console.log(failed ? `\n${failed} failed` : "\nall daily/replay tests passed");
if (failed) process.exitCode = 1;
