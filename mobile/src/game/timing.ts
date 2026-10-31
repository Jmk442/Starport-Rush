// Event timeline durations (ms). Pure module so Node tests can share it.
// Addendum targets: dispatch 300-450, dock 200-350, departure 350-600.
// Round 3: departures and clears hold longer so the graphics can be seen.
import type { GameEvent } from "./types";

export const DURATION_TABLE: Record<GameEvent["type"], number> = {
  DISPATCH: 300,
  DOCK: 220,
  BOARD: 70,
  QUEUE_ADVANCE: 90,
  DEPART: 600,
  BLOCKED: 0,
  WIN: 0,
  DEADLOCK: 0,
};

/**
 * What to do with an action that arrives while a timeline is still animating.
 * Round 5 false-jam fix: a tap that lands after the engine already ended the game
 * (WON/DEADLOCK) must NOT fast-forward. Before, it skipped the docking animation and
 * popped "Terminal Jammed" instantly, so the jam looked like it was caused by the
 * second tap. Now the board settles and the result shows after the normal hold.
 */
export function busyActionPolicy(coreStatus: "PLAYING" | "WON" | "DEADLOCK", busy: boolean, action: "TAP_SHIP" | "UNDO" | "RESTART"): "apply" | "fast-forward" | "ignore" {
  if (!busy) return "apply";
  if (action === "TAP_SHIP" && coreStatus !== "PLAYING") return "ignore";
  return "fast-forward";
}

/** Only actions that change the board hide a shown/pending result. Rejected taps (GAME_OVER,
 * BLOCKED, ...) must never hide the jam/victory overlay (Round 5 missing-jam hardening). */
export const resetsResult = (result: string) => result === "OK" || result === "UNDONE" || result === "RESTARTED";

/** Hold on the cleared/jammed board before the result overlay appears. */
export const RESULT_HOLD_MS = { WIN: 1100, DEADLOCK: 600 };
