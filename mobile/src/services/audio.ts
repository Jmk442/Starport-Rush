// Original synthesized sounds (scripts/gen_sounds.py) + haptics.
// Music, SFX and haptics are independently toggled via prefs.
//
// Round 3 music fix (iPhone): expo-audio's iOS module deactivates the shared
// AVAudioSession 100 ms after any non-keepalive player finishes or is paused,
// if at that instant no player reports .playing. Short SFX ending while the
// music loop hands off / re-primes after a level-change pause() killed the
// music for good. Now: every player keeps the session active, music is owned by
// the root layout (never paused on level change) and a watchdog re-plays it.
// Reproduction model: tests/audio_session_model.ts.
const PLAYER_OPTS = { keepAudioSessionActive: true };
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import type { MusicTrack } from "@/src/game/sectors";
import type { GameEvent } from "@/src/game/types";
import { getPrefs, usePrefs } from "@/src/services/prefs";

const SOURCES = {
  tap: require("../../assets/sounds/tap.wav"),
  dock: require("../../assets/sounds/dock.wav"),
  blocked: require("../../assets/sounds/blocked.wav"),
  win: require("../../assets/sounds/win.wav"),
  deadlock: require("../../assets/sounds/deadlock.wav"),
  squeak: require("../../assets/sounds/squeak.wav"),
  grumble: require("../../assets/sounds/grumble.wav"),
  cheer: require("../../assets/sounds/cheer.wav"),
  combo: require("../../assets/sounds/combo.wav"),
  board_1: require("../../assets/sounds/board_1.wav"),
  board_2: require("../../assets/sounds/board_2.wav"),
  board_3: require("../../assets/sounds/board_3.wav"),
  board_4: require("../../assets/sounds/board_4.wav"),
  board_5: require("../../assets/sounds/board_5.wav"),
  board_6: require("../../assets/sounds/board_6.wav"),
  board_7: require("../../assets/sounds/board_7.wav"),
  board_8: require("../../assets/sounds/board_8.wav"),
  launch_1: require("../../assets/sounds/launch_1.wav"),
  launch_2: require("../../assets/sounds/launch_2.wav"),
  launch_3: require("../../assets/sounds/launch_3.wav"),
  launch_4: require("../../assets/sounds/launch_4.wav"),
  launch_5: require("../../assets/sounds/launch_5.wav"),
};
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
let music: AudioPlayer | null = null;
let modeSet = false;

function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
}

export function playSfx(name: Sfx, volume = 0.8) {
  if (!getPrefs().sfx) return;
  try {
    ensureMode();
    const p = players[name] ?? (players[name] = createAudioPlayer(SOURCES[name], PLAYER_OPTS));
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // audio unavailable (e.g. web before user gesture) — silent by design
  }
}

const TRACKS: Record<MusicTrack, number> = {
  default: require("../../assets/sounds/music.wav"),
  lava: require("../../assets/sounds/music_lava.wav"),
  ice: require("../../assets/sounds/music_ice.wav"),
  neon: require("../../assets/sounds/music_neon.wav"),
};
const musicPlayers: Partial<Record<MusicTrack, AudioPlayer>> = {};
let track: MusicTrack = "default";
let wantActive = false;

/** Switch the looping track (sector music). Old track pauses; session stays active (keepalive). */
export function setMusicTrack(next: MusicTrack) {
  if (next === track) return;
  musicPlayers[track]?.pause();
  track = next;
  music = musicPlayers[track] ?? null;
  syncMusic(wantActive);
}

export function syncMusic(active: boolean) {
  wantActive = active;
  const want = active && getPrefs().music;
  try {
    if (want) {
      ensureMode();
      if (!music) {
        music = musicPlayers[track] = createAudioPlayer(TRACKS[track], PLAYER_OPTS);
        music.loop = true;
        music.volume = 0.3;
      }
      music.play();
    } else music?.pause();
  } catch {
    // ignore
  }
}

export function currentTrack() {
  return track;
}

export function musicStatus(): "playing" | "stopped" | "off" {
  if (!getPrefs().music) return "off";
  return music?.playing ? "playing" : "stopped";
}

/** Root-level music owner: loops across all screens/levels, pauses in background, self-heals. */
export function useMusicController() {
  const { music: on, loaded } = usePrefs();
  useEffect(() => {
    if (!loaded) return;
    let active = AppState.currentState === "active" || Platform.OS === "web";
    syncMusic(active && on);
    const sub = AppState.addEventListener("change", (s) => {
      active = s === "active";
      syncMusic(active && on);
    });
    const watchdog = setInterval(() => {
      if (active && on && music && !music.playing) syncMusic(true);
    }, 1500);
    return () => {
      sub.remove();
      clearInterval(watchdog);
    };
  }, [on, loaded]);
}

type HapticKind = "light" | "medium" | "heavy" | "rigid" | "success" | "error" | "warning";
export function haptic(kind: HapticKind) {
  if (!getPrefs().haptics || Platform.OS === "web") return;
  const N = Haptics.NotificationFeedbackType;
  const I = Haptics.ImpactFeedbackStyle;
  const p =
    kind === "success"
      ? Haptics.notificationAsync(N.Success)
      : kind === "error"
        ? Haptics.notificationAsync(N.Error)
        : kind === "warning"
          ? Haptics.notificationAsync(N.Warning)
          : Haptics.impactAsync({ light: I.Light, medium: I.Medium, heavy: I.Heavy, rigid: I.Rigid }[kind]);
  p.catch(() => {});
}

/** combo = consecutive departures in a streak (1 = first). */
export function feedbackFor(e: GameEvent, combo = 1) {
  switch (e.type) {
    case "DISPATCH":
      playSfx("tap");
      haptic("medium");
      break;
    case "DOCK":
      playSfx("dock");
      haptic("heavy");
      break;
    case "BOARD":
      playSfx(`board_${Math.min(8, Math.max(1, e.seat))}` as Sfx, 0.55);
      haptic("rigid");
      break;
    case "DEPART":
      playSfx(`launch_${Math.min(5, combo)}` as Sfx);
      haptic("heavy");
      if (combo >= 2) setTimeout(() => {
        playSfx("combo", 0.6);
        haptic("success");
      }, 120);
      break;
    case "BLOCKED":
      playSfx("blocked");
      setTimeout(() => playSfx("squeak", 0.6), 90);
      haptic("error");
      break;
    case "WIN":
      playSfx("win");
      setTimeout(() => playSfx("cheer", 0.7), 350);
      haptic("success");
      setTimeout(() => haptic("heavy"), 200);
      setTimeout(() => haptic("heavy"), 400);
      break;
    case "DEADLOCK":
      playSfx("deadlock");
      setTimeout(() => playSfx("grumble", 0.7), 250);
      haptic("warning");
      break;
  }
}
