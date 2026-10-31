// React bridge to the pure engine: holds state + undo history, plays the
// engine's ordered events as a timeline of snapshots for animation.
import { useCallback, useEffect, useRef, useState } from "react";

import { createInitialState, step } from "@/src/game/engine";
import { hint as solverHint } from "@/src/game/solver";
import type { GameAction, GameEvent, GameState, LevelDef, ReplayRecord } from "@/src/game/types";
import { feedbackFor } from "@/src/services/audio";
import { bumpDiag } from "@/src/services/prefs";

// Timing targets from the addendum: dispatch 300-450, dock 200-350, departure 350-600 ms.
export const DURATION: Record<GameEvent["type"], number> = {
  DISPATCH: 380,
  DOCK: 280,
  BOARD: 110,
  QUEUE_ADVANCE: 140,
  DEPART: 480,
  BLOCKED: 0,
  WIN: 0,
  DEADLOCK: 0,
};

export interface BlockedFx {
  shipId: string;
  blockerId: string | null;
  n: number;
}

export function useGameSession(level: LevelDef) {
  const core = useRef({ state: createInitialState(level), history: [] as GameState[] });
  const [display, setDisplay] = useState<GameState>(core.current.state);
  const [canUndo, setCanUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedFx | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [log, setLog] = useState<ReplayRecord[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busyRef = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => {
    bumpDiag("starts");
    return clearTimers;
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      if (action.type === "TAP_SHIP" && busyRef.current) return;
      clearTimers();
      const out = step(level, core.current.state, core.current.history, action);
      core.current = { state: out.state, history: out.history };
      setCanUndo(out.history.length > 0);
      setLog((l) => [...l, out.record]);
      setHintId(null);
      if (out.result === "UNDONE") bumpDiag("undos");
      if (out.result === "RESTARTED") bumpDiag("restarts");
      if (out.result === "BLOCKED") {
        bumpDiag("blockedTaps");
        const e = out.events[0].event as Extract<GameEvent, { type: "BLOCKED" }>;
        setBlocked({ shipId: e.shipId, blockerId: e.blockerId, n: Date.now() });
        feedbackFor(e);
        return;
      }
      if (out.events.length === 0) {
        busyRef.current = false;
        setBusy(false);
        setDisplay(out.state);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      let t = 0;
      out.events.forEach((te, i) => {
        timers.current.push(
          setTimeout(() => {
            setDisplay(te.snapshot);
            feedbackFor(te.event);
            if (te.event.type === "WIN") bumpDiag("wins");
            if (te.event.type === "DEADLOCK") bumpDiag("deadlocks");
            if (i === out.events.length - 1) {
              busyRef.current = false;
              setBusy(false);
            }
          }, t),
        );
        t += DURATION[te.event.type];
      });
    },
    [level],
  );

  const requestHint = useCallback(() => {
    if (busyRef.current) return;
    bumpDiag("hints");
    setHintId(solverHint(core.current.state));
  }, []);

  return { display, canUndo, busy, blocked, hintId, log, dispatch, requestHint, engineState: () => core.current.state };
}

export function starsFor(s: GameState, optimalMoves: number): number {
  if (s.undos === 0 && s.moves <= optimalMoves) return 3;
  if (s.undos <= 2) return 2;
  return 1;
}
