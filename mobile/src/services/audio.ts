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
  boss_alarm: require("../../assets/sounds/boss_alarm.wav"),
  boss_win: require("../../assets/sounds/boss_win.wav"),
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
  boss_lava: require("../../assets/sounds/music_boss_lava.wav"),
  boss_ice: require("../../assets/sounds/music_boss_ice.wav"),
  boss_neon: require("../../assets/sounds/music_boss_neon.wav"),
};
const musicPlayers: Partial<Record<MusicTrack, AudioPlayer>> = {};
let track: MusicTrack = "default";

// Music only plays while a level/boss/daily/rush is actually being played (set by the game
// screen), fades in/out, and leaves a quiet gap between loop passes. Players are created once
// and kept (keepAudioSessionActive) so the Round 3 iPhone fix still holds across level changes.
const MUSIC_VOL = 0.3;
const FADE_IN_MS = 900;
const FADE_OUT_MS = 700;
const LOOP_GAP_MS = 3000;
let wantPlay = false; // gameplay on screen
let appActive = true;
let gestured = Platform.OS !== "web"; // web: no autoplay before the first tap
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let gapTimer: ReturnType<typeof setTimeout> | null = null;
let fadingOut = false;

const shouldPlay = () => wantPlay && appActive && gestured && getPrefs().music;

function trackPlayer(t: MusicTrack) {
  let p = musicPlayers[t];
  if (!p) {
    p = musicPlayers[t] = createAudioPlayer(TRACKS[t], PLAYER_OPTS);
    p.loop = false; // we loop by hand to leave a quiet gap between passes
    p.volume = 0;
    const self = p;
    p.addListener("playbackStatusUpdate", (s) => {
      if (!s.didJustFinish || music !== self) return;
      if (gapTimer) clearTimeout(gapTimer);
      gapTimer = setTimeout(() => {
        gapTimer = null;
        if (music === self && shouldPlay()) {
          self.seekTo(0).catch(() => {});
          fadeIn();
        }
      }, LOOP_GAP_MS);
    });
  }
  return p;
}

function ramp(p: AudioPlayer, to: number, ms: number, done?: () => void) {
  if (fadeTimer) clearInterval(fadeTimer);
  const from = p.volume;
  const steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  fadeTimer = setInterval(() => {
    i += 1;
    p.volume = from + ((to - from) * i) / steps;
    if (i >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      done?.();
    }
  }, 50);
}

function fadeIn(fromStart = false) {
  try {
    ensureMode();
    const p = (music = trackPlayer(track));
    fadingOut = false;
    if (!p.playing) {
      if (fromStart || p.currentTime >= p.duration - 0.05) p.seekTo(0).catch(() => {});
      p.volume = 0;
      p.play();
    }
    ramp(p, MUSIC_VOL, FADE_IN_MS);
  } catch {
    // audio unavailable — silent by design
  }
}

function fadeOut() {
  if (gapTimer) clearTimeout(gapTimer);
  gapTimer = null;
  const p = music;
  if (!p || !p.playing) return;
  fadingOut = true;
  ramp(p, 0, FADE_OUT_MS, () => {
    fadingOut = false;
    if (!shouldPlay()) p.pause();
  });
}

function applyMusic(fromStart = false) {
  if (shouldPlay()) {
    if (fromStart && gapTimer) {
      clearTimeout(gapTimer);
      gapTimer = null;
    }
    if (!gapTimer) fadeIn(fromStart);
  } else fadeOut();
}

/** Called by the game screen: true while a puzzle is being played (not intro/victory/jam).
 * Each new play session starts the loop from the top. */
export function setMusicPlaying(on: boolean) {
  if (on === wantPlay) return;
  wantPlay = on;
  applyMusic(on);
}

/** Switch the track (sector/boss music). Old track stops; players stay alive (keepalive). */
export function setMusicTrack(next: MusicTrack) {
  if (next === track) return;
  musicPlayers[track]?.pause();
  if (gapTimer) clearTimeout(gapTimer);
  gapTimer = null;
  track = next;
  music = musicPlayers[track] ?? null;
  applyMusic();
}

export function currentTrack() {
  return track;
}

export function musicStatus(): "playing" | "stopped" | "off" {
  if (!getPrefs().music) return "off";
  return music?.playing ? "playing" : "stopped";
}

/** Root-level music owner: follows the music toggle, pauses in background, self-heals. */
export function useMusicController() {
  const { music: on, loaded } = usePrefs();
  useEffect(() => {
    if (!loaded) return;
    appActive = AppState.currentState === "active" || Platform.OS === "web";
    applyMusic();
    const sub = AppState.addEventListener("change", (s) => {
      appActive = s === "active" || Platform.OS === "web";
      applyMusic();
    });
    const onGesture = () => {
      gestured = true;
      applyMusic();
    };
    if (Platform.OS === "web" && typeof document !== "undefined") document.addEventListener("pointerdown", onGesture, { once: true });
    // watchdog (Round 3 iPhone fix): re-play if the system stopped it while it should be on
    const watchdog = setInterval(() => {
      if (shouldPlay() && !gapTimer && !fadingOut && music && !music.playing) fadeIn();
    }, 1500);
    return () => {
      sub.remove();
      clearInterval(watchdog);
      if (Platform.OS === "web" && typeof document !== "undefined") document.removeEventListener("pointerdown", onGesture);
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
