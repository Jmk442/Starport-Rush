// Daily Challenge hub: today's puzzle (offline-playable) + online leaderboard of handles.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Starfield } from "@/src/components/Starfield";
import { dailyLevel, todayKey } from "@/src/game/daily";
import { HIDDEN_HANDLE } from "@/src/game/profanity";
import { type DailyResult, fetchLeaderboard, getLocalBest, type Leaderboard, syncDaily } from "@/src/services/leaderboard";
import { BoardHandle } from "@/src/components/BoardHandle";
import { ReportFlag, ReportSheet, shownHandle } from "@/src/components/ReportSheet";
import { isBlocked, useBlockedHandles, useReportedHandles } from "@/src/services/reports";
import { usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function DailyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const date = todayKey();
  const [best, setBest] = useState<DailyResult | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "offline">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const level = dailyLevel(date);
  const reported = useReportedHandles();
  const blocked = useBlockedHandles();
  const visible = (e: { handle: string; is_you: boolean }) => e.is_you || !isBlocked(blocked, e.handle);
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBest(await getLocalBest(date));
    await syncDaily(date); // retries an offline score
    try {
      setBoard(await fetchLeaderboard(date));
      setState("ok");
    } catch {
      setState("offline");
    }
  }, [date]);

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

  const header = (
    <View>
      <View style={styles.hero} testID="daily-hero">
        <Text style={styles.kicker}>DAILY CHALLENGE · {date}</Text>
        <Text style={styles.title} testID="daily-level-name">
          {level.name}
        </Text>
        <Text style={styles.sub}>
          {level.ships.length} ships · {level.dockingBayCount} bays · same puzzle for everyone today. Combos score big; undos and slow launches cost points.
        </Text>
        {best ? (
          <Text style={styles.best} testID="daily-best">
            Your best: {best.score} pts · {best.seconds}s{best.bestCombo >= 2 ? ` · combo ×${best.bestCombo}` : ""}
          </Text>
        ) : (
          <Text style={styles.best} testID="daily-best">
            Not played yet today
          </Text>
        )}
        <Pressable testID="daily-play-button" onPress={() => router.push({ pathname: "/game", params: { daily: date } })} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="rocket" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>{best ? "Play again for a better score" : "Play today's puzzle"}</Text>
        </Pressable>
        <Pressable testID="daily-weekly-button" onPress={() => router.dismissTo("/weekly")} style={({ pressed }) => [styles.weekly, pressed && styles.pressed]}>
          <Ionicons name="trophy" size={18} color={colors.yellow} />
          <Text style={styles.weeklyText}>Weekly Cup standings</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
        </Pressable>
      </View>
      <View style={styles.boardHead}>
        <Text style={styles.section}>Leaderboard</Text>
        {board && <Text style={styles.count}>{board.total} pilot{board.total === 1 ? "" : "s"}</Text>}
      </View>
      {state === "offline" && (
        <View style={styles.offline} testID="daily-offline">
          <Ionicons name="cloud-offline" size={18} color={colors.warning} />
          <Text style={styles.offlineText}>You're offline. The puzzle still works and your score posts when you're back. Pull to retry.</Text>
        </View>
      )}
      {state === "loading" && <ActivityIndicator color={colors.brandPrimary} style={styles.loader} />}
      {board?.you && !board.entries.some((e) => e.is_you) && (
        <Text style={styles.youRank} testID="daily-your-rank">
          You: #{board.you.rank} · {board.you.score} pts
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.root} testID="daily-screen">
      <Starfield />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="daily-back-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Daily</Text>
      </View>
      <FlatList
        data={(board?.entries ?? []).filter(visible)}
        keyExtractor={(e, i) => `${i}-${e.rank}-${e.handle}`}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={state === "ok" ? <Text style={styles.empty}>No scores yet. Be the first pilot on the board!</Text> : undefined}
        renderItem={({ item, index }) => (
          <View testID={`leaderboard-row-${index + 1}`} style={[styles.row, item.is_you && styles.rowYou]}>
            <Text style={[styles.rank, item.rank <= 3 && { color: colors.yellow }]}>#{item.rank}</Text>
            <View style={styles.flex}>
              <BoardHandle
                handle={item.handle}
                reported={reported}
                isYou={item.is_you}
                champion={item.champion}
                style={styles.handle}
                testID={`leaderboard-champion-${index + 1}`}
              />
              <Text style={styles.meta}>
                {item.seconds}s · {item.undos} undo{item.undos === 1 ? "" : "s"}
                {item.best_combo >= 2 ? ` · combo ×${item.best_combo}` : ""}
              </Text>
            </View>
            {!item.is_you && shownHandle(item.handle, reported) === item.handle && item.handle !== HIDDEN_HANDLE && (
              <ReportFlag testID={`leaderboard-report-${index + 1}`} onPress={() => setReportTarget(item.handle)} />
            )}
            {item.replay_code && (
              <Pressable testID={`leaderboard-watch-${item.rank}`} hitSlop={6} onPress={() => router.push({ pathname: "/replay", params: { code: item.replay_code! } })} style={styles.watch}>
                <Ionicons name="play" size={14} color={colors.onSurface} />
              </Pressable>
            )}
            <Text style={styles.score}>{item.score}</Text>
          </View>
        )}
      />
      <ReportSheet target={reportTarget} board="daily" onClose={() => setReportTarget(null)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  list: { paddingHorizontal: 16 },
  hero: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: c.neonAccent },
  kicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, color: c.neonAccent },
  title: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface, marginTop: 4 },
  sub: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: c.onSurfaceSecondary, marginTop: 6 },
  best: { fontFamily: fonts.display, fontSize: 14, color: c.yellow, marginTop: 12 },
  cta: { height: 52, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  ctaText: { fontFamily: fonts.display, fontSize: 16, color: c.onBrandPrimary },
  pressed: { transform: [{ scale: 0.97 }] },
  weekly: { height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: c.yellow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  weeklyText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
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
  watch: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  score: { fontFamily: fonts.display, fontSize: 18, color: c.yellow, minWidth: 48, textAlign: "right" },
}));
