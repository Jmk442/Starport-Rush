// Winding terminal queue with goofy reactions. Batched rendering: one absolute
// layer, memoized aliens with stable keys, a single shared jump + blink value
// drives every alien, capped at MAX_RENDERED (overflow shown as a count).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { memo, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AlienFace } from "@/src/components/game/AlienFace";
import type { HatId } from "@/src/game/cosmetics";
import type { Mood } from "@/src/game/useGameSession";
import type { AlienColor, QueueGroup } from "@/src/game/types";
import { COLOR_LABEL, COLOR_SYMBOL, SYMBOL_ICON } from "@/src/game/visuals";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

const SLOT = 30;
const SIZE = 22;
const MAX_RENDERED = 80;

export const QUIPS: Record<Mood, string[]> = {
  idle: [""],
  shock: ["Hey! Watch it!", "Beep?! It's stuck!", "Rude!!", "Wrong way, pilot!", "My antenna!", "Ow. Ow. Ow."],
  cheer: ["Wheee!", "Window seat!", "Space road trip!", "Bye, Earthlings!", "Zoom zoom!", "Snacks onboard?"],
  grumpy: ["Ugh. Bays FULL.", "We'll be here all eon…", "Not cool, captain.", "I want my mom-blob.", "Seriously?!"],
  party: ["WE DID IT!", "Party in space!", "Best. Pilot. Ever."],
};

const Alien = memo(function Alien({
  color,
  left,
  top,
  front,
  variant,
  mood,
  jump,
  blink,
  hat,
}: {
  hat: HatId;
  color: AlienColor;
  left: number;
  top: number;
  front: boolean;
  variant: number;
  mood: Mood;
  jump: SharedValue<number>;
  blink: SharedValue<number>;
}) {
  const styles = useStyles();
  const x = useSharedValue(left);
  const y = useSharedValue(top);
  useEffect(() => {
    x.value = withTiming(left, { duration: 110 });
    y.value = withTiming(top, { duration: 110 });
  }, [left, top, x, y]);
  const amp = 3 + (variant % 3) * 2 + (front ? 4 : 0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value - jump.value * amp }, { rotate: `${jump.value * (variant % 2 ? 8 : -8)}deg` }],
  }));
  return (
    <Animated.View style={[styles.alien, anim]}>
      <AlienFace color={color} size={SIZE} mood={front || mood !== "cheer" ? mood : "idle"} blink={blink} variant={variant} hat={hat} />
    </Animated.View>
  );
});

interface Props {
  queue: QueueGroup[];
  width: number;
  height: number;
  mood: { mood: Mood; n: number };
  hat: HatId;
}

export function AlienQueue({ queue, width, height, mood, hat }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = queue.reduce((a, g) => a + g.count, 0);
  const inner = width - 32;
  const perRow = Math.max(4, Math.floor(inner / SLOT));
  const rows = Math.max(1, Math.floor((height - 40) / SLOT));
  const slots = perRow * rows;
  // when the queue overflows, the last visible slot holds the "+N" badge instead of an alien
  const capacity = Math.min(MAX_RENDERED, total > slots ? slots - 1 : slots);
  const badgeRow = Math.floor(capacity / perRow);
  const badgeCol = badgeRow % 2 === 0 ? capacity % perRow : perRow - 1 - (capacity % perRow);
  const badgePos = { left: badgeCol * SLOT, top: (rows - 1 - badgeRow) * SLOT + 8 };
  const jump = useSharedValue(0);
  const blink = useSharedValue(1);
  const [face, setFace] = useState<Mood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);

  useEffect(() => {
    blink.value = withRepeat(withSequence(withDelay(2600, withTiming(0.1, { duration: 70 })), withTiming(1, { duration: 90 })), -1);
  }, [blink]);

  useEffect(() => {
    const m = mood.mood;
    setFace(m);
    if (m === "idle") {
      setBubble(null);
      return;
    }
    const q = QUIPS[m];
    setBubble(q[mood.n % q.length]);
    if (m === "shock") jump.value = withSequence(withTiming(1.4, { duration: 80 }), withSpring(0, { damping: 6, stiffness: 300 }));
    else if (m === "grumpy") jump.value = withSequence(withTiming(-0.5, { duration: 120 }), withTiming(0.3, { duration: 120 }), withTiming(0, { duration: 160 }));
    else jump.value = withSequence(withTiming(1, { duration: 120 }), withSpring(0, { damping: 7, stiffness: 260 }));
    const t = setTimeout(() => {
      setBubble(null);
      if (m !== "grumpy") setFace("idle");
    }, m === "grumpy" ? 4000 : 1300);
    return () => clearTimeout(t);
  }, [mood, jump]);

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
  const head = aliens[0];
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
      <View style={[styles.lane, { width: perRow * SLOT, height: rows * SLOT + 8 }]}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={[styles.rail, { top: r * SLOT + SLOT / 2 + 5 }]} />
        ))}
        {aliens.map((a, idx) => (
          <Alien key={a.key} color={a.color} left={a.left} top={a.top} front={idx === 0} variant={a.key} mood={face} jump={jump} blink={blink} hat={hat} />
        ))}
        {total > capacity && (
          <Text testID="queue-overflow" style={[styles.overflow, badgePos]}>
            +{total - capacity}
          </Text>
        )}
        {total === 0 && <Text style={styles.cleared}>Terminal clear!</Text>}
        {bubble && head && (
          <View testID="alien-speech-bubble" style={[styles.bubble, { left: Math.max(4, head.left - 6), top: Math.max(2, head.top - 30) }]}>
            <Text style={styles.bubbleText}>{bubble}</Text>
          </View>
        )}
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
  alien: { position: "absolute", top: 9, left: 0, width: SIZE, alignItems: "center" },
  overflow: { position: "absolute", width: SLOT, textAlign: "center", lineHeight: SLOT - 6, fontFamily: fonts.display, color: c.onSurface, fontSize: 11 },
  cleared: { position: "absolute", alignSelf: "center", top: "40%", fontFamily: fonts.display, color: c.success, fontSize: 14 },
  bubble: {
    position: "absolute",
    backgroundColor: c.surfaceInverse,
    borderRadius: radius.md,
    borderBottomLeftRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bubbleText: { fontFamily: fonts.display, fontSize: 12, color: c.onSurfaceInverse },
}));
