// Big boss-defeated moment: white flash, radial shard burst and a "BOSS DEFEATED!" stamp.
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, ZoomIn } from "react-native-reanimated";

import { haptic, playSfx } from "@/src/services/audio";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const SHARDS = 18;

function Shard({ i, color }: { i: number; color: string }) {
  const styles = useStyles();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay((i % 3) * 60, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [p, i]);
  const ang = (i / SHARDS) * Math.PI * 2;
  const dist = 120 + (i % 4) * 30;
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateX: Math.cos(ang) * dist * p.value }, { translateY: Math.sin(ang) * dist * p.value }, { rotate: `${p.value * 360 + i * 20}deg` }, { scale: 1.4 - p.value * 0.6 }],
  }));
  return <Animated.View style={[styles.shard, { backgroundColor: color }, i % 2 ? styles.shardWide : null, anim]} />;
}

export function BossBurst({ accent }: { accent: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const flash = useSharedValue(0.9);
  useEffect(() => {
    playSfx("boss_win", 0.8);
    haptic("success");
    const ts = [150, 300, 450].map((d) => setTimeout(() => haptic("heavy"), d));
    flash.value = withSequence(withTiming(0.9, { duration: 1 }), withTiming(0, { duration: 600 }));
    return () => ts.forEach(clearTimeout);
  }, [flash]);
  const flashAnim = useAnimatedStyle(() => ({ opacity: flash.value }));
  const palette = [accent, colors.yellow, colors.shipDetail];
  return (
    <View pointerEvents="none" style={styles.fill} testID="boss-defeated-burst">
      <Animated.View style={[styles.fill, styles.flash, flashAnim]} />
      <View style={styles.center}>
        {Array.from({ length: SHARDS }, (_, i) => (
          <Shard key={i} i={i} color={palette[i % 3]} />
        ))}
      </View>
      <Animated.View entering={ZoomIn.springify().damping(8)} style={styles.stamp}>
        <Text style={[styles.stampText, { color: accent, textShadowColor: accent }]} testID="boss-defeated-banner">
          BOSS DEFEATED!
        </Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  flash: { backgroundColor: c.shipDetail },
  center: { width: 1, height: 1, alignItems: "center", justifyContent: "center" },
  shard: { position: "absolute", width: 10, height: 10, borderRadius: 2 },
  shardWide: { width: 16, height: 6 },
  stamp: { position: "absolute", alignItems: "center", left: 0, right: 0, top: "24%" },
  stampText: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 2, textShadowRadius: 20, transform: [{ rotate: "-4deg" }] },
}));
