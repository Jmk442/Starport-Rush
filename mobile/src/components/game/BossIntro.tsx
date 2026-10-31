// Full-screen "BOSS INBOUND" banner shown when a Sector Boss stage starts.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShipBody } from "@/src/components/game/ShipBody";
import type { LevelDef } from "@/src/game/types";
import { haptic, playSfx } from "@/src/services/audio";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

interface Props {
  level: LevelDef;
  accent: string;
  sectorName: string;
  onStart: () => void;
}

export function BossIntro({ level, accent, sectorName, onStart }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const boss = level.boss!;
  const ship = level.ships.find((s) => s.id === boss.shipId)!;
  const pulse = useSharedValue(1);
  useEffect(() => {
    playSfx("boss_alarm", 0.7);
    haptic("heavy");
    const t = setTimeout(() => haptic("heavy"), 300);
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
    return () => clearTimeout(t);
  }, [pulse]);
  const shipAnim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={styles.fill} testID="boss-intro">
      <View style={[styles.fill, styles.scrim]} />
      <View style={[styles.hazard, { top: insets.top + 24, backgroundColor: accent }]}>
        <Text style={styles.hazardText}>WARNING · WARNING · WARNING</Text>
      </View>
      <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.card, { borderColor: accent }]}>
        <Text style={[styles.kicker, { color: accent }]}>{sectorName.toUpperCase()} · BOSS INBOUND</Text>
        <Text style={styles.title} testID="boss-intro-title">
          {boss.title}
        </Text>
        <Text style={styles.tagline}>{boss.tagline}</Text>
        <Animated.View style={[styles.shipWrap, shipAnim]}>
          <ShipBody color={ship.color} symbol={ship.symbol} direction="NORTH" capacity={12} length={110} breadth={110} />
        </Animated.View>
        <View style={styles.stats}>
          <Stat icon="people" label="12-seat mothership" />
          <Stat icon="grid" label="3×3 hull" />
          <Stat icon="rocket" label={`${level.ships.length - 1} escorts`} />
        </View>
        <Pressable testID="boss-intro-start-button" onPress={onStart} style={({ pressed }) => [styles.btn, { backgroundColor: accent }, pressed && styles.pressed]}>
          <Ionicons name="flash" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.btnText}>Engage</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function Stat({ icon, label }: { icon: "people" | "grid" | "rocket"; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={colors.yellow} />
      <Text style={styles.statText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  scrim: { backgroundColor: c.scrim },
  hazard: { position: "absolute", left: 0, right: 0, height: 32, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-3deg" }] },
  hazardText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 3, color: c.onBrandPrimary },
  card: { width: "88%", maxWidth: 380, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 2, padding: 24, alignItems: "center" },
  kicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, textAlign: "center" },
  title: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface, textAlign: "center", marginTop: 8 },
  tagline: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceSecondary, textAlign: "center", marginTop: 4 },
  shipWrap: { marginVertical: 24 },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: 10, height: 28 },
  statText: { fontFamily: fonts.text, fontSize: 12, color: c.onSurface },
  btn: { marginTop: 24, alignSelf: "stretch", height: 52, borderRadius: radius.pill, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.display, fontSize: 18, color: c.onBrandPrimary },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
}));
