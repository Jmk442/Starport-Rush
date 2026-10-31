// Winding terminal queue. Batched rendering: one absolute layer, memoized
// aliens with stable keys, capped at MAX_RENDERED (overflow shown as a count).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { memo, useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { AlienColor, QueueGroup } from "@/src/game/types";
import { COLOR_LABEL, COLOR_SYMBOL, SYMBOL_ICON } from "@/src/game/visuals";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

const SLOT = 30;
const SIZE = 22;
const MAX_RENDERED = 60;

const Alien = memo(function Alien({ color, left, top, front }: { color: AlienColor; left: number; top: number; front: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const x = useSharedValue(left);
  const y = useSharedValue(top);
  useEffect(() => {
    x.value = withTiming(left, { duration: 140 });
    y.value = withTiming(top, { duration: 140 });
  }, [left, top, x, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return (
    <Animated.View style={[styles.alien, anim]}>
      <View style={[styles.antenna, { backgroundColor: colors[color] }]} />
      <View style={[styles.body, { backgroundColor: colors[color] }, front && styles.front]}>
        <View style={styles.eyes}>
          <View style={styles.eye}>
            <View style={styles.pupil} />
          </View>
          <View style={styles.eye}>
            <View style={styles.pupil} />
          </View>
        </View>
        <Ionicons name={SYMBOL_ICON[COLOR_SYMBOL[color]]} size={7} color={colors.surface} />
      </View>
    </Animated.View>
  );
});

export function AlienQueue({ queue, width, height }: { queue: QueueGroup[]; width: number; height: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = queue.reduce((a, g) => a + g.count, 0);
  const inner = width - 32;
  const perRow = Math.max(4, Math.floor(inner / SLOT));
  const rows = Math.max(1, Math.floor((height - 36) / SLOT));
  const capacity = Math.min(MAX_RENDERED, perRow * rows);

  const aliens = useMemo(() => {
    const out: { key: number; color: AlienColor; left: number; top: number }[] = [];
    let i = 0;
    for (const g of queue) {
      for (let k = 0; k < g.count && i < capacity; k++, i++) {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const c = row % 2 === 0 ? col : perRow - 1 - col; // serpentine
        out.push({ key: total - i, color: g.color, left: c * SLOT + (SLOT - SIZE) / 2, top: (rows - 1 - row) * SLOT });
      }
    }
    return out;
  }, [queue, perRow, rows, capacity, total]);

  const front = queue[0];
  return (
    <View testID="alien-queue" style={[styles.wrap, { height }]}>
      <View style={styles.header}>
        <Text style={styles.title}>TERMINAL</Text>
        {front ? (
          <View testID="queue-front" style={[styles.frontPill, { borderColor: colors[front.color] }]}>
            <Ionicons name={SYMBOL_ICON[COLOR_SYMBOL[front.color]]} size={11} color={colors[front.color]} />
            <Text style={styles.frontText}>
              Next: {COLOR_LABEL[front.color]} ×{front.count}
            </Text>
          </View>
        ) : null}
        <Text testID="queue-count" style={styles.count}>
          {total} waiting
        </Text>
      </View>
      <View style={[styles.lane, { width: perRow * SLOT, height: rows * SLOT }]}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={[styles.rail, { top: r * SLOT + SLOT / 2 - 1 }]} />
        ))}
        {aliens.map((a, idx) => (
          <Alien key={a.key} color={a.color} left={a.left} top={a.top} front={idx === 0} />
        ))}
        {total > capacity && <Text style={styles.overflow}>+{total - capacity}</Text>}
        {total === 0 && <Text style={styles.cleared}>Terminal clear!</Text>}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, height: 28 },
  title: { fontFamily: fonts.display, color: c.muted, fontSize: 11, letterSpacing: 2 },
  frontPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, height: 22 },
  frontText: { fontFamily: fonts.text, color: c.onSurface, fontSize: 12 },
  count: { marginLeft: "auto", fontFamily: fonts.text, color: c.muted, fontSize: 12 },
  lane: { alignSelf: "center", marginTop: 4, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, overflow: "hidden" },
  rail: { position: "absolute", left: 8, right: 8, height: 2, backgroundColor: c.border, opacity: 0.8 },
  alien: { position: "absolute", top: 3, left: 0, width: SIZE, alignItems: "center" },
  antenna: { width: 2, height: 4, borderRadius: 1 },
  body: { width: SIZE, height: SIZE - 2, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", gap: 1 },
  front: { borderWidth: 1.5, borderColor: c.shipDetail },
  eyes: { flexDirection: "row", gap: 3 },
  eye: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.shipDetail, alignItems: "center", justifyContent: "center" },
  pupil: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.shadow },
  overflow: { position: "absolute", right: 6, top: 4, fontFamily: fonts.display, color: c.onSurface, fontSize: 12 },
  cleared: { position: "absolute", alignSelf: "center", top: "40%", fontFamily: fonts.display, color: c.success, fontSize: 14 },
}));
