import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import type { ComboFx } from "@/src/game/useGameSession";
import { fonts, useTheme } from "@/src/theme";

const WORDS = ["", "", "NICE!", "STELLAR!", "COSMIC!", "SUPERNOVA!"];

export function ComboPopup({ combo }: { combo: ComboFx | null }) {
  const { colors } = useTheme();
  const s = useSharedValue(0);
  const [shown, setShown] = useState<ComboFx | null>(null);
  useEffect(() => {
    if (!combo) return;
    setShown(combo);
    s.value = withSequence(withSpring(1, { damping: 8, stiffness: 320 }), withDelay(650, withTiming(0, { duration: 200 })));
    const t = setTimeout(() => setShown(null), 1000); // never linger (e.g. after restart)
    return () => clearTimeout(t);
  }, [combo, s]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value * 1.5), transform: [{ scale: 0.4 + s.value * 0.6 }, { rotate: `${(1 - s.value) * -12}deg` }] }));
  if (!shown) return null;
  const palette = [colors.yellow, colors.pink, colors.cyan, colors.green, colors.orange];
  const tint = palette[shown.count % palette.length];
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, anim]} testID="combo-popup">
      <Text style={[styles.big, { color: tint, textShadowColor: tint, fontFamily: fonts.display }]}>COMBO ×{shown.count}</Text>
      <Text style={[styles.word, { color: colors.onSurface, fontFamily: fonts.display }]}>{WORDS[Math.min(5, shown.count)]}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: "32%", left: 0, right: 0, alignItems: "center" },
  big: { fontSize: 40, textShadowRadius: 16, letterSpacing: 1 },
  word: { fontSize: 18, letterSpacing: 4, marginTop: -2 },
});
