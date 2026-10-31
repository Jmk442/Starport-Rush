// Weekly Cup helpers: UTC weeks run Monday 00:00 -> Sunday 23:59 (same day boundaries as the Daily).
const DAY = 86400000;

/** Monday (YYYY-MM-DD, UTC) of the week containing `dateKey`. */
export function weekStartKey(dateKey: string) {
  const t = Date.parse(`${dateKey}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  return new Date(t - dow * DAY).toISOString().slice(0, 10);
}

export function shiftWeek(startKey: string, weeks: number) {
  return new Date(Date.parse(`${startKey}T00:00:00Z`) + weeks * 7 * DAY).toISOString().slice(0, 10);
}

export function weekEndKey(startKey: string) {
  return new Date(Date.parse(`${startKey}T00:00:00Z`) + 6 * DAY).toISOString().slice(0, 10);
}

export function msUntilWeekEnd(startKey: string, now = Date.now()) {
  return Math.max(0, Date.parse(`${startKey}T00:00:00Z`) + 7 * DAY - now);
}

/** Days of the week that have started so far (1..7). */
export function daysElapsed(startKey: string, now = Date.now()) {
  return Math.min(7, Math.max(1, Math.floor((now - Date.parse(`${startKey}T00:00:00Z`)) / DAY) + 1));
}

export function formatCountdown(ms: number) {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}
