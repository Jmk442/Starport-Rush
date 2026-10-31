// Daily Challenge + replay tests. Run: node /tmp/starport-tests/tests/daily.test.js
import { applyTap, createInitialState } from "../src/game/engine";
import { dailyLevel, dailyScore, todayKey } from "../src/game/daily";
import { decodeReplay, encodeReplay, findReplayCode } from "../src/game/replay";
import { countPaths, solve } from "../src/game/solver";

declare const console: { log: (...a: unknown[]) => void };
declare const process: { exitCode: number };
declare const Date: { now(): number; new (s?: string): { toISOString(): string; getUTCDay(): number } };

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

console.log(failed ? `\n${failed} failed` : "\nall daily/replay tests passed");
if (failed) process.exitCode = 1;
