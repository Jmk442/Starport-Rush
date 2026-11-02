# StarportRush — Build 103 Apple Release Evidence Pack

Prepared: 2 November 2026 (UTC), read-only review of the source at `/app` plus web-build screenshots.
Labels: **[V] Verified** (seen in code, config, git or a live response) · **[I] Inferred** (reasoned from evidence, not directly observed) · **[U] Unknown** (could not be checked here).

Target identity (from owner): App name **StarportRush** · Apple App ID **6829406590** · Bundle ID **com.johnkenneally.starportrush** · SKU **STARPORTRUSH001** · Team **A8ZXDL6BS2** · target version **1.0.2 (103)**. The legacy App ID is not used anywhere in this pack or in the source (grep of the source: 0 hits) [V].

---

## Executive summary

1. **The source does NOT match the 1.0.2 (103) target.** `app.json` says version **1.0.0**, iOS build number **2** [V]. A build made from this source would upload as 1.0.0 (2), not 1.0.2 (103). The owner must decide and change it before building; nothing was changed in this review.
2. **The production build's backend address is unconfirmed.** `mobile/.env` points `EXPO_PUBLIC_BACKEND_URL` at the **preview** server [V]. The Emergent publish flow is expected to substitute the live address [I], but there's no compiled build here to prove it [U].
3. **The live web copy has an icon-font defect.** On https://starport-launch.emergent.host every Ionicons icon shows as an empty box (screenshot `00_live_site_home_icon_defect.png`). The font URL returns `text/html` instead of the font file [V]. Native iOS builds bundle the font separately, so the app binary is probably unaffected [I]. This matters for web screenshots, so all store screenshots in this pack were taken from the preview web build, where icons render [V].
4. **The privacy answer is not "Data Not Collected".** The app sends a random device ID, a public player handle, gameplay scores and replays, reports, and optional cloud-save progress to the developer's server [V]. All of it is tied to the device ID or save code, so in Apple's terms it is **linked to a (pseudonymous) identifier**, not "unlinked". Nothing is used for tracking, and there are no third-party SDKs for analytics or ads [V].
5. **Age-rating drivers:** user-generated handles with a filter, report and block [V]; public leaderboards and a Weekly Cup / Champion contest with no prizes or money [V]; mild cartoon peril (boss skull crest, "WARNING" banner, shard burst on defeat) [V]. There is no chat, gambling, ads, loot boxes or purchases [V].
6. **Reviewer access:** no login, no permissions, nothing special needed [V].
7. **Live URLs:** the site, `/privacy.html`, `/health` and `/api/health` all return 200 [V]. The policy is dated 1 November 2026 and covers leaderboards, cloud save, reports, blocking and the Champion Hat [V].

---

## A. Build identity

### A1. Source evidence

| Item | Value | Label | Evidence |
|---|---|---|---|
| Source commit (HEAD) | `895d08acb2dc62e9c4cdb3127ce3786563d58e81`, 2026-11-01 15:53 UTC ("Website health check is fixed…") | V | `git log -1` |
| Display name | `Starport Rush` (with a space; App Store Connect name is `StarportRush`) | V | `mobile/app.json:3` |
| Slug | `mobile` (template value, left unchanged) | V | `mobile/app.json:4` |
| Version | **1.0.0** ≠ target 1.0.2 | V (mismatch) | `mobile/app.json:5` |
| iOS build number | **2** ≠ target 103 | V (mismatch) | `mobile/app.json` `ios.buildNumber` |
| Bundle ID | com.johnkenneally.starportrush (matches) | V | `mobile/app.json:12` |
| Apple Team ID | A8ZXDL6BS2 (matches) | V | `mobile/app.json:13` |
| Android package | com.johnkenneally.starportrush | V | `mobile/app.json` `android.package` |
| Legacy bundle ID | `com.emergent.starportlaunch.mzxeao`, used from the first commit `f1a5cc1` (2026-10-31) until `d614b3f` | V | git history of `mobile/app.json` |
| Encryption declaration | `ITSAppUsesNonExemptEncryption: false` and `config.usesNonExemptEncryption: false` | V | `mobile/app.json` `ios` |
| Privacy manifest | NSPrivacyTracking false; reason APIs UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1 | V | `mobile/app.json` `ios.privacyManifests` |
| iPad | `supportsTablet: false` (iPhone only) | V | `mobile/app.json` |
| Orientation | portrait | V | `mobile/app.json` |
| eas.json | none in the repo; Emergent-managed | V | `ls mobile/` |
| Signing / provisioning | handled by the Emergent build service; no certificates or profiles in the repo | I | no `ios/` folder, no `eas.json` |
| Backend URL in source | `EXPO_PUBLIC_BACKEND_URL=https://starport-launch--0ycijz7z.preview.emergentagent.com` (**preview**) | V | `mobile/.env:3` |

