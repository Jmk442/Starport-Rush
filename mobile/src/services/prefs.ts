// Local settings, progress and privacy-preserving diagnostics (counters only,
// never leaves the device, no identifiers).
import { useSyncExternalStore } from "react";

import { type HatId, randomHandle, type TrailId } from "@/src/game/cosmetics";
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
  deviceId: string; // random, local only: lets the leaderboard keep one best score per device
  handle: string; // auto-generated funny default, player can change it
  hat: HatId;
  trail: TrailId;
}

const MAX_LEVEL_STORED = 30;
let prefs: Prefs = {
  loaded: false,
  music: true,
  sfx: true,
  haptics: true,
  stars: {},
  diag: Object.fromEntries(DIAG_KEYS.map((k) => [k, 0])) as Record<DiagKey, number>,
  handle: "",
  deviceId: "",
  hat: "none",
  trail: "none",
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
  let handle: string = (await storage.getItem("sr_handle", "")) ?? "";
  if (!handle) {
    handle = randomHandle();
    storage.setItem("sr_handle", handle);
  }
  const hat = ((await storage.getItem("sr_hat", "none")) ?? "none") as HatId;
  let deviceId: string = (await storage.getItem("sr_device", "")) ?? "";
  if (!deviceId) {
    deviceId = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    storage.setItem("sr_device", deviceId);
  }
  const trail = ((await storage.getItem("sr_trail", "none")) ?? "none") as TrailId;
  set({ loaded: true, music: music ?? true, sfx: sfx ?? true, haptics: haptics ?? true, stars, diag, handle, hat, trail, deviceId });
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
  await storage.removeItem("sr_hat");
  await storage.removeItem("sr_trail");
  set({ stars: {}, hat: "none", trail: "none", diag: Object.fromEntries(DIAG_KEYS.map((k) => [k, 0])) as Record<DiagKey, number> });
}

export function setHandle(handle: string) {
  set({ handle });
  storage.setItem("sr_handle", handle);
}

export function equip(kind: "hat" | "trail", id: HatId | TrailId) {
  set({ [kind]: id } as Partial<Prefs>);
  storage.setItem(`sr_${kind}`, id);
}
