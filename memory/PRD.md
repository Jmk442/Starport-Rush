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

## Round 3 (2026-09)
- Music-stop bug (iPhone, level 3): root cause found in expo-audio's iOS source. A finished sound effect, or a JS pause(), deactivates the audio session 100 ms later unless the player has keepAudioSessionActive, and only counts players reporting .playing. The game screen paused and replayed music on every level change. Fix: keepAudioSessionActive on all players, music owned by a root-level controller (never paused on level change; pauses only in background), and a 1.5s watchdog. Reproduced with tests/audio_session_model.ts (old build: 1317/2000 simulated L1→L3 runs went silent; fix: 0). Not verified on a real iPhone.
- Levels 6-15 (generator variants included); the win-path ratio falls strictly from L2 to L15 (0.281 → 0.002). Engine tests 56/56. Traces: memory/product/solution_traces.md
- Player handle: funny auto-generated default (e.g. SneakyGlorp42), editable or re-rollable in Settings, shown on the share card
- Hangar: 10 hats + 8 trails unlocked by total stars (max 45). Hats show on queue, victory and share-card aliens; trails show on yard and bay launches. The victory screen shows new unlocks
- Feel: departures 600 ms, "SECTOR CLEAR!" hold 1.1 s before victory, jam hold 0.6 s
- Testing agent iteration_3: all flows passed. Fixed afterwards: settings sheet scrollable on SE, +N badge given its own slot, hangar names wrap, unlock message grammar

## Round 4 (2026-09)
- Daily Challenge: a deterministic puzzle per UTC date is generated on the device (src/game/daily.ts, shared generator in src/game/generator.ts), so it works offline. Scores (combo/undo/time based) are saved locally first, then posted to the online leaderboard (FastAPI /api/daily/{date}/scores + /leaderboard; handle + random device id, no login, best score per device kept atomically). Unsynced scores retry when the Daily screen opens.
- Sector packs: Levels 16-30 = Lava Moon / Ice Nebula / Neon Bazaar. Each has its own theme tokens (yard floor, cells, accent, sky glow) and its own original music loop (music_lava/ice/neon.wav); the track switches per sector. Each pack's difficulty ramps on its own (tests/generate_sectors.ts).
- Combo replays: deterministic SR1 replay code (level + tap list + combo window + handle), shared as a deep link /replay?code=… plus pasteable text. The replay screen re-runs the real engine with the real components. Leaderboard rows with a code get a Watch button.
- Tests: engine 101/101, daily/replay all pass, backend pytest 25/25; testing agent iterations 4-5 passed after fixes (full-message paste, insert race, daily title, nav stack, replay title, ice glow, atomic better-score write).

## Round 5 (2026-10)
- Sector Bosses: extra boss stage after Levels 20 / 25 / 30 (ids 120 / 125 / 130, src/game/levels_bosses.ts): Magma Leviathan, Frost Colossus, Neon Overlord. Each has one 12-seat 3x3 mothership in the middle of the yard (red / blue / purple) with a skull crest, armour ring and quad engines, plus 8-9 escort ships and 4 bays.
- Bosses are solver-verified. Each is harder than its sector's last level but not brutal: the win-path ratio is 0.6-1.0x the last level's (0.0106 vs 0.0132, 0.0064 vs 0.0071, 0.0021 vs 0.0026). Generator: tests/generate_bosses.ts
- Not gated: clearing 20 unlocks both 21 and the boss; play order 20 → 120 → 21 … 30 → 130 → end. No Starport Prime boss. Daily unchanged.
- Boss intro banner (WARNING strip, name, tagline, mothership preview, Engage), own boss music loops (music_boss_lava/ice/neon.wav), siren and fanfare SFX, "BOSS DEFEATED!" flash and shard burst, then "<Boss> Defeated!" victory with a badge. Home has wide boss tiles; share card and replay screen show the boss name. Boss stars persist.
- Jam bugs: no rule bug reproduced. The engine never jams with 2 ships + 2 free bays, and never reaches a stuck state without a jam (exhaustive check: 45 dailies, all levels, all bosses).
- Jam fixes: taps after an already-decided jam no longer skip the animation (the jam used to pop up instantly). The result overlay is now derived from the settled board, so rejected taps can't hide it. Restart fully resets the daily. Bays show "Open" again after Restart (ghost-timer bug).
- Tests: engine 112/112, daily/replay all pass (incl. false-jam + missing-jam regressions); testing agent iterations 6-8 passed.

