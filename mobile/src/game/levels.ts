import type { LevelDef } from "./types";

// Level 1 JSON exactly as specified in the Technical Addendum v1.1 (section 4).
export const LEVEL_1: LevelDef = {
  levelId: 1,
  name: "First Contact",
  board: { width: 6, height: 6 },
  dockingBayCount: 2,
  ships: [
    { id: "cyan-01", color: "cyan", symbol: "triangle", x: 4, y: 0, width: 1, height: 2, exitDirection: "NORTH", capacity: 4 },
    { id: "yellow-01", color: "yellow", symbol: "star", x: 1, y: 1, width: 2, height: 1, exitDirection: "EAST", capacity: 4 },
    { id: "pink-01", color: "pink", symbol: "circle", x: 2, y: 4, width: 2, height: 1, exitDirection: "EAST", capacity: 4 },
  ],
  passengerGroups: [
    { color: "yellow", count: 4 },
    { color: "cyan", count: 4 },
    { color: "pink", count: 4 },
  ],
  expectedSolution: ["cyan-01", "yellow-01", "pink-01"],
};

export const LEVELS: LevelDef[] = [LEVEL_1];
export const TOTAL_PLANNED_LEVELS = 5; // Stage 1 builds Level 1 only.

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.levelId === id);
}
