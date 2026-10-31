// Local settings, progress and privacy-preserving diagnostics (counters only,
// never leaves the device, no identifiers).
import { useSyncExternalStore } from "react";

import { storage } from "@/src/utils/storage";

export const DIAG_KEYS = ["starts", "wins", "deadlocks", "undos", "restarts", "hints", "blockedTaps"] as const;
export type DiagKey = (typeof DIAG_KEYS)[number];

export interface Prefs {
  loaded: boolean;
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  stars: Record<number, number>; // best stars per level
  diag: Record<DiagKey, number>;
}

const MAX_LEVEL_STORED = 5;
let prefs: Prefs = {
  loaded: false,
  music: true,
  sfx: true,
  haptics: true,
  stars: {},
  diag: Object.fromEntries(DIAG_KEYS.map((k) => [k, 0])) as Record<DiagKey, number>,
};
const listeners = new Set<() => void>();

function set(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  listeners.forEach((l) => l());
}

export function getPrefs() {
  return prefs;
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
    () => prefs,
  );
}

export async function loadPrefs() {
  if (prefs.loaded) return;
  const [music, sfx, haptics] = await Promise.all([
    storage.getItem("sr_music", true),
    storage.getItem("sr_sfx", true),
    storage.getItem("sr_haptics", true),
  ]);
  const stars: Record<number, number> = {};
  for (let i = 1; i <= MAX_LEVEL_STORED; i++) {
    const v = await storage.getItem(`sr_stars_${i}`, 0);
    if (v) stars[i] = v;
  }
  const diag = { ...prefs.diag };
  for (const k of DIAG_KEYS) diag[k] = (await storage.getItem(`sr_diag_${k}`, 0)) ?? 0;
  set({ loaded: true, music: music ?? true, sfx: sfx ?? true, haptics: haptics ?? true, stars, diag });
}

export function setToggle(key: "music" | "sfx" | "haptics", value: boolean) {
  set({ [key]: value } as Partial<Prefs>);
  storage.setItem(`sr_${key}`, value);
}

export function recordStars(levelId: number, stars: number) {
  if ((prefs.stars[levelId] ?? 0) >= stars) return;
  set({ stars: { ...prefs.stars, [levelId]: stars } });
  storage.setItem(`sr_stars_${levelId}`, stars);
}

export function bumpDiag(key: DiagKey) {
  const v = prefs.diag[key] + 1;
  set({ diag: { ...prefs.diag, [key]: v } });
  storage.setItem(`sr_diag_${key}`, v);
}

export async function resetProgress() {
  for (let i = 1; i <= MAX_LEVEL_STORED; i++) await storage.removeItem(`sr_stars_${i}`);
  for (const k of DIAG_KEYS) await storage.removeItem(`sr_diag_${k}`);
  set({ stars: {}, diag: Object.fromEntries(DIAG_KEYS.map((k) => [k, 0])) as Record<DiagKey, number> });
}
