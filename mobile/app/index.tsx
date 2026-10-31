import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsSheet } from "@/src/components/SettingsSheet";
import { LEVELS, TOTAL_PLANNED_LEVELS } from "@/src/game/levels";
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
    if (params.stage === "next") setNotice("Level 1 cleared! Level 2 docks in the next update.");
  }, [params.stage]);

  const play = (id: number) => router.push({ pathname: "/game", params: { level: String(id) } });

  return (
    <View style={styles.root} testID="home-screen">
      <Image source={require("../assets/images/home-bg.jpg")} style={styles.bg} contentFit="cover" />
      <LinearGradient colors={["transparent", colors.surface]} locations={[0.25, 0.75]} style={styles.bg} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topRow}>
          <View style={styles.flex} />
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

        <Text style={styles.section}>Sectors</Text>
        <View style={styles.grid}>
          {Array.from({ length: TOTAL_PLANNED_LEVELS }, (_, i) => {
            const id = i + 1;
            const available = LEVELS.some((l) => l.levelId === id);
            const stars = prefs.stars[id] ?? 0;
            return (
              <Animated.View key={id} entering={FadeInDown.delay(150 + i * 70).duration(400)} style={styles.tileWrap}>
                <Pressable
                  testID={`level-tile-${id}`}
                  disabled={!available}
                  onPress={() => play(id)}
                  style={({ pressed }) => [styles.tile, available ? styles.tileOpen : styles.tileLocked, pressed && styles.pressed]}
                >
                  {available ? (
                    <>
                      <Text style={styles.tileNum}>{id}</Text>
                      <View style={styles.tileStars}>
                        {[0, 1, 2].map((s) => (
                          <Ionicons key={s} name={s < stars ? "star" : "star-outline"} size={12} color={s < stars ? colors.yellow : colors.muted} />
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={18} color={colors.muted} />
                      <Text style={styles.soon}>Soon</Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Pressable testID="home-play-button" onPress={() => play(1)} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="rocket" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>{prefs.stars[1] ? "Play Level 1 Again" : "Play Level 1"}</Text>
        </Pressable>
      </ScrollView>
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  topRow: { flexDirection: "row" },
  flex: { flex: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary + "CC", alignItems: "center", justifyContent: "center" },
  kicker: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 3, color: c.brandPrimary, marginTop: 24 },
  title: { fontFamily: fonts.display, fontSize: 52, lineHeight: 54, color: c.onSurface, marginTop: 8, textShadowColor: c.brandPrimary, textShadowRadius: 18 },
  tagline: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: c.onSurfaceSecondary, marginTop: 12, maxWidth: 300 },
  spacer: { flex: 1, minHeight: 120 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: c.brandPrimary },
  noticeText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  section: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface, marginBottom: 12 },
  grid: { flexDirection: "row", gap: 8, marginBottom: 24 },
  tileWrap: { flex: 1 },
  tile: { aspectRatio: 0.85, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1 },
  tileOpen: { backgroundColor: c.surfaceSecondary, borderColor: c.brandPrimary },
  tileLocked: { backgroundColor: c.surfaceSecondary + "99", borderColor: c.border },
  tileNum: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  tileStars: { flexDirection: "row", gap: 1 },
  soon: { fontFamily: fonts.text, fontSize: 10, color: c.muted },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { fontFamily: fonts.display, fontSize: 18, color: c.onBrandPrimary },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
}));
