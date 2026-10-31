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

/** Hold on the cleared/jammed board before the result overlay appears. */
export const RESULT_HOLD_MS = { WIN: 1100, DEADLOCK: 600 };
