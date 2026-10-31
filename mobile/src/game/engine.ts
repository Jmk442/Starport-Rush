// Deterministic STARPORT RUSH engine. Single source of truth for all game rules.
// Every action goes through `step`, which returns the new state, ordered
// animation events (each with a snapshot), the action result and a replay record.
import type {
  ActionResult,
  GameAction,
  GameEvent,
  GameState,
  LevelDef,
  Ship,
  StepOutput,
  TimedEvent,
} from "./types";

export function createInitialState(level: LevelDef): GameState {
  return {
    levelId: level.levelId,
    board: { ...level.board },
    ships: level.ships.map((s) => ({ ...s, status: "PARKED", bay: null, boarded: 0 })),
    bays: Array.from({ length: level.dockingBayCount }, () => null),
    queue: level.passengerGroups.filter((g) => g.count > 0).map((g) => ({ ...g })),
    status: "PLAYING",
    moves: 0,
    undos: 0,
    replay: [],
  };
}

function clone(s: GameState): GameState {
  return {
    ...s,
    board: { ...s.board },
    ships: s.ships.map((x) => ({ ...x })),
    bays: [...s.bays],
    queue: s.queue.map((g) => ({ ...g })),
    replay: [...s.replay],
  };
}

export function shipCells(ship: Ship): [number, number][] {
  const cells: [number, number][] = [];
  for (let dx = 0; dx < ship.width; dx++) for (let dy = 0; dy < ship.height; dy++) cells.push([ship.x + dx, ship.y + dy]);
  return cells;
}

/** Cells the ship sweeps from its position to the board edge, in exit direction. */
export function sweptCells(ship: Ship, board: { width: number; height: number }): [number, number][] {
  const out: [number, number][] = [];
  if (ship.exitDirection === "NORTH") {
    for (let y = ship.y - 1; y >= 0; y--) for (let dx = 0; dx < ship.width; dx++) out.push([ship.x + dx, y]);
  } else if (ship.exitDirection === "SOUTH") {
    for (let y = ship.y + ship.height; y < board.height; y++) for (let dx = 0; dx < ship.width; dx++) out.push([ship.x + dx, y]);
  } else if (ship.exitDirection === "EAST") {
    for (let x = ship.x + ship.width; x < board.width; x++) for (let dy = 0; dy < ship.height; dy++) out.push([x, ship.y + dy]);
  } else {
    for (let x = ship.x - 1; x >= 0; x--) for (let dy = 0; dy < ship.height; dy++) out.push([x, ship.y + dy]);
  }
  return out;
}

/** First parked ship blocking the exit path (nearest first), or null if clear. */
export function findBlocker(state: GameState, ship: Ship): Ship | null {
  const occupied = new Map<string, Ship>();
  for (const s of state.ships) {
    if (s.status !== "PARKED" || s.id === ship.id) continue;
    for (const [x, y] of shipCells(s)) occupied.set(`${x},${y}`, s);
  }
  for (const [x, y] of sweptCells(ship, state.board)) {
    const b = occupied.get(`${x},${y}`);
    if (b) return b;
  }
  return null;
}

export function freeBay(state: GameState): number {
  return state.bays.findIndex((b) => b === null);
}

export function canDispatch(state: GameState, shipId: string): ActionResult {
  if (state.status !== "PLAYING") return "GAME_OVER";
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return "UNKNOWN_SHIP";
  if (ship.status !== "PARKED") return "NOT_PARKED";
  if (findBlocker(state, ship)) return "BLOCKED";
  if (freeBay(state) < 0) return "NO_FREE_BAY";
  return "OK";
}

export function legalMoves(state: GameState): string[] {
  return state.ships.filter((s) => canDispatch(state, s.id) === "OK").map((s) => s.id);
}

/** Resolves auto-boarding and departures until the queue front has no matching docked ship. Mutates `s`. */
function resolveBoarding(s: GameState, emit: (e: GameEvent) => void) {
  for (;;) {
    const front = s.queue[0];
    if (!front) return;
    // lowest-numbered bay holding a matching ship with free seats
    let target: Ship | undefined;
    for (const id of s.bays) {
      if (!id) continue;
      const ship = s.ships.find((x) => x.id === id)!;
      if (ship.color === front.color && ship.boarded < ship.capacity) {
        target = ship;
        break;
      }
    }
    if (!target) return;
    target.status = "BOARDING";
    target.boarded += 1;
    front.count -= 1;
    const exhausted = front.count === 0;
    if (exhausted) s.queue.shift();
    emit({ type: "BOARD", shipId: target.id, bay: target.bay!, color: front.color, seat: target.boarded });
    if (exhausted) emit({ type: "QUEUE_ADVANCE", color: front.color });
    if (target.boarded >= target.capacity) {
      const bay = target.bay!;
      target.status = "DEPARTED";
      s.bays[bay] = null;
      target.bay = null;
      emit({ type: "DEPART", shipId: target.id, bay });
    }
  }
}

