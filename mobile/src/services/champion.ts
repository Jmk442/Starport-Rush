// Champion Hat: last week's Weekly Cup winner wears it all this week (server decides who).
import { useEffect, useSyncExternalStore } from "react";

import { request } from "@/src/services/leaderboard";

export interface ChampionInfo {
  week_start: string;
  expires: string; // next Monday (UTC): the hat comes off then
  champions: { handle: string; total: number; is_you: boolean }[];
  is_you: boolean;
}

let info: ChampionInfo | null = null;
let fetchedFor: string | null = null;
const subs = new Set<() => void>();

function fetchFor(deviceId: string) {
  if (fetchedFor === deviceId) return;
  fetchedFor = deviceId;
  request<ChampionInfo>(`/champion?device_id=${encodeURIComponent(deviceId)}`)
    .then((i) => {
      info = i;
      subs.forEach((f) => f());
    })
    .catch(() => {
      fetchedFor = null; // offline: try again next time
    });
}

/** Current champion info (null until loaded / offline). Refetches when the device id changes. */
export function useChampion(deviceId: string) {
  useEffect(() => {
    if (deviceId) fetchFor(deviceId);
  }, [deviceId]);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => info,
  );
}
