import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { YardShip } from "@/src/components/game/YardShip";
import type { BlockedFx, ComboFx } from "@/src/game/useGameSession";
import type { GameState } from "@/src/game/types";
import { fonts, makeStyles, radius } from "@/src/theme";

interface Props {
  state: GameState;
  cell: number;
  hintId: string | null;
  blocked: BlockedFx | null;
  combo: ComboFx | null;
  floor?: string; // sector theme colours (from theme tokens)
  cellColor?: string;
  onTap: (id: string) => void;
}

export function LaunchYard({ state, cell, hintId, blocked, combo, floor, cellColor, onTap }: Props) {
  const styles = useStyles();
  const { width, height } = state.board;
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!combo) return;
    const a = Math.min(8, 2 + combo.count * 1.5);
    shake.value = withSequence(withTiming(a, { duration: 40 }), withTiming(-a, { duration: 60 }), withTiming(a / 2, { duration: 50 }), withTiming(0, { duration: 60 }));
  }, [combo, shake]);
  const shakeAnim = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  return (
    <View testID="launch-yard" style={styles.frame}>
      <Text style={styles.label}>LAUNCH YARD</Text>
      <Animated.View style={[styles.board, { width: width * cell, height: height * cell }, floor ? { backgroundColor: floor } : null, shakeAnim]}>
        {Array.from({ length: width * height }, (_, i) => (
          <View key={i} style={[styles.cell, { left: (i % width) * cell, top: Math.floor(i / width) * cell, width: cell, height: cell }]}>
            <View style={[styles.cellInner, cellColor ? { backgroundColor: cellColor } : null]} />
          </View>
        ))}
        {state.ships.map((s) => (
          <YardShip
            key={s.id}
            ship={s}
            cell={cell}
            hinted={hintId === s.id}
            bumpKey={blocked?.shipId === s.id ? blocked.n : 0}
            flashKey={blocked?.blockerId === s.id ? blocked.n : 0}
            onPress={onTap}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: { alignItems: "center", justifyContent: "center", flex: 1 },
  label: { fontFamily: fonts.display, color: c.muted, fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  board: {
    backgroundColor: c.yardFloor,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cell: { position: "absolute", padding: 2 },
  cellInner: { flex: 1, borderRadius: radius.sm, backgroundColor: c.yardCell, borderWidth: 1, borderColor: c.divider },
}));
