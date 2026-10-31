import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlienFace } from "@/src/components/game/AlienFace";
import { AlienQueue } from "@/src/components/game/AlienQueue";
import { BossBurst } from "@/src/components/game/BossBurst";
import { BossIntro } from "@/src/components/game/BossIntro";
import { ComboPopup } from "@/src/components/game/ComboPopup";
import { ControlBar } from "@/src/components/game/ControlBar";
import { ShareCardModal, type ShareData } from "@/src/components/game/ShareCard";
import { DockBays } from "@/src/components/game/DockBays";
import { LaunchYard } from "@/src/components/game/LaunchYard";
import { ResultOverlay } from "@/src/components/game/ResultOverlay";
import { SettingsSheet } from "@/src/components/SettingsSheet";
import { Starfield } from "@/src/components/Starfield";
import { newlyUnlocked, totalStars } from "@/src/game/cosmetics";
import { dailyLevel, dailyScore } from "@/src/game/daily";
import { getLevel, LEVEL_1, nextLevelId } from "@/src/game/levels";
import { encodeReplay } from "@/src/game/replay";
import { DAILY_SECTOR, musicFor, sectorFor } from "@/src/game/sectors";
import type { LevelDef } from "@/src/game/types";
import { starsFor, useGameSession } from "@/src/game/useGameSession";
import { COLOR_LABEL } from "@/src/game/visuals";
import { setMusicTrack } from "@/src/services/audio";
import { saveLocal, syncDaily } from "@/src/services/leaderboard";
import { getPrefs, recordStars, usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function GameScreen() {
  const params = useLocalSearchParams<{ level?: string; daily?: string }>();
  const level = useMemo(
    () => (params.daily ? dailyLevel(params.daily) : (getLevel(Number(params.level ?? 1)) ?? LEVEL_1)),
    [params.level, params.daily],
  );
  // keyed so switching level resets the whole session
  return <GameBody key={params.daily ?? level.levelId} level={level} daily={params.daily} />;
}

const PARTY: ("cyan" | "pink" | "yellow" | "green")[] = ["cyan", "pink", "yellow", "green"];

function GameBody({ level, daily }: { level: LevelDef; daily?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const session = useGameSession(level);
  const { display } = session;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyInfo, setDailyInfo] = useState<{ score: number; best: boolean; sync: string } | null>(null);
  const prefs = usePrefs();
  const sector = daily ? DAILY_SECTOR : sectorFor(level.levelId);
  const track = daily ? sector.music : musicFor(level.levelId);
  useEffect(() => setMusicTrack(track), [track]);
  const boss = daily ? undefined : level.boss;
  const nextId = daily ? null : nextLevelId(level.levelId);
  const isLast = !daily && nextId === null;
  const nextBoss = nextId !== null && nextId >= 100;
  const [intro, setIntro] = useState(!!boss);
  const goNext = () => {
    if (daily) router.dismissTo("/daily");
    else if (isLast) router.dismissTo({ pathname: "/", params: { stage: "complete" } });
    else router.setParams({ level: String(nextId) });
  };
  const baysFull = display.bays.every((b) => b !== null);

  const replayCode = () => {
    const r = session.comboReplay();
    if (r.count < 2) return null;
    return encodeReplay({ levelRef: daily ? `d${daily}` : String(level.levelId), fromMove: r.from, combo: r.count, handle: prefs.handle, moves: r.moves });
  };
  const shareReplay = async () => {
    const code = replayCode();
    if (!code) return;
    const link = Linking.createURL("/replay", { queryParams: { code } });
    const msg = `Watch my COMBO ×${session.bestCombo} in Starport Rush! 🚀\nOpen: ${link}\nor paste this code in "Watch a replay": ${code}`;
    try {
      await Share.share({ message: msg });
      setToast("Replay shared!");
    } catch {
      await Clipboard.setStringAsync(msg).catch(() => {});
      setToast("Replay code copied to clipboard");
    }
  };

  const stars = display.status === "WON" ? starsFor(display) : 0;
  const [unlocks, setUnlocks] = useState<string[]>([]);
  useEffect(() => {
    if (display.status !== "WON") return;
    if (daily) {
      const seconds = Math.max(1, Math.round(session.elapsedMs() / 1000));
      const score = dailyScore({ moves: display.moves, undos: display.undos, seconds, bestCombo: session.bestCombo });
      const result = { score, seconds, undos: display.undos, bestCombo: session.bestCombo, moves: display.moves, replayCode: replayCode() };
      setDailyInfo({ score, best: false, sync: "saving" });
      saveLocal(daily, result).then(async (best) => {
        setDailyInfo({ score, best, sync: "posting" });
        const s = await syncDaily(daily);
        setDailyInfo({ score, best, sync: s === "offline" ? "offline" : best ? "posted" : "kept" });
      });
      return;
    }
    const before = totalStars(getPrefs().stars);
    recordStars(level.levelId, stars);
    setUnlocks(newlyUnlocked(before, totalStars(getPrefs().stars)).map((c) => c.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display.status, stars, level.levelId, daily]);
  const won = display.status === "WON";
  // Boss stages hold the board a little longer for the big victory moment.
  const [bossHoldDone, setBossHoldDone] = useState(false);
  useEffect(() => {
    if (!boss || !session.resultReady) return setBossHoldDone(false);
    const t = setTimeout(() => setBossHoldDone(true), 1300);
    return () => clearTimeout(t);
  }, [boss, session.resultReady]);
  const showVictory = won && session.resultReady && (!boss || bossHoldDone);

  // Portrait split: 30% queue, 15% docks, 45% yard, 10% controls (safe-area aware).
  const avail = height - insets.top - insets.bottom;
  const queueH = avail * 0.3;
  const dockH = avail * 0.15;
  const yardH = avail * 0.45;
  const ctrlH = avail * 0.1;
  const cell = Math.floor(Math.min((width - 32) / display.board.width, (yardH - 28) / display.board.height));
  const playing = display.status === "PLAYING";
  const frontColor = display.queue[0]?.color;

  return (
    <View style={styles.root} testID="game-screen">
      <Starfield />
      <LinearGradient colors={[colors[sector.sky], "transparent"]} locations={[0, 0.45]} style={styles.sky} pointerEvents="none" />
      <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom, flex: 1 }}>
        <View style={{ height: queueH }}>
          <View style={styles.topBar}>
            <Pressable testID="game-home-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={[styles.levelNum, { color: colors[sector.accent] }]} numberOfLines={1} testID="game-sector-name">
                {daily ? `DAILY · ${daily}` : `${sector.name.toUpperCase()} · ${boss ? "SECTOR BOSS" : `LEVEL ${level.levelId}`}`}
              </Text>
              <Text style={styles.levelName} testID="game-level-name" numberOfLines={1}>
                {level.name}
              </Text>
            </View>
            <View style={styles.moves}>
              <Text style={styles.movesNum} testID="game-moves">
                {display.moves}
              </Text>
              <Text style={styles.movesLabel}>moves</Text>
            </View>
          </View>
          <AlienQueue queue={display.queue} width={width} height={queueH - 52} mood={session.mood} hat={prefs.hat} />
        </View>
        <DockBays state={display} height={dockH} />
        <View style={{ height: yardH }}>
          <LaunchYard
            state={display}
            cell={cell}
            hintId={session.hintId}
            blocked={session.blocked}
            combo={session.combo}
            floor={colors[sector.floor]}
            cellColor={colors[sector.cell]}
            onTap={(id) => session.dispatch({ type: "TAP_SHIP", shipId: id })}
          />
          <ComboPopup combo={session.combo} />
          {won && !session.resultReady && !boss && (
            <Animated.View entering={ZoomIn.springify().damping(9)} pointerEvents="none" style={styles.clearBanner} testID="sector-clear-banner">
              <Text style={styles.clearText}>SECTOR CLEAR!</Text>
            </Animated.View>
          )}
        </View>
        <ControlBar
          height={ctrlH}
          buttons={[
            { id: "undo", icon: "arrow-undo", label: "Undo", onPress: () => session.dispatch({ type: "UNDO" }), disabled: !session.canUndo },
            { id: "restart", icon: "refresh", label: "Restart", onPress: () => session.dispatch({ type: "RESTART" }) },
            { id: "hint", icon: "bulb", label: "Hint", onPress: session.requestHint, disabled: !playing || session.busy },
            { id: "settings", icon: "settings-sharp", label: "Settings", onPress: () => setSettingsOpen(true) },
          ]}
        />
      </View>

      {won && boss && !showVictory && <BossBurst accent={colors[sector.accent]} />}
      {showVictory && (
        <ResultOverlay
          kind="victory"
          title={daily ? "Daily Cleared!" : boss ? `${boss.title} Defeated!` : isLast ? "Starport Legend!" : "Launch Complete!"}
          message={`Cleared in ${display.moves} moves${display.undos ? ` with ${display.undos} undo${display.undos > 1 ? "s" : ""}` : ""}${session.bestCombo >= 2 ? ` · best combo ×${session.bestCombo}` : ""}.`}
          stars={stars}
          actions={[
            daily
              ? { id: "leaderboard", label: "View Leaderboard", primary: true, onPress: goNext }
              : { id: "next", label: isLast ? "All Sectors Cleared" : nextBoss ? "Face the Sector Boss" : `Next Level (${nextId})`, primary: true, onPress: goNext },
            {
              id: "share",
              label: "Share Score",
              onPress: () =>
                setShareData({
                  levelId: level.levelId,
                  levelName: daily ? `Daily ${daily}` : boss ? `Boss · ${boss.title}` : level.name,
                  moves: display.moves,
                  stars,
                  bestCombo: session.bestCombo,
                  seconds: Math.round(session.elapsedMs() / 1000),
                  handle: prefs.handle,
                  hat: prefs.hat,
                  score: dailyInfo?.score,
                }),
            },
            ...(session.bestCombo >= 2 ? [{ id: "share-replay", label: `Share Combo ×${session.bestCombo} Replay`, onPress: shareReplay }] : []),
            ...(daily ? [] : [{ id: "replay", label: "Replay", onPress: () => session.dispatch({ type: "RESTART" }) }]),
          ]}
        >
          {boss && (
            <View style={[styles.bossBadge, { borderColor: colors[sector.accent] }]} testID="victory-boss-badge">
              <Ionicons name="trophy" size={18} color={colors.yellow} />
              <Text style={styles.bossBadgeText} numberOfLines={2}>
                {sector.name} boss defeated · 12-seat mothership launched
              </Text>
            </View>
          )}
          {dailyInfo && (
            <View style={styles.dailyBox} testID="victory-daily-score">
              <Text style={styles.dailyScore}>{dailyInfo.score} pts</Text>
              <Text style={styles.dailySync} testID="victory-daily-sync">
                {dailyInfo.best ? "New personal best! " : "Your best today is kept. "}
                {dailyInfo.sync === "offline"
                  ? "Offline: saved, will post to the leaderboard later."
                  : dailyInfo.sync === "posted"
                    ? "Posted to the leaderboard."
                    : dailyInfo.sync === "kept"
                      ? ""
                      : "Saving…"}
              </Text>
            </View>
          )}
          <View style={styles.party}>
            {PARTY.map((c, i) => (
              <View key={c} style={{ transform: [{ translateY: i % 2 ? -8 : 0 }, { rotate: `${(i - 1.5) * 10}deg` }] }}>
                <AlienFace color={c} size={30} mood="party" variant={i} hat={prefs.hat} />
              </View>
            ))}
          </View>
          {unlocks.length > 0 && (
            <View style={styles.unlock} testID="victory-unlock">
              <Ionicons name="gift" size={16} color={colors.yellow} />
              <Text style={styles.unlockText} numberOfLines={2}>
                Unlocked: {unlocks.join(", ")}! Equip {unlocks.length > 1 ? "them" : "it"} in the Hangar.
              </Text>
            </View>
          )}
        </ResultOverlay>
      )}
      <ShareCardModal data={shareData} onClose={() => setShareData(null)} />
      {display.status === "DEADLOCK" && session.resultReady && (
        <ResultOverlay
          kind="deadlock"
          title="Terminal Jammed"
          message={
            baysFull
              ? `All ${display.bays.length} docking bays are full and no ${frontColor ? COLOR_LABEL[frontColor] : ""} ship can dock for the aliens at the front. Undo your last launch or restart.`
              : "Every remaining ship is boxed in. Undo your last launch or restart."
          }
          actions={[
            { id: "undo", label: "Undo", primary: true, onPress: () => session.dispatch({ type: "UNDO" }) },
            { id: "restart", label: "Restart", onPress: () => session.dispatch({ type: "RESTART" }) },
          ]}
        />
      )}
      {intro && boss && <BossIntro level={level} accent={colors[sector.accent]} sectorName={sector.name} onStart={() => setIntro(false)} />}
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {toast && (
        <Pressable testID="game-toast" onPress={() => setToast(null)} style={[styles.toast, { bottom: insets.bottom + 24 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, overflow: "hidden" },
  sky: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  dailyBox: { alignItems: "center", marginTop: 12 },
  bossBadge: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "stretch", backgroundColor: c.surfaceTertiary },
  bossBadgeText: { flex: 1, fontFamily: fonts.display, fontSize: 13, color: c.onSurface },
  dailyScore: { fontFamily: fonts.display, fontSize: 28, color: c.yellow },
  dailySync: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceSecondary, textAlign: "center", marginTop: 2 },
  toast: { position: "absolute", left: 24, right: 24, backgroundColor: c.surfaceInverse, borderRadius: radius.md, padding: 12, alignItems: "center" },
  toastText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceInverse },
  party: { flexDirection: "row", gap: 8, marginTop: 16, alignItems: "flex-end" },
  unlock: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "stretch" },
  unlockText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  clearBanner: { position: "absolute", top: "62%", left: 0, right: 0, alignItems: "center" },
  clearText: { fontFamily: fonts.display, fontSize: 38, color: c.success, textShadowColor: c.success, textShadowRadius: 18, letterSpacing: 2 },
  topBar: { flexDirection: "row", alignItems: "center", height: 52, paddingHorizontal: 16, gap: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1 },
  levelNum: { fontFamily: fonts.display, fontSize: 11, color: c.brandPrimary, letterSpacing: 2 },
  levelName: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface },
  moves: { alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: 12, height: 44, justifyContent: "center" },
  movesNum: { fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  movesLabel: { fontFamily: fonts.text, fontSize: 10, color: c.muted, marginTop: -2 },
}));
