import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlienFace } from "@/src/components/game/AlienFace";
import { SettingsSheet } from "@/src/components/SettingsSheet";
import { totalStars } from "@/src/game/cosmetics";
import { getLevel, LEVELS } from "@/src/game/levels";
import { decodeReplay, findReplayCode } from "@/src/game/replay";
import { SECTORS } from "@/src/game/sectors";
import { setMusicTrack } from "@/src/services/audio";
import { usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const params = useLocalSearchParams<{ stage?: string }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (params.stage === "complete") setNotice(`All ${SECTORS.length} sectors cleared! You're officially a Starport legend.`);
  }, [params.stage]);

  const unlocked = (id: number) => LEVELS.some((l) => l.levelId === id) && (id === 1 || (prefs.stars[id - 1] ?? 0) > 0);
  const latest = Math.max(...LEVELS.map((l) => l.levelId).filter(unlocked));
  const play = (id: number) => router.push({ pathname: "/game", params: { level: String(id) } });
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const watch = () => {
    const found = findReplayCode(code);
    if (!found || !decodeReplay(found)) return setCodeError(true);
    router.push({ pathname: "/replay", params: { code: found } });
  };
  useFocusEffect(useCallback(() => setMusicTrack("default"), []));

  return (
    <View style={styles.root} testID="home-screen">
      <Image source={require("../assets/images/home-bg.jpg")} style={styles.bg} contentFit="cover" />
      <LinearGradient colors={["transparent", colors.surface]} locations={[0.25, 0.75]} style={styles.bg} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topRow}>
          <View testID="home-handle" style={styles.handleChip}>
            <AlienFace color="green" size={22} mood="cheer" hat={prefs.hat} />
            <Text style={styles.handleText} numberOfLines={1}>
              @{prefs.handle}
            </Text>
          </View>
          <View style={styles.flex} />
          <Pressable testID="home-hangar-button" onPress={() => router.push("/hangar")} style={[styles.iconBtn, styles.hangarBtn]} hitSlop={8}>
            <Ionicons name="shirt" size={20} color={colors.onSurface} />
            <Text style={styles.hangarText}>{totalStars(prefs.stars)}★</Text>
          </Pressable>
          <Pressable testID="home-settings-button" onPress={() => setSettingsOpen(true)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="settings-sharp" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Text style={styles.kicker}>INTERGALACTIC TERMINAL</Text>
          <Text style={styles.title} testID="home-title">
            STARPORT{"\n"}RUSH
          </Text>
          <Text style={styles.tagline}>Launch ships in the right order. Board every alien. Don&apos;t jam the bays.</Text>
        </Animated.View>

        <View style={styles.spacer} />

        {notice && (
          <View style={styles.notice} testID="home-notice">
            <Ionicons name="rocket" size={16} color={colors.brandPrimary} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        <Pressable testID="home-daily-card" onPress={() => router.push("/daily")} style={({ pressed }) => [styles.daily, pressed && styles.pressed]}>
          <View style={styles.dailyIcon}>
            <Ionicons name="calendar" size={22} color={colors.neonAccent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.dailyKicker}>DAILY CHALLENGE</Text>
            <Text style={styles.dailyTitle}>Today&apos;s puzzle + leaderboard</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
        </Pressable>

        {SECTORS.map((sec, si) => (
          <View key={sec.key} testID={`sector-${sec.key}`}>
            <View style={styles.sectorHead}>
              <View style={[styles.sectorDot, { backgroundColor: colors[sec.accent] }]} />
              <Text style={styles.section}>{sec.name}</Text>
              <Text style={styles.sectorTag} numberOfLines={1}>
                {sec.tagline}
              </Text>
            </View>
            <View style={styles.grid}>
              {Array.from({ length: sec.last - sec.first + 1 }, (_, i) => {
                const id = sec.first + i;
                const available = unlocked(id);
                const stars = prefs.stars[id] ?? 0;
                return (
                  <Animated.View key={id} entering={FadeInDown.delay(100 + (si * 5 + i) * 25).duration(350)} style={styles.tileWrap}>
                    <Pressable
                      testID={`level-tile-${id}`}
                      disabled={!available}
                      onPress={() => play(id)}
                      style={({ pressed }) => [
                        styles.tile,
                        available ? [styles.tileOpen, { borderColor: colors[sec.accent], backgroundColor: colors[sec.cell] }] : styles.tileLocked,
                        pressed && styles.pressed,
                      ]}
                    >
                      {available ? (
                        <>
                          <Text style={styles.tileNum}>{id}</Text>
                          <View style={styles.tileStars}>
                            {[0, 1, 2].map((s) => (
                              <Ionicons key={s} name={s < stars ? "star" : "star-outline"} size={10} color={s < stars ? colors.yellow : colors.muted} />
                            ))}
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="lock-closed" size={18} color={colors.muted} />
                          <Text style={styles.soon}>Clear {id - 1}</Text>
                        </>
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
            {sec.boss && <BossTile id={sec.boss.id} last={sec.last} accent={colors[sec.accent]} cell={colors[sec.cell]} open={(prefs.stars[sec.last] ?? 0) > 0} stars={prefs.stars[sec.boss.id] ?? 0} onPress={play} />}
          </View>
        ))}

        <Pressable testID="home-play-button" onPress={() => play(latest)} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="rocket" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>{prefs.stars[latest] ? `Replay Level ${latest}` : `Play Level ${latest}`}</Text>
        </Pressable>

        <Text style={[styles.section, styles.watchHead]}>Watch a replay</Text>
        <View style={styles.watchRow}>
          <TextInput
            testID="home-replay-input"
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setCodeError(false);
            }}
            placeholder="Paste a friend's SR1… replay code"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={watch}
            style={[styles.watchInput, codeError && { borderColor: colors.error }]}
          />
          <Pressable testID="home-replay-watch-button" onPress={watch} style={({ pressed }) => [styles.watchBtn, pressed && styles.pressed]}>
            <Ionicons name="play" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        {codeError && (
          <Text style={styles.watchError} testID="home-replay-error">
            That doesn&apos;t look like a replay code.
          </Text>
        )}
      </KeyboardAwareScrollView>
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

/** Wide boss stage tile after a sector's grid. Unlocks when the sector's last level is cleared; never gates the next sector. */
function BossTile({ id, last, accent, cell, open, stars, onPress }: { id: number; last: number; accent: string; cell: string; open: boolean; stars: number; onPress: (id: number) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const boss = getLevel(id)?.boss;
  if (!boss) return null;
  return (
    <Pressable
      testID={`boss-tile-${id}`}
      disabled={!open}
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.boss, open ? { borderColor: accent, backgroundColor: cell } : styles.tileLocked, pressed && styles.pressed]}
    >
      <View style={[styles.bossIcon, { borderColor: open ? accent : colors.border }]}>
        <Ionicons name={open ? "skull" : "lock-closed"} size={22} color={open ? accent : colors.muted} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.bossKicker, { color: open ? accent : colors.muted }]}>SECTOR BOSS</Text>
        <Text style={[styles.bossTitle, !open && { color: colors.muted }]} numberOfLines={1}>
          {boss.title}
        </Text>
        {!open && <Text style={styles.soon}>Clear Level {last} to face it</Text>}
      </View>
      {open && (
        <View style={styles.tileStars} testID={`boss-tile-${id}-stars`}>
          {[0, 1, 2].map((s) => (
            <Ionicons key={s} name={s < stars ? "star" : "star-outline"} size={14} color={s < stars ? colors.yellow : colors.muted} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  daily: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.neonCell, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.neonAccent, padding: 12, marginBottom: 16, minHeight: 64 },
  dailyIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  dailyKicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, color: c.neonAccent },
  dailyTitle: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  sectorHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectorDot: { width: 10, height: 10, borderRadius: 5 },
  sectorTag: { flex: 1, fontFamily: fonts.text, fontSize: 11, color: c.muted, textAlign: "right" },
  watchHead: { marginTop: 24 },
  watchRow: { flexDirection: "row", gap: 8 },
  watchInput: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, fontFamily: fonts.text, fontSize: 14, color: c.onSurface },
  watchBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  watchError: { fontFamily: fonts.text, fontSize: 12, color: c.error, marginTop: 6 },
  handleChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceSecondary + "CC", borderRadius: radius.pill, paddingLeft: 8, paddingRight: 12, height: 44, flexShrink: 1 },
  handleText: { fontFamily: fonts.display, fontSize: 14, color: c.yellow, flexShrink: 1 },
  hangarBtn: { width: undefined, paddingHorizontal: 12, flexDirection: "row", gap: 6 },
  hangarText: { fontFamily: fonts.display, fontSize: 14, color: c.yellow },
  flex: { flex: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary + "CC", alignItems: "center", justifyContent: "center" },
  kicker: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 3, color: c.brandPrimary, marginTop: 24 },
  title: { fontFamily: fonts.display, fontSize: 52, lineHeight: 54, color: c.onSurface, marginTop: 8, textShadowColor: c.brandPrimary, textShadowRadius: 18 },
  tagline: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: c.onSurfaceSecondary, marginTop: 12, maxWidth: 300 },
  spacer: { flex: 1, minHeight: 48 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: c.brandPrimary },
  noticeText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  section: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, marginBottom: 24 },
  boss: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.md, borderWidth: 1.5, padding: 12, minHeight: 64, marginTop: -12, marginBottom: 24 },
  bossIcon: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  bossKicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2 },
  bossTitle: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  tileWrap: { width: "18%" },
  tile: { aspectRatio: 0.9, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1 },
  tileOpen: { backgroundColor: c.surfaceSecondary, borderColor: c.brandPrimary },
  tileLocked: { backgroundColor: c.surfaceSecondary + "99", borderColor: c.border },
  tileNum: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  tileStars: { flexDirection: "row", gap: 1 },
  soon: { fontFamily: fonts.text, fontSize: 10, color: c.muted },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { fontFamily: fonts.display, fontSize: 18, color: c.onBrandPrimary },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
}));