function settle(s: GameState, emit: (e: GameEvent) => void) {
  for (const sh of s.ships) if (sh.status === "BOARDING") sh.status = "DOCKED";
  const allGone = s.ships.every((x) => x.status === "DEPARTED");
  if (allGone && s.queue.length === 0) {
    s.status = "WON";
    emit({ type: "WIN" });
    return;
  }
  if (legalMoves(s).length === 0) {
    s.status = "DEADLOCK";
    emit({ type: "DEADLOCK", frontColor: s.queue[0]?.color ?? null });
  }
}

/** Pure dispatch (no history). Used by the solver and by `step`. */
export function applyTap(state: GameState, shipId: string): { state: GameState; events: TimedEvent[]; result: ActionResult } {
  const result = canDispatch(state, shipId);
  if (result !== "OK") {
    const events: TimedEvent[] = [];
    if (result === "BLOCKED") {
      const ship = state.ships.find((x) => x.id === shipId)!;
      events.push({ event: { type: "BLOCKED", shipId, blockerId: findBlocker(state, ship)?.id ?? null }, snapshot: state });
    }
    return { state, events, result };
  }
  const s = clone(state);
  const events: TimedEvent[] = [];
  const emit = (e: GameEvent) => events.push({ event: e, snapshot: clone(s) });
  const ship = s.ships.find((x) => x.id === shipId)!;
  const bay = freeBay(s); // lowest-numbered free bay is reserved
  ship.status = "DISPATCHING";
  ship.bay = bay;
  s.bays[bay] = ship.id;
  emit({ type: "DISPATCH", shipId, bay, direction: ship.exitDirection });
  ship.status = "DOCKED";
  s.moves += 1;
  s.replay.push(shipId);
  emit({ type: "DOCK", shipId, bay });
  resolveBoarding(s, emit);
  settle(s, emit);
  // Final snapshot of the last event must equal the final state.
  if (events.length) events[events.length - 1].snapshot = clone(s);
  return { state: s, events, result: "OK" };
}

/** The reducer. history = undo stack of previous states. */
export function step(level: LevelDef, state: GameState, history: GameState[], action: GameAction): StepOutput {
  const moveIndex = state.moves;
  if (action.type === "RESTART") {
    const fresh = createInitialState(level);
    return { state: fresh, history: [], events: [], result: "RESTARTED", record: { action, result: "RESTARTED", moveIndex } };
  }
  if (action.type === "UNDO") {
    if (history.length === 0)
      return { state, history, events: [], result: "NOTHING_TO_UNDO", record: { action, result: "NOTHING_TO_UNDO", moveIndex } };
    const prev = clone(history[history.length - 1]);
    prev.undos = state.undos + 1;
    return { state: prev, history: history.slice(0, -1), events: [], result: "UNDONE", record: { action, result: "UNDONE", moveIndex } };
  }
  const r = applyTap(state, action.shipId);
  return {
    state: r.state,
    history: r.result === "OK" ? [...history, state] : history,
    events: r.events,
    result: r.result,
    record: { action, result: r.result, moveIndex },
  };
}

/** Invariant checks used by tests and dev diagnostics. Returns list of violations. */
export function checkInvariants(level: LevelDef, s: GameState): string[] {
  const errs: string[] = [];
  const totalAliens = level.passengerGroups.reduce((a, g) => a + g.count, 0);
  const boarded = s.ships.reduce((a, x) => a + x.boarded, 0);
  const waiting = s.queue.reduce((a, g) => a + g.count, 0);
  if (boarded + waiting !== totalAliens) errs.push(`alien conservation: ${boarded}+${waiting}!=${totalAliens}`);
  for (const x of s.ships) {
    if (x.boarded > x.capacity) errs.push(`${x.id} over capacity`);
    if (x.status === "DISPATCHING" || x.status === "DOCKED" || x.status === "BOARDING") {
      if (x.bay === null || s.bays[x.bay] !== x.id) errs.push(`${x.id} docked but bay mismatch`);
    } else if (x.bay !== null) errs.push(`${x.id} has bay while ${x.status}`);
  }
  s.bays.forEach((id, i) => {
    if (id && s.ships.find((x) => x.id === id)?.bay !== i) errs.push(`bay ${i} points to wrong ship`);
  });
  const cells = new Set<string>();
  for (const x of s.ships)
    if (x.status === "PARKED")
      for (const [cx, cy] of shipCells(x)) {
        const k = `${cx},${cy}`;
        if (cells.has(k)) errs.push(`overlap at ${k}`);
        if (cx < 0 || cy < 0 || cx >= s.board.width || cy >= s.board.height) errs.push(`${x.id} off board`);
        cells.add(k);
      }
  if (s.queue.some((g) => g.count <= 0)) errs.push("exhausted group still in queue");
  return errs;
}
