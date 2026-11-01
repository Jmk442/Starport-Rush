// Name safety: report a leaderboard handle. Reported handles are hidden on this device right
// away; the server hides a handle for everyone once several devices report it.
import { useEffect, useSyncExternalStore } from "react";

import { request } from "@/src/services/leaderboard";
import { getPrefs } from "@/src/services/prefs";
import { storage } from "@/src/utils/storage";

export type ReportBoard = "daily" | "weekly" | "bossrush";
export type ReportReason = "offensive" | "impersonation" | "other";

let reported: string[] = [];
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function load() {
  loading ??= (async () => {
    const raw = String((await storage.getItem("sr_reported", "")) ?? "");
    reported = raw.split(",").filter(Boolean);
    emit();
  })();
  return loading;
}

/** Lowercased handles this device has reported. */
export function useReportedHandles() {
  useEffect(() => {
    load();
  }, []);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => reported,
  );
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
