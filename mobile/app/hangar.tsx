// Hangar: equip silly alien hats and ship trails unlocked with stars.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlienFace } from "@/src/components/game/AlienFace";
import { ShipBody } from "@/src/components/game/ShipBody";
import { Trail } from "@/src/components/game/Trail";
import { Starfield } from "@/src/components/Starfield";
import { HATS, type HatId, totalStars, TRAILS, type TrailId } from "@/src/game/cosmetics";
import { equip, usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

function TrailPreview({ trail }: { trail: TrailId }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })), -1);
  }, [p]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: -60 + p.value * 120 }] }));
  const glow = useSharedValue(0.5);
  return (
    <Animated.View style={anim}>
      <Trail trail={trail} direction="EAST" width={56} height={26} progress={glow} />
      <ShipBody color="cyan" symbol="triangle" direction="EAST" capacity={4} length={56} breadth={26} />
    </Animated.View>
  );
}

export default function Hangar() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const stars = totalStars(prefs.stars);

  const tile = (kind: "hat" | "trail", id: HatId | TrailId, name: string, need: number, blurb: string) => {
    const unlocked = stars >= need;
    const selected = (kind === "hat" ? prefs.hat : prefs.trail) === id;
    return (
      <Pressable
        key={id}
        testID={`hangar-${kind}-${id}`}
        disabled={!unlocked}
        onPress={() => equip(kind, id)}
        style={({ pressed }) => [styles.tile, selected && styles.tileSelected, !unlocked && styles.tileLocked, pressed && styles.pressed]}
      >
        <View style={styles.tileArt}>
          {kind === "hat" ? (
            <AlienFace color="pink" size={34} mood={unlocked ? "cheer" : "idle"} hat={id as HatId} variant={1} />
          ) : (
            <TrailTileArt id={id as TrailId} />
          )}
          {!unlocked && (
            <View style={styles.lock}>
              <Ionicons name="lock-closed" size={14} color={colors.onSurface} />
            </View>
          )}
        </View>
        <Text style={styles.tileName} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.tileSub, selected && { color: colors.brandPrimary }]} numberOfLines={1}>
          {selected ? "Equipped" : unlocked ? blurb : `${need}★ to unlock`}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root} testID="hangar-screen">
      <Starfield />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="hangar-back-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Hangar</Text>
        <View style={styles.starPill} testID="hangar-total-stars">
          <Ionicons name="star" size={14} color={colors.yellow} />
          <Text style={styles.starText}>{stars} / 45</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.preview} testID="hangar-preview">
          <AlienFace color="green" size={56} mood="party" hat={prefs.hat} variant={2} />
          <View style={styles.previewLane}>
            <TrailPreview trail={prefs.trail} />
          </View>
        </View>
        <Text style={styles.section}>Silly hats</Text>
        <View style={styles.grid}>{HATS.map((h) => tile("hat", h.id, h.name, h.stars, h.blurb))}</View>
        <Text style={styles.section}>Ship trails</Text>
        <View style={styles.grid}>{TRAILS.map((t) => tile("trail", t.id, t.name, t.stars, t.blurb))}</View>
      </ScrollView>
    </View>
  );
}

function TrailTileArt({ id }: { id: TrailId }) {
  const styles = useStyles();
  const half = useSharedValue(0.5); // fixed mid-flight so the trail is visible
  return (
    <View style={styles.trailArt}>
      <Trail trail={id} direction="EAST" width={30} height={14} progress={half} />
      <ShipBody color="yellow" symbol="star" direction="EAST" capacity={4} length={30} breadth={14} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  starPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  starText: { fontFamily: fonts.display, fontSize: 14, color: c.yellow },
  content: { paddingHorizontal: 16 },
  preview: { height: 120, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 16, overflow: "hidden", marginTop: 8 },
  previewLane: { flex: 1, height: 60, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  section: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  tile: { width: "31.5%", borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1.5, borderColor: c.border, padding: 8, alignItems: "center" },
  tileSelected: { borderColor: c.brandPrimary },
  tileLocked: { opacity: 0.55 },
  tileArt: { height: 60, alignItems: "center", justifyContent: "center", alignSelf: "stretch", overflow: "hidden" },
  trailArt: { marginLeft: 28 },
  lock: { position: "absolute", top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tileName: { fontFamily: fonts.display, fontSize: 12, lineHeight: 15, color: c.onSurface, marginTop: 4, textAlign: "center", minHeight: 30 },
  tileSub: { fontFamily: fonts.text, fontSize: 10, color: c.muted, marginTop: 2 },
  pressed: { transform: [{ scale: 0.96 }] },
}));
