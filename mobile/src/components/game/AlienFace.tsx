// Goofy alien face shared by the queue, victory screen and share card.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { FishbowlOverlay, Hat } from "@/src/components/game/Hat";
import type { HatId } from "@/src/game/cosmetics";
import type { Mood } from "@/src/game/useGameSession";
import type { AlienColor } from "@/src/game/types";
import { COLOR_SYMBOL, SYMBOL_ICON } from "@/src/game/visuals";
import { makeStyles, useTheme } from "@/src/theme";

interface Props {
  color: AlienColor;
  size: number;
  mood: Mood;
  blink?: SharedValue<number>;
  variant?: number; // per-alien goofiness (eye size / antenna lean)
  hat?: HatId;
}

export function AlienFace({ color, size, mood, blink, variant = 0, hat = "none" }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const shocked = mood === "shock";
  const eye = size * (shocked ? 0.34 : variant % 3 === 0 ? 0.3 : 0.26);
  const pupil = eye * (shocked ? 0.35 : 0.5);
  const eyeAnim = useAnimatedStyle(() => ({ transform: [{ scaleY: blink ? blink.value : 1 }] }));
  const lean = variant % 2 === 0 ? "-18deg" : "18deg";
  const mouthW = size * (mood === "cheer" || mood === "party" ? 0.44 : shocked ? 0.22 : 0.3);
  const mouth =
    mood === "cheer" || mood === "party"
      ? { width: mouthW, height: mouthW * 0.6, borderBottomLeftRadius: mouthW, borderBottomRightRadius: mouthW, backgroundColor: colors.shadow }
      : shocked
        ? { width: mouthW, height: mouthW, borderRadius: mouthW, backgroundColor: colors.shadow }
        : mood === "grumpy"
          ? { width: mouthW, height: mouthW * 0.45, borderTopLeftRadius: mouthW, borderTopRightRadius: mouthW, borderWidth: 1.5, borderBottomWidth: 0, borderColor: colors.shadow }
          : { width: mouthW, height: mouthW * 0.45, borderBottomLeftRadius: mouthW, borderBottomRightRadius: mouthW, borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.shadow };

  return (
    <View style={{ width: size, alignItems: "center" }}>
      {hat !== "none" && hat !== "fishbowl" ? (
        <View style={{ marginBottom: -size * 0.06 }}>
          <Hat id={hat} size={size} />
        </View>
      ) : (
        <View style={[styles.antenna, { height: size * 0.22, transform: [{ rotate: lean }], backgroundColor: colors[color] }]}>
          <View style={[styles.antennaBall, { backgroundColor: colors[color], width: size * 0.2, height: size * 0.2, borderRadius: size }]} />
        </View>
      )}
      <View style={[styles.body, { width: size, height: size * 0.92, borderRadius: size / 2, backgroundColor: colors[color] }]}>
        {mood === "grumpy" && (
          <View style={styles.brows}>
            <View style={[styles.brow, { width: eye, transform: [{ rotate: "20deg" }] }]} />
            <View style={[styles.brow, { width: eye, transform: [{ rotate: "-20deg" }] }]} />
          </View>
        )}
        <View style={[styles.eyes, { gap: size * 0.08 }]}>
          {[0, 1].map((i) => (
            <Animated.View key={i} style={[styles.eye, { width: eye, height: eye, borderRadius: eye }, eyeAnim]}>
              <View style={[styles.pupil, { width: pupil, height: pupil, borderRadius: pupil, marginLeft: mood === "grumpy" ? eye * 0.3 : 0 }]} />
            </Animated.View>
          ))}
        </View>
        <View style={[{ marginTop: size * 0.05 }, mouth]} />
        {size >= 20 && (
          <View style={styles.belly}>
            <Ionicons name={SYMBOL_ICON[COLOR_SYMBOL[color]]} size={size * 0.22} color={colors.surface} />
          </View>
        )}
      </View>
      {hat === "fishbowl" && <FishbowlOverlay size={size} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  antenna: { width: 2, borderRadius: 1, alignItems: "center", marginBottom: -1 },
  antennaBall: { position: "absolute", top: -3 },
  body: { alignItems: "center", justifyContent: "center" },
  brows: { position: "absolute", top: "14%", flexDirection: "row", gap: 2 },
  brow: { height: 2, backgroundColor: c.shadow, borderRadius: 1 },
  eyes: { flexDirection: "row" },
  eye: { backgroundColor: c.shipDetail, alignItems: "center", justifyContent: "center" },
  pupil: { backgroundColor: c.shadow },
  belly: { position: "absolute", bottom: 1, opacity: 0.6 },
}));
