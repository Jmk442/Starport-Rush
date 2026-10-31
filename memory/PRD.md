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

## Backlog
- P0 (Stage 2, after owner approval): Levels 2-5, Commuter Cruiser (6) / Galaxy Transport (8) in levels, 3-4 bays
- P1: on-device performance profiling on iPhone; Skia renderer evaluation on native
- P2: level select animations, more music variety