**SDK versions [V]** (`mobile/package.json`): expo 58.0.17 · react-native 0.88.0 · react 19.3.0 · expo-router 58.0.25 · expo-audio ~58.0.11 · react-native-reanimated 4.7.1 · expo-font 58.0.9. The backend is FastAPI + Motor/MongoDB under uvicorn (`/etc/supervisor/conf.d/supervisord.conf:4`) [V].

### A2. Compiled-build evidence

| Item | Label |
|---|---|
| IPA / archive, its Info.plist, embedded version and build, signing team, embedded backend URL | **U**: no IPA, build log or TestFlight record is available in this environment. No binary claims are made. |
| Whether builds 1, 2 or 103 already exist in App Store Connect | **U** |
| Whether any build was ever made under `com.emergent.starportlaunch.mzxeao` | **U** |

### A3. Live services

| Check | Result | Label |
|---|---|---|
| `GET https://starport-launch.emergent.host` | 200 `text/html`, 874 B, `<title>Starport Rush</title>` (Expo web export) | V |
| `GET /health` | 200 `{"status":"ok"}` | V |
| `GET /api/health` | 200 `{"status":"ok"}` | V |
| Live leaderboards | `/api/daily/2026-11-02/leaderboard`, `/api/bossrush/leaderboard`, `/api/champion` all 200 | V |
| Live icon font `/assets/node_modules/@react-native-vector-icons/ionicons/fonts/Ionicons.*.ttf` | 200 but `text/html` (the page, not the font), so icons render as boxes on the live web copy | V |

### A4. Known blockers before submitting 1.0.2 (103)

1. Version and build number in `app.json` are 1.0.0 / 2, not 1.0.2 / 103 [V].
2. It's unconfirmed that the production build uses the live backend address rather than the preview one [U].
3. The ascAppId and submit settings can't be put in a repo `eas.json` (Emergent-managed) [V]. Owner or Emergent must confirm the App Store production profile is used [U].
4. The live web icon-font defect [V] doesn't affect the iOS binary [I], but it shows in any screenshot taken from the live site.
5. Owner must confirm content rights for the generated art (section E) [U].

---

## B. Privacy inventory (from the code)

### B1. Data elements

