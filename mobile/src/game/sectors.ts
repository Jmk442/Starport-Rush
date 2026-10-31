// Themed sector packs: each has its own look (theme tokens) and music loop.
import type { ThemeColors } from "@/src/theme";

export type SectorKey = "prime" | "lava" | "ice" | "neon";
export type MusicTrack = "default" | "lava" | "ice" | "neon" | "boss_lava" | "boss_ice" | "boss_neon";

export interface Sector {
  boss?: { id: number; music: MusicTrack }; // extra boss stage after `last` (id = 100 + last)
  key: SectorKey;
  name: string;
  tagline: string;
  first: number;
  last: number;
  music: MusicTrack;
  floor: keyof ThemeColors;
  cell: keyof ThemeColors;
  accent: keyof ThemeColors;
  sky: keyof ThemeColors;
}

export const SECTORS: Sector[] = [
  { key: "prime", name: "Starport Prime", tagline: "Where every pilot starts", first: 1, last: 15, music: "default", floor: "primeFloor", cell: "primeCell", accent: "primeAccent", sky: "primeSky" },
  { key: "lava", name: "Lava Moon", tagline: "Hot pads. Hotter tempers.", first: 16, last: 20, music: "lava", boss: { id: 120, music: "boss_lava" }, floor: "lavaFloor", cell: "lavaCell", accent: "lavaAccent", sky: "lavaSky" },
  { key: "ice", name: "Ice Nebula", tagline: "Slippery queues, frosty aliens", first: 21, last: 25, music: "ice", boss: { id: 125, music: "boss_ice" }, floor: "iceFloor", cell: "iceCell", accent: "iceAccent", sky: "iceSky" },
  { key: "neon", name: "Neon Bazaar", tagline: "The galaxy's loudest terminal", first: 26, last: 30, music: "neon", boss: { id: 130, music: "boss_neon" }, floor: "neonFloor", cell: "neonCell", accent: "neonAccent", sky: "neonSky" },
];

export const DAILY_SECTOR: Sector = { ...SECTORS[3], key: "neon", name: "Daily Challenge", tagline: "Same puzzle for everyone today" };

export function sectorFor(levelId: number): Sector {
  return SECTORS.find((s) => (levelId >= s.first && levelId <= s.last) || s.boss?.id === levelId) ?? SECTORS[0];
}

/** Music for a level: boss stages get their own loop. */
export function musicFor(levelId: number): MusicTrack {
  const s = sectorFor(levelId);
  return s.boss?.id === levelId ? s.boss.music : s.music;
}
