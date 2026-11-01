// Weekly Cup: adds up each pilot's best daily score for every day of the UTC week (Mon-Sun).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Starfield } from "@/src/components/Starfield";
import { todayKey } from "@/src/game/daily";
import { daysElapsed, formatCountdown, msUntilWeekEnd, weekEndKey, weekStartKey } from "@/src/game/weekly";
import { fetchWeekly, syncDaily, type WeeklyBoard } from "@/src/services/leaderboard";
import { ReportFlag, ReportSheet, shownHandle } from "@/src/components/ReportSheet";
import { HIDDEN_HANDLE } from "@/src/game/profanity";
import { useReportedHandles } from "@/src/services/reports";
import { usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function WeeklyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const today = todayKey();
  const week = weekStartKey(today);
  const [board, setBoard] = useState<WeeklyBoard | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "offline">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [left, setLeft] = useState(msUntilWeekEnd(week));
  const reported = useReportedHandles();
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setLeft(msUntilWeekEnd(week)), 30000);
    return () => clearInterval(t);
  }, [week]);

  const load = useCallback(async () => {
    await syncDaily(today); // an offline daily score counts toward the cup once posted
    try {
      setBoard(await fetchWeekly(week));
      setState("ok");
    } catch {
      setState("offline");
    }
  }, [today, week]);

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
  const elapsed = daysElapsed(week);

  const header = (
    <View>
      <View style={styles.hero} testID="weekly-hero">
        <Text style={styles.kicker}>WEEKLY CUP · {week} → {weekEndKey(week)}</Text>
        <Text style={styles.title}>Every daily counts</Text>
        <Text style={styles.sub}>Your best Daily Challenge score for each day this week adds up. Play all 7 days to climb.</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="time" size={16} color={colors.warning} />
            <Text style={styles.statText} testID="weekly-countdown">
              Ends in {formatCountdown(left)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="calendar" size={16} color={colors.neonAccent} />
            <Text style={styles.statText} testID="weekly-your-days">
              You: {board?.you?.days ?? 0}/{elapsed} days
            </Text>
          </View>
        </View>
        <Text style={styles.you} testID="weekly-your-total">
          {board?.you ? `#${board.you.rank} · ${board.you.total} pts this week` : "No points yet this week"}
        </Text>
        <Pressable testID="weekly-play-daily-button" onPress={() => router.dismissTo("/daily")} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="rocket" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>Play today&apos;s daily</Text>
        </Pressable>
      </View>

      {!!board?.last_week_top.length && (
        <View style={styles.last} testID="weekly-last-week">
          <Text style={styles.lastTitle}>Last week&apos;s podium</Text>
          {board.last_week_top.map((e) => (
            <View key={`${e.rank}-${e.handle}`} style={styles.lastRow} testID={`weekly-last-${e.rank}`}>
              <Ionicons name="trophy" size={16} color={e.rank === 1 ? colors.yellow : colors.onSurfaceSecondary} />
              <Text style={styles.lastHandle} numberOfLines={1}>
                @{shownHandle(e.handle, reported)}
                {e.is_you ? " (you)" : ""}
              </Text>
              <Text style={styles.lastScore}>{e.total}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.boardHead}>
        <Text style={styles.section}>This week</Text>
        {board && <Text style={styles.count}>{board.total_players} pilot{board.total_players === 1 ? "" : "s"}</Text>}
      </View>
      {state === "offline" && (
        <View style={styles.offline} testID="weekly-offline">
          <Ionicons name="cloud-offline" size={18} color={colors.warning} />
          <Text style={styles.offlineText}>You&apos;re offline. Pull to retry.</Text>
        </View>
      )}
      {state === "loading" && <ActivityIndicator color={colors.brandPrimary} style={styles.loader} />}
    </View>
  );

  return (
    <View style={styles.root} testID="weekly-screen">
      <Starfield />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="weekly-back-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Weekly Cup</Text>
      </View>
      <FlatList
        data={board?.entries ?? []}
        keyExtractor={(e, i) => `${i}-${e.rank}-${e.handle}`}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={state === "ok" ? <Text style={styles.empty}>No dailies played this week yet. Be first!</Text> : undefined}
        renderItem={({ item, index }) => (
          <View testID={`weekly-row-${index + 1}`} style={[styles.row, item.is_you && styles.rowYou]}>
            <Text style={[styles.rank, item.rank <= 3 && { color: colors.yellow }]}>#{item.rank}</Text>
            <View style={styles.flex}>
              <Text style={styles.handle} numberOfLines={1}>
                @{shownHandle(item.handle, reported)}
                {item.is_you ? " (you)" : ""}
              </Text>
              <Text style={styles.meta}>
                {item.days}/7 days played
              </Text>
            </View>
            {!item.is_you && shownHandle(item.handle, reported) === item.handle && item.handle !== HIDDEN_HANDLE && (
              <ReportFlag testID={`weekly-report-${index + 1}`} onPress={() => setReportTarget(item.handle)} />
            )}
            <Text style={styles.score}>{item.total}</Text>
          </View>
        )}
      />
      <ReportSheet target={reportTarget} board="weekly" onClose={() => setReportTarget(null)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  list: { paddingHorizontal: 16 },
  hero: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: c.yellow },
  kicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, color: c.yellow },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface, marginTop: 4 },
  sub: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: c.onSurfaceSecondary, marginTop: 6 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  statText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurface },
  you: { fontFamily: fonts.display, fontSize: 15, color: c.brandPrimary, marginTop: 12 },
  cta: { height: 52, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  ctaText: { fontFamily: fonts.display, fontSize: 16, color: c.onBrandPrimary },
  pressed: { transform: [{ scale: 0.97 }] },
  last: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 12, marginTop: 16, gap: 8 },
  lastTitle: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface },
  lastRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lastHandle: { flex: 1, fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceSecondary },
  lastScore: { fontFamily: fonts.display, fontSize: 14, color: c.yellow },
  boardHead: { flexDirection: "row", alignItems: "baseline", marginTop: 24, marginBottom: 8 },
  section: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  count: { fontFamily: fonts.text, fontSize: 12, color: c.muted },
  offline: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  offlineText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  loader: { marginVertical: 24 },
  empty: { fontFamily: fonts.text, fontSize: 14, color: c.muted, textAlign: "center", marginTop: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, marginBottom: 8 },
  rowYou: { borderWidth: 1.5, borderColor: c.brandPrimary },
  rank: { width: 36, fontFamily: fonts.display, fontSize: 16, color: c.onSurfaceSecondary },
  flex: { flex: 1 },
  handle: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
  meta: { fontFamily: fonts.text, fontSize: 11, color: c.muted },
  score: { fontFamily: fonts.display, fontSize: 18, color: c.yellow, minWidth: 56, textAlign: "right" },
}));