| Data | Where stored | Leaves device? | Tied to | Evidence | Label |
|---|---|---|---|---|---|
| Random device ID `d-<time36>-<rand>` | AsyncStorage/localStorage `sr_device` | Yes, sent with every score, report, champion lookup and cloud save | itself | `mobile/src/services/prefs.ts:94-97`; `leaderboard.ts:88,110,131,177,190`; `reports.ts:85`; `champion.ts:20`; `cloudSave.ts:34` | V |
| Player handle (random default, editable, filtered) | `sr_handle` | Yes, shown publicly on boards | device ID | `prefs.ts:87-91,128-130`; `leaderboard.ts:89,177`; `backend/server.py:91` (HANDLE_RE) | V |
| Daily score, seconds, undos, best combo, moves, optional replay code | local `sr_daily_<date>_*`; server `daily_scores` | Yes | device ID + handle | `leaderboard.ts:51-106`; `server.py:110-119` (model), `203-233` (write) | V |
| Weekly Cup totals | computed on the server from `daily_scores` | Public | device ID | `server.py:378` | V |
| Boss Rush best time, undos, splits | local `sr_rush_*`; server `bossrush_scores` | Yes | device ID + handle | `leaderboard.ts:149-188`; `server.py:396-402,449-479` | V |
| Champion status | derived on the server | Public (badge and banner) | device ID | `server.py:520`; `champion.ts:20` | V |
| Reports (reported handle, reason, board) | local `sr_reported`; server `handle_reports` | Yes | reporter device ID | `reports.ts:76-89`; `server.py:299-318` | V |
| Blocked handles | local `sr_blocked` | Only inside a cloud save | device ID / save code | `reports.ts:46-59`; `cloudSave.ts:10` | V |
| Stars per level, hat, trail, sound/haptic toggles | local `sr_stars_*`, `sr_hat`, `sr_trail`, `sr_music/sfx/haptics` | Only inside a cloud save | save code + device ID | `prefs.ts`; `cloudSave.ts:10-24` | V |
| Cloud save (above progress keys, 8-char code) | server `cloud_saves` {code, device_id, data, updated_at} | Yes, only when the player taps "Create save code" | save code + device ID | `cloudSave.ts:33-36`; `server.py:567-571,582-599` | V |
| Restoring a save adopts the saved device ID | local | n/a | links two devices to one ID | `cloudSave.ts:61` | V |
| On-device diagnostics counters | local `sr_diag_*` | No; panel hidden outside dev builds | n/a | `prefs.ts`; `SettingsSheet.tsx` (`__DEV__`) | V |
| IP address | uvicorn access log (default access logging on); in-memory rate-limit table for save lookups | Server-side processing | request | `supervisord.conf:4` (no `--no-access-log`); `server.py:542,601-609` | V (logging) / U (log retention on the host) |
| Legacy `status_checks` collection (template) | server | Only if `POST /api/status` is called; the app never calls it | n/a | `server.py:62-74`; no client reference | V |

**Third parties [V]:** no analytics, crash-reporting, ads, attribution or social SDKs in `mobile/package.json` (searched for firebase, sentry, amplitude, segment, admob, facebook, branch and mixpanel: 0 hits). Network calls go only to `EXPO_PUBLIC_BACKEND_URL/api` (`leaderboard.ts:6,66-76`). The data is hosted on Emergent's infrastructure (MongoDB), which acts as the developer's host [I].
**Tracking [V]:** no IDFA, no App Tracking Transparency, `NSPrivacyTracking: false`.
**Retention [V]:** no TTL or automatic deletion anywhere in `server.py`. Data is kept until removed by hand. The policy says it's kept "while the game's online features are running".
**Deletion / access [V]:** no in-app server-side deletion. Requests go by email to johntilv4575@gmail.com (`privacy.tsx`, `/privacy.html`). Deleting the app removes local data.

### B2. Mapping to Apple's App Privacy questionnaire

Apple counts data linked to "an account, device, or other identifier" as **linked**. The device ID and save code are such identifiers, so the conservative answer is **Linked to the user: Yes (pseudonymous)**. None of it is used for tracking.

| Apple category → type | Collected? | Purpose | Linked? | Tracking? | Evidence | Label |
|---|---|---|---|---|---|---|
| Identifiers → **Device ID** | Yes (app-generated random ID, not IDFA/IDFV) | App Functionality | Yes | No | `prefs.ts:94-97` | V |
| User Content → **Other User Content** (player handle, reports) | Yes | App Functionality | Yes | No | `prefs.ts:128`; `server.py:299-318` | V |
| User Content → **Gameplay Content** (scores, times, moves, replay codes, cloud-save progress) | Yes | App Functionality | Yes | No | `server.py:110-119,396-402,567-571` | V |
| Usage Data → Product Interaction | No (diagnostics stay on the device and are dev-only) | — | — | — | `SettingsSheet.tsx` | V |
| Diagnostics → Crash / Performance | No | — | — | — | no SDK | V |
| Contact Info, Health, Financial, Location, Contacts, Browsing/Search History, Purchases, Sensitive Info | No | — | — | — | no code paths or permissions | V |
| IP address in server logs | Apple doesn't require declaring IP used only for transmitting or securing requests | — | — | No | `supervisord.conf:4` | I |

Answer to "Do you or your third-party partners use data for tracking?": **No** [V].

---

## C. Age-rating evidence