## Round 6 (2026-10)
- Boss Rush (app/bossrush.tsx, src/game/bossRush.ts, RushClock):
  - Unlocks after all 3 bosses are beaten once and plays bosses 120 → 125 → 130 back to back.
  - One clock runs only from Engage until each boss is cleared; each undo adds +5 s; Undo/Restart keep it running.
  - Leaving by any route (back button, intro quit, browser/Android back) abandons the run.
  - Best time is saved locally first, then posted.
  - API: POST /api/bossrush/scores (keeps the fastest per device); GET /api/bossrush/leaderboard.
- Weekly Cup (app/weekly.tsx, src/game/weekly.ts):
  - Runs Monday–Sunday UTC; score is the sum of each player's best daily score per day.
  - Screen shows standings, days played, a countdown, last week's top 3 and a link to the daily.
  - Opens from a home card and the Daily screen.
  - API: GET /api/weekly/{monday}/leaderboard.
- Server 4xx rejections of daily and rush scores stop retrying and show "saved on this phone".
- Tests:
  - Backend: 52 pass (tests/test_weekly_bossrush.py, test_bossrush_ranks.py).
  - Node: engine 112; daily tests include the weekly and rush clock checks.
  - Testing agent iterations 9–10 passed; the browser-back abandon fix was re-verified with a screenshot run.

## Backlog
- P1: real-iPhone check of boss music/haptics and the jam overlay under device lag
- P1: on-device check of haptics, pitch-rising audio and the image share card in Expo Go on iPhone; frame-rate profiling
- P1: Levels 6+ (generator in tests/generate_levels.ts already supports specs)
- P2: Skia renderer evaluation on native; daily seeded challenge level

## Round 8 (Sep 2026) — Name Safety, Privacy Policy, Home on win screens
- Offensive-handle filter, client (src/game/profanity.ts) + server (backend/moderation.py, kept in sync): leetspeak/repeat-letter aware, with an allow list for innocent words (Scunthorpe, Uranus, Crisis...). If a saved handle is now blocked, a new random one replaces it.
- Report a handle: flag on other players' rows (Daily/Weekly/Boss Rush) -> ReportSheet -> POST /api/reports. Hidden at once on the reporting device; shown as "HiddenPilot" for everyone once 3 different devices report it.
- Privacy Policy: in-app /privacy screen (Home link + Settings row); web copies at /api/privacy and /privacy.html. Contact: johntilv4575@gmail.com.
- Home button on victory screens (Boss Rush: "Home (ends run)").
- Tests: backend 73 passed, engine 112 passed, daily/replay passed; testing agent iteration 11 passed.
- Backlog: harder-to-fake report identity/rate limits; confirm the policy "Last updated" date before store submission.

## Round 9 (Nov 2026) — Hide Diagnostics, Block Players, Champion Hat, Cloud Save
- Diagnostics panel in Settings now shows only in dev builds (__DEV__); production/App Store builds hide it.
- Block: "Block @x" in the report sheet; blocked names are hidden on every board on this device; Settings > Blocked players to unblock.
- Champion Hat: last week's Weekly Cup winner(s) get a crown badge on Daily/Weekly/Boss Rush boards, a Weekly banner, and a champion ribbon + crown hats on their share card (GET /api/champion; `champion` flag on entries).
- Cloud Save (no accounts): Settings > Cloud save creates an 8-char code (POST /api/saves), auto re-uploads on progress changes; restore with a code (GET /api/saves/{code}, rate-limited) merges stars and adopts the saved device id.
- Privacy policy updated (app + /api/privacy). Tests: backend all pass, engine 112, daily/replay pass; testing agent iteration 12 passed, its minor issues fixed.

## Round 10 (Nov 2026) — 1.0.2 (103), web icons, support page
- app.json: version 1.0.2, iOS buildNumber 103 (Bundle ID / Team ID unchanged). mobile/.env untouched: production EXPO_PUBLIC_BACKEND_URL must be set to https://starport-launch.emergent.host in Deployment → Secrets.
- Web icons: build-game.sh moves Expo's assets/node_modules (Ionicons font) to assets/vendor and repoints the bundle; node_modules/ was git-ignored so the font never deployed.
- Support page: backend/static/support.html served at /api/support and copied to /support.html; linked from the privacy page.
