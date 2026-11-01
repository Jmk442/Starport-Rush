// Cloud Save (no accounts): upload progress, get a save code, restore it on another device.
// Restoring merges stars (never loses progress), takes the saved handle/cosmetics/settings and
// adopts the saved device id so leaderboard entries follow the player.
import { request } from "@/src/services/leaderboard";
import { getPrefs, onPrefsChange, reloadPrefs, STAR_IDS } from "@/src/services/prefs";
import { getReportLists, onReportListsChange, reloadReportLists } from "@/src/services/reports";
import { storage } from "@/src/utils/storage";

type Value = string | number | boolean | null;
const SIMPLE = ["sr_handle", "sr_hat", "sr_trail", "sr_music", "sr_sfx", "sr_haptics", "sr_reported", "sr_blocked"];
const RUSH = ["sr_rush_ms", "sr_rush_undos", "sr_rush_splits"];

export const formatCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

async function collect() {
  const data: Record<string, Value> = {};
  for (const id of STAR_IDS) {
    const v = await storage.getItem(`sr_stars_${id}`, 0);
    if (v) data[`sr_stars_${id}`] = v;
  }
  for (const k of [...SIMPLE, ...RUSH]) {
    const v = await storage.getItem<Value>(k, null);
    if (v !== null && v !== "") data[k] = v;
  }
  return data;
}

export async function getSaveCode() {
  return ((await storage.getItem("sr_save_code", "")) as string) || null;
}

/** Uploads progress; returns the (stable) save code for this device. */
export async function uploadSave() {
  const r = await request<{ code: string }>("/saves", { method: "POST", body: JSON.stringify({ device_id: getPrefs().deviceId, data: await collect() }) });
  await storage.setItem("sr_save_code", r.code);
  return r.code;
}

export async function restoreSave(code: string): Promise<"restored" | "not-found" | "busy" | "offline"> {
  let save: { code: string; device_id: string; data: Record<string, Value> };
  try {
    save = await request(`/saves/${encodeURIComponent(code.trim())}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return msg === "HTTP 429" ? "busy" : /HTTP 4\d\d/.test(msg) ? "not-found" : "offline";
  }
  const d = save.data;
  for (const [k, v] of Object.entries(d)) {
    if (k.startsWith("sr_stars_")) {
      const local = (await storage.getItem(k, 0)) ?? 0;
      await storage.setItem(k, Math.max(local, Number(v) || 0));
    } else if (SIMPLE.includes(k)) {
      await storage.setItem(k, v);
    }
  }
  const localRush = (await storage.getItem("sr_rush_ms", 0)) ?? 0;
  if (d.sr_rush_ms && (!localRush || Number(d.sr_rush_ms) < localRush)) {
    for (const k of RUSH) await storage.setItem(k, d[k] ?? null);
    await storage.setItem("sr_rush_synced", false);
  }
  await storage.setItem("sr_device", save.device_id);
  await storage.setItem("sr_save_code", save.code);
  await reloadPrefs();
  await reloadReportLists();
  return "restored";
}

// Once a save code exists, re-upload a few seconds after stars, cosmetics or the handle change.
let started = false;
export function startCloudAutoSync() {
  if (started) return;
  started = true;
  const snap = () => {
    const p = getPrefs();
    return JSON.stringify([p.stars, p.hat, p.trail, p.handle, p.loaded, getReportLists()]);
  };
  let last = snap();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const changed = () => {
    const s = snap();
    if (s === last) return;
    last = s;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (getPrefs().loaded && (await getSaveCode())) uploadSave().catch(() => {});
    }, 3000);
  };
  onPrefsChange(changed);
  onReportListsChange(changed);
}