| Topic | Finding | Evidence | Label |
|---|---|---|---|
| User-generated content | Yes: player handles (3–16 letters, numbers or `_`), shown publicly | `server.py:91`; boards | V |
| Profanity filter | Yes, on the client and the server, leetspeak-aware, with an allow list | `mobile/src/game/profanity.ts`; `backend/moderation.py`; `server.py` (handle validator) | V |
| Report | Yes: flag on each row, 3 reasons; hidden for everyone after 3 distinct reporters | `ReportSheet.tsx`; `server.py:259,299-318` | V |
| Block | Yes, local, all boards, with unblock in Settings | `reports.ts:46-59`; `BlockedSection.tsx` | V |
| Chat / messaging | None | no code | V |
| Social sharing | Yes: system share sheet for a score card image/text and replay links. Nothing is posted automatically. | `ShareCard.tsx:48-51`; `game.tsx:108-111` | V |
| Ads | None | package.json | V |
| In-app purchases | None | no IAP package | V |
| Gambling / simulated gambling / loot boxes | None. Cosmetics unlock only by earning stars. | `cosmetics.ts` | V |
| Contests | Yes: Daily leaderboard, Weekly Cup, Champion Hat. No prizes, money or entry fee; the reward is cosmetic and lasts a week. | `server.py:378,520`; `weekly.tsx` | V |
| Violence | Cartoon only: no characters are harmed. The boss mothership has a skull crest icon, a "WARNING · WARNING" banner, and an 18-shard burst with a "BOSS DEFEATED!" stamp. | `ShipBody.tsx:52`; `BossBurst.tsx:1,9`; screenshot 05 | V |
| Horror, sexual content, drugs, alcohol, tobacco, profanity in content | None in game text or art | source review | I |
| External web links | `mailto:` contact and the privacy web page | `privacy.tsx:89,94` | V |
| Unrestricted web access | No in-app browser to arbitrary sites | source review | V |

Suggested questionnaire answers: Cartoon or Fantasy Violence **Infrequent/Mild**; user-generated content **Yes** (filtered, reportable, blockable); Contests **Yes**; all other categories **None** [I]. Apple calculates the final rating.

---

## D. Reviewer access

| Item | Finding | Label |
|---|---|---|
| Login / accounts | None; the game opens to Home with no sign-in | V |
| Auth integrations | None | V |
| Permissions | None requested: microphone off for expo-audio (`app.json` plugin), no camera, location, photos or notifications | V |
| Network needed? | Only for leaderboards, Champion and cloud save; the campaign plays offline | V (local-first code in `leaderboard.ts`) |
| Special instructions | Boss Rush unlocks after beating the 3 sector bosses (after Levels 20, 25 and 30). The Daily Challenge is available right away. Cloud save is in Settings → Cloud save. Report/Block is the flag icon on another player's leaderboard row. | V |

Suggested Review Notes: "No login required. All content is reachable from the home screen. Leaderboards use random player handles; tap the flag on another player's row to report or block. Cloud save (Settings) uses an 8-character code, with no account."

---

## E. Content rights

