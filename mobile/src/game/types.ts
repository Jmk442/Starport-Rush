// Pure game types. No React / RN imports allowed in src/game (engine must run in plain Node tests).

export type AlienColor = "cyan" | "yellow" | "orange" | "pink" | "purple" | "green" | "blue" | "red";
export type ShapeSymbol = "triangle" | "star" | "square" | "circle" | "diamond" | "heart" | "moon" | "flame";
export type Direction = "NORTH" | "SOUTH" | "EAST" | "WEST";
export type ShipStatus = "PARKED" | "DISPATCHING" | "DOCKED" | "BOARDING" | "DEPARTING" | "DEPARTED";

export interface ShipDef {
  id: string;
  color: AlienColor;
  symbol: ShapeSymbol;
  x: number;
  y: number;
  width: number;
  height: number;
  exitDirection: Direction;
  capacity: 4 | 6 | 8 | 12; // 12 = 3x3 boss mothership
}

export interface BossInfo {
  title: string; // e.g. "Magma Leviathan"
  tagline: string;
  shipId: string; // the mothership
}

export interface LevelDef {
  levelId: number;
  name: string;
  board: { width: number; height: number };
  dockingBayCount: number;
  ships: ShipDef[];
  passengerGroups: { color: AlienColor; count: number }[];
  expectedSolution: string[];
  boss?: BossInfo;
}

export interface Ship extends ShipDef {
  status: ShipStatus;
  bay: number | null; // 0-based bay index while docked
  boarded: number;
}

export interface QueueGroup {
  color: AlienColor;
  count: number; // remaining aliens in this group
}

export type GameStatus = "PLAYING" | "WON" | "DEADLOCK";

export interface GameState {
  levelId: number;
  board: { width: number; height: number };
  ships: Ship[];
  bays: (string | null)[]; // ship id per bay
  queue: QueueGroup[]; // front is index 0, exhausted groups removed
  status: GameStatus;
  moves: number;
  undos: number;
  replay: string[]; // ship ids tapped successfully, in order
}

export type GameAction = { type: "TAP_SHIP"; shipId: string } | { type: "UNDO" } | { type: "RESTART" };

export type ActionResult =
  | "OK"
  | "BLOCKED"
  | "NO_FREE_BAY"
  | "NOT_PARKED"
  | "UNKNOWN_SHIP"
  | "GAME_OVER"
  | "NOTHING_TO_UNDO"
  | "UNDONE"
  | "RESTARTED";

// Each event carries the snapshot of the state right after it, so the UI can
// step through them in order (engine stays the single source of truth).
export type GameEvent =
  | { type: "DISPATCH"; shipId: string; bay: number; direction: Direction }
  | { type: "DOCK"; shipId: string; bay: number }
  | { type: "BOARD"; shipId: string; bay: number; color: AlienColor; seat: number }
  | { type: "QUEUE_ADVANCE"; color: AlienColor }
  | { type: "DEPART"; shipId: string; bay: number }
  | { type: "BLOCKED"; shipId: string; blockerId: string | null }
  | { type: "WIN" }
  | { type: "DEADLOCK"; frontColor: AlienColor | null };

export interface TimedEvent {
  event: GameEvent;
  snapshot: GameState;
}

export interface ReplayRecord {
  action: GameAction;
  result: ActionResult;
  moveIndex: number;
}

export interface StepOutput {
  state: GameState;
  history: GameState[]; // undo stack (previous states)
  events: TimedEvent[];
  result: ActionResult;
  record: ReplayRecord;
}
