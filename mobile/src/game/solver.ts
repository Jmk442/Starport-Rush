// Deterministic BFS solver over real engine transitions.
import { applyTap, legalMoves } from "./engine";
import type { GameState } from "./types";

/** Canonical key: parked ship set + per-bay (ship, seats) + queue contents. */
export function canonicalKey(s: GameState): string {
  const parked = s.ships.filter((x) => x.status === "PARKED").map((x) => x.id).sort().join(",");
  const bays = s.bays.map((id) => (id ? `${id}:${s.ships.find((x) => x.id === id)!.boarded}` : "-")).join("|");
  const queue = s.queue.map((g) => `${g.color}${g.count}`).join(",");
  return `${parked}#${bays}#${queue}`;
}

export interface SolveResult {
  solvable: boolean;
  solution: string[]; // shortest sequence of ship taps
  explored: number;
}

export function solve(start: GameState, maxNodes = 200000): SolveResult {
  if (start.status === "WON") return { solvable: true, solution: [], explored: 0 };
  const seen = new Set<string>([canonicalKey(start)]);
  const queue: { s: GameState; path: string[] }[] = [{ s: start, path: [] }];
  let head = 0;
  while (head < queue.length && seen.size < maxNodes) {
    const { s, path } = queue[head++];
    for (const id of legalMoves(s)) {
      const next = applyTap(s, id).state;
      const p = [...path, id];
      if (next.status === "WON") return { solvable: true, solution: p, explored: seen.size };
      const k = canonicalKey(next);
      if (seen.has(k) || next.status === "DEADLOCK") continue;
      seen.add(k);
      queue.push({ s: next, path: p });
    }
  }
  return { solvable: false, solution: [], explored: seen.size };
}

/** Next move on a shortest winning path, or null if no winning path exists. */
export function hint(s: GameState): string | null {
  if (s.status !== "PLAYING") return null;
  return solve(s).solution[0] ?? null;
}
