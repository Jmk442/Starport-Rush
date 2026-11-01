// Boss Rush hub: unlock status, personal best, start a run, all-time combined-time board.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Starfield } from "@/src/components/Starfield";
import { formatMs, isRushUnlocked, RUSH_BOSSES, startRush, UNDO_PENALTY_MS } from "@/src/game/bossRush";
import { getLevel } from "@/src/game/levels";
import { fetchRushBoard, getRushBest, type RushBoard, type RushResult, syncRush } from "@/src/services/leaderboard";
import { ReportFlag, ReportSheet, shownHandle } from "@/src/components/ReportSheet";
import { HIDDEN_HANDLE } from "@/src/game/profanity";
import { useReportedHandles } from "@/src/services/reports";
import { usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function BossRushScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const unlocked = isRushUnlocked(prefs.stars);
  const [best, setBest] = useState<RushResult | null>(null);
  const [board, setBoard] = useState<RushBoard | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "offline">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const reported = useReportedHandles();
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBest(await getRushBest());
    await syncRush(); // posts a run finished offline
    try {
      setBoard(await fetchRushBoard());
      setState("ok");
    } catch {
      setState("offline");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (prefs.loaded) load();
    }, [load, prefs.loaded]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  const start = () => {
    startRush();
    router.push({ pathname: "/game", params: { level: String(RUSH_BOSSES[0]), rush: "1" } });
  };

  const header = (
    <View>
      <View style={styles.hero} testID="rush-hero">
        <Text style={styles.kicker}>BOSS RUSH · 3 BOSSES · ONE CLOCK</Text>
        <Text style={styles.title}>Beat them all, fast</Text>
        <View style={styles.bosses}>
          {RUSH_BOSSES.map((id, i) => {
            const beaten = (prefs.stars[id] ?? 0) > 0;
            return (
              <View key={id} style={styles.boss} testID={`rush-boss-${id}`}>
                <Ionicons name={beaten ? "skull" : "lock-closed"} size={14} color={beaten ? colors.yellow : colors.muted} />
                <Text style={styles.bossText} numberOfLines={1}>
                  {i + 1}. {getLevel(id)?.boss?.title}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.sub}>
          The clock runs from Engage until each boss is cleared; intros don&apos;t count. Undo and Restart keep it ticking, and each undo adds +{UNDO_PENALTY_MS / 1000}s.
          Quitting ends the run.
        </Text>
        <Text style={styles.best} testID="rush-best">
          {best ? `Your best: ${formatMs(best.ms)}${best.undos ? ` (${best.undos} undo${best.undos > 1 ? "s" : ""})` : ""}` : "No run yet"}
        </Text>
        {unlocked ? (
          <Pressable testID="rush-start-button" onPress={start} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="flash" size={20} color={colors.onBrandPrimary} />
            <Text style={styles.ctaText}>{best ? "Start a new run" : "Start Boss Rush"}</Text>
          </Pressable>
        ) : (
          <View style={styles.locked} testID="rush-locked">
            <Ionicons name="lock-closed" size={18} color={colors.muted} />
            <Text style={styles.lockedText}>Beat all 3 sector bosses once to unlock Boss Rush.</Text>
          </View>
        )}
      </View>
      <View style={styles.boardHead}>
        <Text style={styles.section}>Fastest pilots</Text>
        {board && <Text style={styles.count}>{board.total} run{board.total === 1 ? "" : "s"}</Text>}
      </View>
      {state === "offline" && (
        <View style={styles.offline} testID="rush-offline">
          <Ionicons name="cloud-offline" size={18} color={colors.warning} />
          <Text style={styles.offlineText}>You&apos;re offline. Your best run posts when you&apos;re back. Pull to retry.</Text>
        </View>
      )}
      {state === "loading" && <ActivityIndicator color={colors.brandPrimary} style={styles.loader} />}
      {board?.you && !board.entries.some((e) => e.is_you) && (
        <Text style={styles.youRank} testID="rush-your-rank">
          You: #{board.you.rank} · {formatMs(board.you.ms)}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.root} testID="bossrush-screen">
      <Starfield />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="rush-back-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Boss Rush</Text>
      </View>
      <FlatList
        data={board?.entries ?? []}
        keyExtractor={(e, i) => `${i}-${e.rank}-${e.handle}`}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={state === "ok" ? <Text style={styles.empty}>No runs yet. Set the first time!</Text> : undefined}
        renderItem={({ item, index }) => (
          <View testID={`rush-row-${index + 1}`} style={[styles.row, item.is_you && styles.rowYou]}>
            <Text style={[styles.rank, item.rank <= 3 && { color: colors.yellow }]}>#{item.rank}</Text>
            <View style={styles.flex}>
              <Text style={styles.handle} numberOfLines={1}>
                @{shownHandle(item.handle, reported)}
                {item.is_you ? " (you)" : ""}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.splits.map(formatMs).join(" · ")}
                {item.undos ? ` · ${item.undos} undo${item.undos > 1 ? "s" : ""}` : ""}
              </Text>
            </View>
            {!item.is_you && shownHandle(item.handle, reported) === item.handle && item.handle !== HIDDEN_HANDLE && (
              <ReportFlag testID={`rush-report-${index + 1}`} onPress={() => setReportTarget(item.handle)} />
            )}
            <Text style={styles.score}>{formatMs(item.ms)}</Text>
          </View>
        )}
      />
      <ReportSheet target={reportTarget} board="bossrush" onClose={() => setReportTarget(null)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  list: { paddingHorizontal: 16 },
  hero: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: c.lavaAccent },
  kicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, color: c.lavaAccent },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface, marginTop: 4 },
  bosses: { gap: 6, marginTop: 12 },
  boss: { flexDirection: "row", alignItems: "center", gap: 8 },
  bossText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface },
  sub: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: c.onSurfaceSecondary, marginTop: 12 },
  best: { fontFamily: fonts.display, fontSize: 15, color: c.yellow, marginTop: 12 },
  cta: { height: 52, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  ctaText: { fontFamily: fonts.display, fontSize: 16, color: c.onBrandPrimary },
  pressed: { transform: [{ scale: 0.97 }] },
  locked: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 12 },
  lockedText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  boardHead: { flexDirection: "row", alignItems: "baseline", marginTop: 24, marginBottom: 8 },
  section: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  count: { fontFamily: fonts.text, fontSize: 12, color: c.muted },
  offline: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  offlineText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  loader: { marginVertical: 24 },
  youRank: { fontFamily: fonts.display, fontSize: 14, color: c.brandPrimary, marginBottom: 8 },
  empty: { fontFamily: fonts.text, fontSize: 14, color: c.muted, textAlign: "center", marginTop: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, marginBottom: 8 },
  rowYou: { borderWidth: 1.5, borderColor: c.brandPrimary },
  rank: { width: 36, fontFamily: fonts.display, fontSize: 16, color: c.onSurfaceSecondary },
  flex: { flex: 1 },
  handle: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
  meta: { fontFamily: fonts.text, fontSize: 11, color: c.muted },
  score: { fontFamily: fonts.display, fontSize: 18, color: c.yellow, minWidth: 64, textAlign: "right" },
}));
