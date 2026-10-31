// Original miniature spaceship drawn with RN views: hull, cockpit at the nose,
// twin engines at the tail, white direction arrow, colour symbol, soft shadow.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { View } from "react-native";

import type { AlienColor, Direction, ShapeSymbol } from "@/src/game/types";
import { DIR_DEG, SYMBOL_ICON } from "@/src/game/visuals";
import { makeStyles, useTheme } from "@/src/theme";

const FLEX: Record<Direction, "column" | "column-reverse" | "row" | "row-reverse"> = {
  NORTH: "column",
  SOUTH: "column-reverse",
  WEST: "row",
  EAST: "row-reverse",
};

interface Props {
  color: AlienColor;
  symbol: ShapeSymbol;
  direction: Direction;
  length: number; // px along travel axis
  breadth: number; // px across
  capacity: number;
}

export function ShipBody({ color, symbol, direction, length, breadth, capacity }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const vertical = direction === "NORTH" || direction === "SOUTH";
  const w = vertical ? breadth : length;
  const h = vertical ? length : breadth;
  const icon = Math.max(10, Math.min(breadth * 0.42, 26));
  const cockpitAlong = length * 0.24;
  const cockpitAcross = breadth * 0.56;
  const enginesAcross = breadth * 0.7;
  const big = capacity >= 6;
  return (
    <View style={[styles.hull, { width: w, height: h, backgroundColor: colors[color], flexDirection: FLEX[direction], borderRadius: breadth * 0.36 }]}>
      <View style={[styles.hullShine, { borderRadius: breadth * 0.36 }]} />
      <View
        style={[
          styles.cockpit,
          vertical ? { width: cockpitAcross, height: cockpitAlong } : { width: cockpitAlong, height: cockpitAcross },
          { borderRadius: breadth * 0.2, margin: breadth * 0.1 },
        ]}
      >
        <View style={styles.cockpitGlint} />
      </View>
      <View style={[styles.center, { flexDirection: vertical ? "column" : "row" }]}>
        <Ionicons name="arrow-up" size={icon} color={colors.shipDetail} style={{ transform: [{ rotate: DIR_DEG[direction] }] }} />
        <View style={styles.symbolBadge}>
          <Ionicons name={SYMBOL_ICON[symbol]} size={icon * 0.55} color={colors[color]} />
        </View>
      </View>
      <View style={[styles.engines, { flexDirection: vertical ? "row" : "column", gap: breadth * 0.12 }, vertical ? { width: enginesAcross } : { height: enginesAcross }]}>
        {(big ? [0, 1, 2] : [0, 1]).map((i) => (
          <View key={i} style={[styles.nozzle, vertical ? { width: breadth * 0.16, height: breadth * 0.14 } : { width: breadth * 0.14, height: breadth * 0.16 }]} />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hull: {
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: c.shadow + "33",
  },
  hullShine: {
    position: "absolute",
    top: 2,
    left: 2,
    right: "45%",
    bottom: "45%",
    backgroundColor: c.shipDetail,
    opacity: 0.18,
  },
  cockpit: { backgroundColor: c.surface, opacity: 0.85, overflow: "hidden" },
  cockpitGlint: { position: "absolute", top: 2, left: 2, width: "35%", height: "35%", borderRadius: 99, backgroundColor: c.brandPrimary, opacity: 0.7 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  symbolBadge: { backgroundColor: c.shipDetail, borderRadius: 99, padding: 2 },
  engines: { alignItems: "center", justifyContent: "center", marginBottom: 1, marginRight: 1 },
  nozzle: { backgroundColor: c.engineGlow, borderRadius: 3, opacity: 0.9 },
}));
