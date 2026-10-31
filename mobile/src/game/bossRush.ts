// Boss Rush: the 3 sector bosses back to back with one combined clock.
// Clock runs from "Engage" on each boss until it is cleared (intros and between-boss
// screens don't count). Undo/Restart keep the clock running; each undo adds a penalty.
export const RUSH_BOSSES = [120, 125, 130];
export const UNDO_PENALTY_MS = 5000;

export interface RushRun {
  index: number; // current boss 0..2
  splits: number[]; // ms spent on each boss (clock only)
  segStart: number | null; // clock running since
  undos: number;
}

let run: RushRun | null = null;

export const startRush = () => (run = { index: 0, splits: [0, 0, 0], segStart: null, undos: 0 });
export const getRush = () => run;
export const abandonRush = () => (run = null);

export function resumeClock(now = Date.now()) {
  if (run && run.segStart === null) run.segStart = now;
}

export function stopClock(now = Date.now()) {
  if (!run || run.segStart === null) return;
  run.splits[run.index] += now - run.segStart;
  run.segStart = null;
}

export function addRushUndo() {
  if (run) run.undos += 1;
}

/** Moves to the next boss; returns its level id or null when the rush is done. */
export function advanceRush() {
  if (!run) return null;
  run.index += 1;
  return RUSH_BOSSES[run.index] ?? null;
}

export function clockMs(r: RushRun, now = Date.now()) {
  return r.splits.reduce((a, b) => a + b, 0) + (r.segStart !== null ? now - r.segStart : 0);
}

export const totalMs = (r: RushRun, now = Date.now()) => clockMs(r, now) + r.undos * UNDO_PENALTY_MS;

export const isRushUnlocked = (stars: Record<number, number>) => RUSH_BOSSES.every((id) => (stars[id] ?? 0) > 0);

/** 83456 -> "1:23.4" */
export function formatMs(ms: number) {
  const t = Math.floor(ms / 100);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${t % 10}`;
}
