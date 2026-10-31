// Ship trails: particles drawn behind the tail, visible only while the ship flies.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import type { TrailId } from "@/src/game/cosmetics";
import type { Direction } from "@/src/game/types";
import { DIR_VEC, type IonName } from "@/src/game/visuals";
import { useTheme } from "@/src/theme";

const ICON: Partial<Record<TrailId, IonName>> = {
  sparkle: "sparkles",
  bubbles: "ellipse-outline",
  hearts: "heart",
  lightning: "flash",
  flame: "flame",
  confetti: "square",
};

interface Props {
  trail: TrailId;
  direction: Direction;
  width: number; // ship box size
  height: number;
  progress: SharedValue<number>; // 0 = parked, 1 = gone
}

export function Trail({ trail, direction, width, height, progress }: Props) {
  const { colors } = useTheme();
  const anim = useAnimatedStyle(() => ({ opacity: Math.sin(Math.min(1, Math.max(0, progress.value)) * Math.PI) * 1.4 }));
  const [vx, vy] = DIR_VEC[direction];
  const half = (vx !== 0 ? width : height) / 2;
  const rainbow = [colors.red, colors.orange, colors.yellow, colors.green, colors.cyan, colors.blue, colors.purple];
  const n = 7;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: width / 2, top: height / 2 }, anim]}>
      {Array.from({ length: n }, (_, i) => {
        const d = half + 6 + i * 11;
        const jitter = (i % 2 ? 1 : -1) * (trail === "confetti" || trail === "sparkle" ? 5 : 1.5);
        const x = -vx * d + (vx === 0 ? jitter : 0);
        const y = -vy * d + (vy === 0 ? jitter : 0);
        const sz = Math.max(5, 13 - i * 1.2);
        const tint =
          trail === "rainbow" || trail === "confetti"
            ? rainbow[i % rainbow.length]
            : trail === "hearts"
              ? colors.pink
              : trail === "bubbles"
                ? colors.cyan
                : trail === "lightning"
                  ? colors.yellow
                  : trail === "sparkle"
                    ? colors.shipDetail
                    : colors.engineGlow;
        const icon = ICON[trail];
        return (
          <View key={i} style={{ position: "absolute", left: x - sz / 2, top: y - sz / 2, opacity: 1 - i / (n + 1) }}>
            {icon ? (
              <Ionicons name={icon} size={sz} color={tint} />
            ) : (
              <View style={{ width: sz, height: trail === "rainbow" ? sz * 0.6 : sz, borderRadius: sz, backgroundColor: tint }} />
            )}
          </View>
        );
      })}
    </Animated.View>
  );
}
