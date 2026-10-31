# STARPORT RUSH — PRD

## Original problem statement
Expo app requirement: /app/memory/product/requirements.md (+ full_spec.md). Premium casual iOS puzzle game "STARPORT RUSH": directional traffic-clearing, passenger-sorting, limited-capacity puzzle in an intergalactic spaceport. Offline, no backend, no login, no ads. Stage 1: build Level 1 only and stop at the owner approval gate (no Levels 2-5, no publish, no GitHub, no paid services).

## User choices
- RN Views + Reanimated rendering (Skia not used; batched alien queue rendering)
- Original synthesized SFX + ambient loop; music/SFX/haptics independently toggled
- Assistance = solver-backed Hint

## Architecture
- `src/game/` pure TS engine (no RN imports): `types.ts`, `levels.ts` (Level 1 JSON verbatim), `engine.ts` (reducer `step` -> state, ordered events w/ snapshots, result, replay record; invariants), `solver.ts` (BFS, canonical keys, hint)
- `src/game/useGameSession.ts` React bridge: undo history, event timeline playback (dispatch 380ms, dock 280ms, depart 480ms)
- `src/components/game/*` ShipBody/YardShip/LaunchYard/DockBays/AlienQueue/ControlBar/ResultOverlay; `SettingsSheet`, `Starfield`
- `src/services/prefs.ts` (local settings, stars, diagnostics counters), `src/services/audio.ts` (expo-audio + expo-haptics)
- `app/index.tsx` Home, `app/game.tsx` Game (30/15/45/10 portrait split, safe-area aware)
- `scripts/gen_sounds.py` generates `assets/sounds/*.wav`
- Tests: `tests/engine.test.ts` → `npx tsc -p tests/tsconfig.json && node /tmp/starport-tests/tests/engine.test.js` (10/10 pass)

## Implemented (2026-09)
- Level 1 playable end-to-end; blocked-tap feedback; deadlock (Pink→Cyan) with Undo/Restart; victory with stars + Next Level; hint; settings; local progress + diagnostics
- Testing agent iteration_1: all flows pass; nav double-Home bug fixed (back/dismissTo)

## Round 2 (2026-09)
- Levels 2-5 from a seeded generator, all solver-verified: L2 6x6/3 bays, L3 6x6/3 bays, L4 7x7/3 bays + Galaxy Transport, L5 7x7/4 bays + 2 Galaxy Transports. Share of play paths that win: 28.1% / 13.9% / 7.4% / 4.3%. Passengers per colour exactly match capacity. Traces are in memory/product/solution_traces.md
- Game feel: snappier timings, taps during an animation skip ahead, combo chain (2.6s window) with popup and yard shake, boarding sounds rising in pitch, combo launch sounds rising in pitch, stronger haptics (heavy/rigid/notification), goofy alien faces (blink, jump, shock, cheer, grumpy) with speech-bubble quips, dancing aliens on victory, upbeat music loop
- Share card: captures an image via react-native-view-shot + expo-sharing on native; falls back to text Share, then clipboard
- Progressive level unlocking; Next Level goes straight to the next level
- Engine tests 26/26; testing agent iteration_2 passed every flow. Its 3 minor issues (combos lost on fast taps, desktop share fallback, share backdrop and queue padding) are fixed

## Backlog
- P1: on-device check of haptics, pitch-rising audio and the image share card in Expo Go on iPhone; frame-rate profiling
- P1: Levels 6+ (generator in tests/generate_levels.ts already supports specs)
- P2: Skia renderer evaluation on native; daily seeded challenge level
