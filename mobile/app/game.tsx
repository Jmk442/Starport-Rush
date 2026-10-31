import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlienFace } from "@/src/components/game/AlienFace";
import { AlienQueue } from "@/src/components/game/AlienQueue";
import { ComboPopup } from "@/src/components/game/ComboPopup";
import { ControlBar } from "@/src/components/game/ControlBar";
import { ShareCardModal, type ShareData } from "@/src/components/game/ShareCard";
import { DockBays } from "@/src/components/game/DockBays";
import { LaunchYard } from "@/src/components/game/LaunchYard";
import { ResultOverlay } from "@/src/components/game/ResultOverlay";
import { SettingsSheet } from "@/src/components/SettingsSheet";
import { Starfield } from "@/src/components/Starfield";
import { newlyUnlocked, totalStars } from "@/src/game/cosmetics";
import { getLevel, LEVEL_1, LEVELS } from "@/src/game/levels";
import type { LevelDef } from "@/src/game/types";
import { starsFor, useGameSession } from "@/src/game/useGameSession";
import { COLOR_LABEL } from "@/src/game/visuals";
import { getPrefs, recordStars, usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function GameScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const level = useMemo(() => getLevel(Number(params.level ?? 1)) ?? LEVEL_1, [params.level]);
  // keyed so switching level resets the whole session
  return <GameBody key={level.levelId} level={level} />;
}

const PARTY: ("cyan" | "pink" | "yellow" | "green")[] = ["cyan", "pink", "yellow", "green"];

function GameBody({ level }: { level: LevelDef }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const session = useGameSession(level);
  const { display } = session;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const prefs = usePrefs();
  const isLast = level.levelId >= LEVELS[LEVELS.length - 1].levelId;
  const goNext = () => {
    if (isLast) router.dismissTo({ pathname: "/", params: { stage: "complete" } });
    else router.setParams({ level: String(level.levelId + 1) });
  };
  const baysFull = display.bays.every((b) => b !== null);


  const stars = display.status === "WON" ? starsFor(display) : 0;
  const [unlocks, setUnlocks] = useState<string[]>([]);
  useEffect(() => {
    if (display.status !== "WON") return;
    const before = totalStars(getPrefs().stars);
    recordStars(level.levelId, stars);
    setUnlocks(newlyUnlocked(before, totalStars(getPrefs().stars)).map((c) => c.name));
  }, [display.status, stars, level.levelId]);
  const won = display.status === "WON";

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
      <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom, flex: 1 }}>
        <View style={{ height: queueH }}>
          <View style={styles.topBar}>
            <Pressable testID="game-home-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={styles.levelNum}>LEVEL {level.levelId}</Text>
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
            onTap={(id) => session.dispatch({ type: "TAP_SHIP", shipId: id })}
          />
          <ComboPopup combo={session.combo} />
          {won && !session.resultReady && (
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

      {won && session.resultReady && (
        <ResultOverlay
          kind="victory"
          title={isLast ? "Starport Legend!" : "Launch Complete!"}
          message={`Cleared in ${display.moves} moves${display.undos ? ` with ${display.undos} undo${display.undos > 1 ? "s" : ""}` : ""}${session.bestCombo >= 2 ? ` · best combo ×${session.bestCombo}` : ""}.`}
          stars={stars}
          actions={[
            { id: "next", label: isLast ? "All Sectors Cleared" : `Next Level (${level.levelId + 1})`, primary: true, onPress: goNext },
            {
              id: "share",
              label: "Share Score",
              onPress: () =>
                setShareData({
                  levelId: level.levelId,
                  levelName: level.name,
                  moves: display.moves,
                  stars,
                  bestCombo: session.bestCombo,
                  seconds: Math.round(session.elapsedMs() / 1000),
                  handle: prefs.handle,
                  hat: prefs.hat,
                }),
            },
            { id: "replay", label: "Replay", onPress: () => session.dispatch({ type: "RESTART" }) },
          ]}
        >
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
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
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
