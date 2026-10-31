import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { ShipBody } from "@/src/components/game/ShipBody";
import type { GameState, Ship } from "@/src/game/types";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

function Seats({ ship, size }: { ship: Ship; size: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.seats} testID={`bay-seats-${ship.id}`}>
      {Array.from({ length: ship.capacity }, (_, i) => (
        <View
          key={i}
          style={[
            styles.seat,
            { width: size, height: size },
            i < ship.boarded ? { backgroundColor: colors[ship.color], borderColor: colors[ship.color] } : null,
          ]}
        />
      ))}
    </View>
  );
}

function DockedShip({ ship, h, leaving }: { ship: Ship; h: number; leaving: boolean }) {
  const styles = useStyles();
  const enter = useSharedValue(0);
  const fly = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 14, stiffness: 220 });
  }, [enter]);
  useEffect(() => {
    if (leaving) fly.value = withTiming(1, { duration: 460, easing: Easing.in(Easing.cubic) });
  }, [leaving, fly]);
  const anim = useAnimatedStyle(() => ({
    opacity: (leaving ? 1 - fly.value : 1) * Math.min(1, enter.value),
    transform: [{ scale: 0.6 + 0.4 * enter.value }, { translateY: -fly.value * h * 1.6 }],
  }));
  const len = h * 0.78;
  return (
    <Animated.View style={[styles.docked, anim]}>
      <ShipBody color={ship.color} symbol={ship.symbol} direction="NORTH" capacity={ship.capacity} length={len} breadth={len * 0.52} />
      <Seats ship={ship} size={Math.min(12, h * 0.16)} />
    </Animated.View>
  );
}

function BayPad({ index, state, h }: { index: number; state: GameState; h: number }) {
  const styles = useStyles();
  const id = state.bays[index];
  const ship = id ? state.ships.find((s) => s.id === id)! : null;
  const prev = useRef<Ship | null>(null);
  const [ghost, setGhost] = useState<Ship | null>(null);

  useEffect(() => {
    const p = prev.current;
    if (p && !ship) {
      const now = state.ships.find((s) => s.id === p.id);
      if (now?.status === "DEPARTED") {
        setGhost({ ...p, boarded: p.capacity });
        const t = setTimeout(() => setGhost(null), 500);
        prev.current = ship;
        return () => clearTimeout(t);
      }
    }
    prev.current = ship;
  }, [ship, state.ships]);

  const reserved = ship?.status === "DISPATCHING";
  const shown = ship && !reserved ? ship : null;
  return (
    <View testID={`dock-bay-${index + 1}`} style={[styles.pad, reserved && styles.padReserved, shown && styles.padActive]}>
      <Text style={styles.padLabel}>BAY {index + 1}</Text>
      {shown && <DockedShip key={shown.id} ship={shown} h={h} leaving={false} />}
      {!shown && ghost && <DockedShip key={`ghost-${ghost.id}`} ship={ghost} h={h} leaving />}
      {!shown && !ghost && (
        <Text style={styles.empty}>{reserved ? "Incoming…" : "Open"}</Text>
      )}
    </View>
  );
}

export function DockBays({ state, height }: { state: GameState; height: number }) {
  const styles = useStyles();
  const h = height - 20;
  return (
    <View testID="docking-bays" style={[styles.row, { height }]}>
      {state.bays.map((_, i) => (
        <BayPad key={i} index={i} state={state} h={h} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 4 },
  pad: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  padReserved: { borderColor: c.brandPrimary, borderStyle: "solid" },
  padActive: { borderStyle: "solid", borderColor: c.border },
  padLabel: { position: "absolute", top: 4, left: 8, fontFamily: fonts.display, fontSize: 10, letterSpacing: 1.5, color: c.muted },
  empty: { fontFamily: fonts.text, color: c.muted, fontSize: 13 },
  docked: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8 },
  seats: { flexDirection: "row", flexWrap: "wrap", width: 56, gap: 4 },
  seat: { borderRadius: 99, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary },
}));
