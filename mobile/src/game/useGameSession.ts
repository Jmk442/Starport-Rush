// React bridge to the pure engine: holds state + undo history, plays the
// engine's ordered events as a timeline of snapshots for animation.
// Snappy: a tap during playback fast-forwards the current timeline instantly.
import { useCallback, useEffect, useRef, useState } from "react";

import { createInitialState, step } from "@/src/game/engine";
import { hint as solverHint } from "@/src/game/solver";
import type { GameAction, GameEvent, GameState, LevelDef, ReplayRecord } from "@/src/game/types";
import { feedbackFor } from "@/src/services/audio";
import { bumpDiag } from "@/src/services/prefs";

// Timing targets from the addendum: dispatch 300-450, dock 200-350, departure 350-600 ms.
export const DURATION: Record<GameEvent["type"], number> = {
  DISPATCH: 300,
  DOCK: 200,
  BOARD: 70,
  QUEUE_ADVANCE: 90,
  DEPART: 380,
  BLOCKED: 0,
  WIN: 0,
  DEADLOCK: 0,
};

const COMBO_WINDOW_MS = 2600;

export type Mood = "idle" | "cheer" | "shock" | "grumpy" | "party";

export interface BlockedFx {
  shipId: string;
  blockerId: string | null;
  n: number;
}

export interface ComboFx {
  count: number;
  n: number;
}

export function useGameSession(level: LevelDef) {
  const core = useRef({ state: createInitialState(level), history: [] as GameState[] });
  const [display, setDisplay] = useState<GameState>(core.current.state);
  const [canUndo, setCanUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedFx | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [combo, setCombo] = useState<ComboFx | null>(null);
  const [bestCombo, setBestCombo] = useState(0);
  const [mood, setMood] = useState<{ mood: Mood; n: number }>({ mood: "idle", n: 0 });
  const [log, setLog] = useState<ReplayRecord[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busyRef = useRef(false);
  const comboRef = useRef({ count: 0, last: 0 });
  const startedAt = useRef(Date.now());

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const react = (m: Mood) => setMood((p) => ({ mood: m, n: p.n + 1 }));
  const pending = useRef<GameEvent[]>([]);

  /** Side effects of one engine event: combo chain, reactions, feedback, diagnostics. */
  const handleEvent = (ev: GameEvent, quiet: boolean) => {
    let c = 1;
    if (ev.type === "DEPART") {
      const now = Date.now();
      const cr = comboRef.current;
      cr.count = now - cr.last < COMBO_WINDOW_MS ? cr.count + 1 : 1;
      cr.last = now;
      c = cr.count;
      if (c >= 2) {
        setCombo({ count: c, n: now });
        setBestCombo((b) => Math.max(b, c));
      }
      react("cheer");
    }
    if (ev.type === "BOARD" && ev.seat === 1) react("cheer");
    if (!quiet) feedbackFor(ev, c);
    if (ev.type === "WIN") {
      bumpDiag("wins");
      react("party");
    }
    if (ev.type === "DEADLOCK") {
      bumpDiag("deadlocks");
      react("grumpy");
    }
  };

  useEffect(() => {
    bumpDiag("starts");
    return clearTimers;
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      if (busyRef.current) {
        // fast-forward: land on the final state of the running timeline and
        // still apply skipped steps' combo/diagnostics (sounds only for departures)
        clearTimers();
        const skipped = pending.current;
        pending.current = [];
        skipped.forEach((ev) => handleEvent(ev, ev.type !== "DEPART"));
        setDisplay(core.current.state);
        busyRef.current = false;
        setBusy(false);
      }
      const out = step(level, core.current.state, core.current.history, action);
      core.current = { state: out.state, history: out.history };
      setCanUndo(out.history.length > 0);
      setLog((l) => [...l, out.record]);
      setHintId(null);
      if (out.result === "UNDONE" || out.result === "RESTARTED") {
        comboRef.current = { count: 0, last: 0 };
        react("idle");
      }
      if (out.result === "UNDONE") bumpDiag("undos");
      if (out.result === "RESTARTED") {
        bumpDiag("restarts");
        setBestCombo(0);
        startedAt.current = Date.now();
      }
      if (out.result === "BLOCKED") {
        bumpDiag("blockedTaps");
        comboRef.current = { count: 0, last: 0 };
        const e = out.events[0].event as Extract<GameEvent, { type: "BLOCKED" }>;
        setBlocked({ shipId: e.shipId, blockerId: e.blockerId, n: Date.now() });
        react("shock");
        feedbackFor(e);
        return;
      }
      if (out.events.length === 0) {
        setDisplay(out.state);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      pending.current = out.events.map((te) => te.event);
      let t = 0;
      out.events.forEach((te, i) => {
        timers.current.push(
          setTimeout(() => {
            setDisplay(te.snapshot);
            pending.current.shift();
            handleEvent(te.event, false);
            if (i === out.events.length - 1) {
              busyRef.current = false;
              setBusy(false);
            }
          }, t),
        );
        t += DURATION[te.event.type];
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level],
  );

  const requestHint = useCallback(() => {
    bumpDiag("hints");
    setHintId(solverHint(core.current.state));
  }, []);

  return {
    display,
    canUndo,
    busy,
    blocked,
    hintId,
    combo,
    bestCombo,
    mood,
    log,
    dispatch,
    requestHint,
    elapsedMs: () => Date.now() - startedAt.current,
  };
}

export function starsFor(s: GameState): number {
  if (s.undos === 0) return 3;
  if (s.undos <= 2) return 2;
  return 1;
}
