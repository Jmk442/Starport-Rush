// Name safety: report a leaderboard handle. Reported handles are hidden on this device right
// away; the server hides a handle for everyone once several devices report it.
import { useEffect, useSyncExternalStore } from "react";

import { request } from "@/src/services/leaderboard";
import { getPrefs } from "@/src/services/prefs";
import { storage } from "@/src/utils/storage";

export type ReportBoard = "daily" | "weekly" | "bossrush";
export type ReportReason = "offensive" | "impersonation" | "other";

let reported: string[] = [];
let blocked: string[] = []; // handles this player never wants to see again (local only)
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function load() {
  loading ??= (async () => {
    const raw = String((await storage.getItem("sr_reported", "")) ?? "");
    reported = raw.split(",").filter(Boolean);
    blocked = String((await storage.getItem("sr_blocked", "")) ?? "").split(",").filter(Boolean);
    emit();
  })();
  return loading;
}

function useList(get: () => string[]) {
  useEffect(() => {
    load();
  }, []);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    get,
  );
}

/** Lowercased handles this device has reported. */
export const useReportedHandles = () => useList(() => reported);
/** Lowercased handles this player blocked: filtered out of every board. */
export const useBlockedHandles = () => useList(() => blocked);

export async function blockHandle(handle: string) {
  await load();
  if (isBlocked(blocked, handle)) return;
  blocked = [...blocked, handle]; // original case for display; matching is case-insensitive
  emit();
  await storage.setItem("sr_blocked", blocked.join(","));
}

export async function unblockHandle(handle: string) {
  await load();
  blocked = blocked.filter((h) => h.toLowerCase() !== handle.toLowerCase());
  emit();
  await storage.setItem("sr_blocked", blocked.join(","));
}

export const isBlocked = (list: string[], handle: string) => list.some((h) => h.toLowerCase() === handle.toLowerCase());

/** Cloud save auto-sync hooks. */
export const getReportLists = () => [reported, blocked];
export function onReportListsChange(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Re-read both lists from storage (after a cloud-save restore). */
export function reloadReportLists() {
  loading = null;
  return load();
}

export async function reportHandle(handle: string, board: ReportBoard, reason: ReportReason): Promise<"sent" | "offline"> {
  await load();
  const key = handle.toLowerCase();
  if (!reported.includes(key)) {
    reported = [...reported, key];
    emit();
    await storage.setItem("sr_reported", reported.join(","));
  }
  try {
    await request(`/reports`, { method: "POST", body: JSON.stringify({ reporter_device_id: getPrefs().deviceId, handle, board, reason }) });
    return "sent";
  } catch {
    return "offline";
  }
}
