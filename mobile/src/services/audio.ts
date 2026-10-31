// Original synthesized sounds (scripts/gen_sounds.py) + haptics.
// Music, SFX and haptics are independently toggled via prefs.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import type { GameEvent } from "@/src/game/types";
import { getPrefs } from "@/src/services/prefs";

const SOURCES = {
  tap: require("../../assets/sounds/tap.wav"),
  dock: require("../../assets/sounds/dock.wav"),
  board: require("../../assets/sounds/board.wav"),
  launch: require("../../assets/sounds/launch.wav"),
  blocked: require("../../assets/sounds/blocked.wav"),
  win: require("../../assets/sounds/win.wav"),
  deadlock: require("../../assets/sounds/deadlock.wav"),
};
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
let music: AudioPlayer | null = null;
let modeSet = false;

function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
}

export function playSfx(name: Sfx) {
  if (!getPrefs().sfx) return;
  try {
    ensureMode();
    const p = players[name] ?? (players[name] = createAudioPlayer(SOURCES[name]));
    p.volume = name === "board" ? 0.5 : 0.8;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // audio unavailable (e.g. web before user gesture) — silent by design
  }
}

export function syncMusic(active: boolean) {
  const want = active && getPrefs().music;
  try {
    if (want) {
      ensureMode();
      if (!music) {
        music = createAudioPlayer(require("../../assets/sounds/ambient.wav"));
        music.loop = true;
        music.volume = 0.35;
      }
      music.play();
    } else music?.pause();
  } catch {
    // ignore
  }
}

export function haptic(kind: "light" | "medium" | "success" | "error") {
  if (!getPrefs().haptics || Platform.OS === "web") return;
  if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (kind === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  else Haptics.impactAsync(kind === "light" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function feedbackFor(e: GameEvent) {
  switch (e.type) {
    case "DISPATCH":
      playSfx("tap");
      haptic("light");
      break;
    case "DOCK":
      playSfx("dock");
      haptic("medium");
      break;
    case "BOARD":
      playSfx("board");
      break;
    case "DEPART":
      playSfx("launch");
      haptic("medium");
      break;
    case "BLOCKED":
      playSfx("blocked");
      haptic("error");
      break;
    case "WIN":
      playSfx("win");
      haptic("success");
      break;
    case "DEADLOCK":
      playSfx("deadlock");
      haptic("error");
      break;
  }
}