| Asset | Provenance | Label | Owner action |
|---|---|---|---|
| App icon `assets/images/icon.png` (1024×1024, RGB) and Android/web icons | Generated in this project on 2026-11-01 by an AI image tool (Gemini image model via Emergent), then flattened to opaque | V (this project's history) | Confirm you accept AI-generated art and its terms |
| Splash `assets/images/splash-image.png` | Same AI generation, 2026-11-01 | V | same |
| Home background `assets/images/home-bg.jpg` | Added 2026-10-31 (commit `f1a5cc1`). Likely AI-generated, but its creation isn't recorded in this review's evidence. | I/U | Confirm the source |
| In-game ships, aliens, hats, bays | Drawn in code with React Native views and Ionicons glyphs, no image files | V (`ShipBody.tsx`, `Hat.tsx`, `AlienFace.tsx`) | None |
| Icons | Ionicons via `@react-native-vector-icons/ionicons` (MIT licence) | I (licence from package knowledge) | Optional: check the package LICENSE |
| Music and SFX (29 WAV files in `assets/sounds/`) | Synthesized by `mobile/scripts/gen_sounds.py` (pure Python math/wave, `random.seed(7)`, no samples) | V | None. These are original works. |
| Fonts | `assets/fonts/SpaceGrotesk.ttf`, `DMSans.ttf`, `SpaceMono-Regular.ttf`, loaded at `app/_layout.tsx:22-24`. Space Grotesk, DM Sans and Space Mono are SIL Open Font License families. | I (the licence name tables couldn't be read here: fontTools isn't installed) | Confirm the files came from the official OFL releases |
| Third-party IP | No trademarks, characters or brand names found in game text. Boss names (Magma Leviathan, Frost Colossus, Neon Overlord) and level names are original. | I | Trademark search if desired |
| Game concept | Original puzzle rules (ships, docking bays, alien queue) | I | None |

---

## F. Live URLs (curl, 2 November 2026)

| URL | Status | Contents | Label |
|---|---|---|---|
| https://starport-launch.emergent.host | 200 `text/html` | Expo web export of the game, `<title>Starport Rush</title>`. Plays in the browser, but icons render as boxes (font served as HTML). | V |
| https://starport-launch.emergent.host/privacy.html | 200 `text/html`, 3,719 B | Starport Rush Privacy Policy, "Last updated: 1 November 2026". Covers on-device data, leaderboards, reports, **cloud save** (4 mentions), blocking, Champion Hat, retention, children, choices, and contact (johntilv4575@gmail.com). | V |
| https://starport-launch.emergent.host/api/privacy | 200 | Same document as /privacy.html | V |
| https://starport-launch.emergent.host/health | 200 `{"status":"ok"}` | — | V |
| https://starport-launch.emergent.host/api/health | 200 `{"status":"ok"}` | — | V |

- **Policy revision date:** 1 November 2026. This date came from the build machine's clock when the policy was written, so the owner should confirm it's correct [V/I].
- **Support URL:** no dedicated support page exists [V]. The only existing candidate is the privacy page, which includes a contact email. Apple requires a support URL with contact information, so `https://starport-launch.emergent.host/privacy.html` qualifies at a minimum; a dedicated support page would be better [I].
- **Marketing URL:** optional field. The only existing candidate is `https://starport-launch.emergent.host` (the playable web build) [V]. Fix the icon-font defect before advertising it.

---

## G. Screenshots

**Method [V]:** headless Chromium (Playwright) with a 440×956 CSS px viewport at deviceScaleFactor 3, which gives **1320×2868 px**, Apple's 6.9" display size. No resizing, cropping, stretching or editing.
- **Source:** the **preview web build** (`https://starport-launch--0ycijz7z.preview.emergentagent.com`, the same source as HEAD), because the live web copy has the icon-font defect. One live-site capture (00) documents that defect.
- **These are web-build captures, not iOS Simulator or device captures.** Web fonts, safe areas and status bar differ from iOS. The owner should check every one, and preferably retake them on an iPhone (6.9") or a simulator from the actual build.
- **Test progress (local only):** for 01, 04, 05, 06 and 08 the browser context was seeded with local storage before load: 3 stars on Levels 1–30 and the three bosses, handle `SneakyGlorp42`, music off. The contexts were thrown away afterwards. No data was written to any server: no scores were posted, no reports made, no saves created.
- **Real data shown:** 09 shows real player handles from the preview database (GigglyMlem49, LoopyQuark50, ZippyMlem75).
- **Mismatch:** the home capture (01) shows the seeded handle; the leaderboard captures show the boards as they actually are.

| # | File | Dimensions | Path | Shows | Seeded? | Store-ready? |
|---|---|---|---|---|---|---|
| 00 | 00_live_site_home_icon_defect.png | 1320×2868 | /app/memory/product/screenshots/00_live_site_home_icon_defect.png | Live site home, with icons as boxes (evidence of the defect) | No | **No**, evidence only |
| 01 | 01_home.png | 1320×2868 | /app/memory/product/screenshots/01_home.png | Home: Daily, Weekly Cup, Boss Rush, sector level grid | Yes | Candidate |
| 02 | 02_puzzle_level1.png | 1320×2868 | /app/memory/product/screenshots/02_puzzle_level1.png | Level 1 "First Contact", start of the puzzle | No (seed loaded but irrelevant) | Candidate |
| 03 | 03_boarding_departure.png | 1320×2868 | /app/memory/product/screenshots/03_boarding_departure.png | After tapping Cyan: ship docked in Bay 1, aliens boarding, 1 move | No | Candidate |
| 04 | 04_advanced_level28.png | 1320×2868 | /app/memory/product/screenshots/04_advanced_level28.png | Level 28 "Synthwave Sorting", 4 bays, 50 aliens | Yes (unlock) | Candidate |
| 05 | 05_boss_neon_overlord_intro.png | 1320×2868 | /app/memory/product/screenshots/05_boss_neon_overlord_intro.png | Boss intro card "Neon Overlord", WARNING banner | Yes (unlock) | Candidate (has a skull icon; see C) |
| 06 | 06_boss_neon_overlord_board.png | 1320×2868 | /app/memory/product/screenshots/06_boss_neon_overlord_board.png | The same boss stage a few seconds later | Yes | Owner to review |
| 07 | 07_daily_leaderboard.png | 1320×2868 | /app/memory/product/screenshots/07_daily_leaderboard.png | Daily hub; today's board is empty ("No scores yet") | No | Weak (empty board) |
| 08 | 08_boss_rush.png | 1320×2868 | /app/memory/product/screenshots/08_boss_rush.png | Boss Rush hub (unlocked), empty all-time board | Yes | Weak (empty board) |
| 09 | 09_weekly_cup_leaderboard.png | 1320×2868 | /app/memory/product/screenshots/09_weekly_cup_leaderboard.png | Weekly Cup with a real Champion banner and last week's podium | No | Candidate (real handles shown) |

The moment ships depart can't be captured reliably as a still; 03 shows boarding in progress [V].

---

## H. Evidence gaps

| Gap | Impact | Label |
|---|---|---|
| No IPA or build log: embedded version and build, signing team, embedded backend URL and entitlements are unverified | High | U |
| Version and build in source are 1.0.0 (2), not 1.0.2 (103) | High: the upload won't match the plan | V |
| Production backend address in the build (the source points at preview) | High | U |
| Which build profile and distribution Emergent uses, and the ascAppId mapping | Medium | U |
| Existing build numbers in App Store Connect / TestFlight | Medium | U |
| Live web icon-font defect | Medium for the web and marketing URL; low for the iOS binary | V (defect) / I (no iOS impact) |
| Font licence files not read | Low | I |
| Origin of `home-bg.jpg` | Low | U |
| Server log retention for IP addresses on Emergent hosting | Low | U |
| Screenshots are web captures, not device or simulator | Medium for store accuracy | V |

---

## Recommended App Store Connect values

| Field | Suggested value | Label |
|---|---|---|
| App name | StarportRush | V (owner) |
| Bundle ID | com.johnkenneally.starportrush | V |
| SKU | STARPORTRUSH001 | V (owner) |
| Version | 1.0.2, **only after `app.json` is changed to 1.0.2**; otherwise the build uploads as 1.0.0 | V (mismatch) |
| Build | 103, **only after `ios.buildNumber` is set to 103** | V (mismatch) |
| Primary category | Games → Puzzle | I |
| Secondary category | Games → Casual (optional) | I |
| Privacy Policy URL | https://starport-launch.emergent.host/privacy.html | V (200) |
| Support URL | https://starport-launch.emergent.host/privacy.html, the only existing page with contact info; a dedicated support page is recommended | I |
| Marketing URL | Leave blank, or https://starport-launch.emergent.host once the icon-font defect is fixed | I |
| App Privacy | Identifiers: Device ID. User Content: Other User Content, Gameplay Content. All for App Functionality, **linked**, not tracking. Everything else: not collected. | V/I (see B2) |
| Tracking | No | V |
| Export compliance | Uses non-exempt encryption: No (already set in `app.json`) | V |
| Age rating | Cartoon/Fantasy Violence: Infrequent/Mild; Contests: Yes; user-generated content with moderation: Yes; everything else None | I |
| Sign-in required | No; leave demo account blank | V |
| Review notes | See section D | V |
| Content rights | "Does not contain, show or access third-party content": answer after the owner confirms section E | U |
| Screenshots (6.9") | Pick from 01–05 and 09 after the owner reviews them, or retake on a device | V (web captures) |

*No gameplay, configuration, identifiers or privacy text were changed while preparing this pack. No build, upload or publish was started.*
