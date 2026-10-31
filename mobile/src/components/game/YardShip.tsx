import { memo, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ShipBody } from "@/src/components/game/ShipBody";
import { Trail } from "@/src/components/game/Trail";
import type { Ship } from "@/src/game/types";
import { DIR_VEC } from "@/src/game/visuals";
import { usePrefs } from "@/src/services/prefs";
import { makeStyles } from "@/src/theme";

interface Props {
  ship: Ship;
  cell: number;
  hinted: boolean;
  bumpKey: number; // changes when this ship was tapped while blocked
  flashKey: number; // changes when this ship is the blocker
  onPress: (id: string) => void;
}

const PAD = 4;

function YardShipImpl({ ship, cell, hinted, bumpKey, flashKey, onPress }: Props) {
  const styles = useStyles();
  const { trail } = usePrefs();
  const parked = ship.status === "PARKED";
  const [vx, vy] = DIR_VEC[ship.exitDirection];
  const travel = useSharedValue(parked ? 0 : 1);
  const bump = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    travel.value = withTiming(parked ? 0 : 1, { duration: parked ? 180 : 300, easing: Easing.in(Easing.cubic) });
  }, [parked, travel]);

  useEffect(() => {
    if (!bumpKey) return;
    bump.value = withSequence(withTiming(1.6, { duration: 60 }), withTiming(-0.6, { duration: 80 }), withTiming(0.3, { duration: 60 }), withTiming(0, { duration: 60 }));
  }, [bumpKey, bump]);

  useEffect(() => {
    if (!flashKey) return;
    pulse.value = withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 140 }));
  }, [flashKey, pulse]);

  useEffect(() => {
    pulse.value = hinted ? withRepeat(withSequence(withTiming(1.07, { duration: 420 }), withTiming(1, { duration: 420 })), -1) : withTiming(1);
  }, [hinted, pulse]);

  const dist = cell * 7;
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - travel.value * travel.value,
    transform: [
      { translateX: vx * (travel.value * dist + bump.value * 6) },
      { translateY: vy * (travel.value * dist + bump.value * 6) },
      { scale: pulse.value },
    ],
  }));

  const vertical = ship.exitDirection === "NORTH" || ship.exitDirection === "SOUTH";
  const w = ship.width * cell - PAD * 2;
  const h = ship.height * cell - PAD * 2;
  return (
    <Animated.View
      pointerEvents={parked ? "auto" : "none"}
      style={[styles.wrap, { left: ship.x * cell + PAD, top: ship.y * cell + PAD, width: w, height: h }, anim]}
    >
      <Trail trail={trail} direction={ship.exitDirection} width={w} height={h} progress={travel} />
      <Pressable testID={`ship-${ship.id}`} accessibilityLabel={`${ship.color} ship heading ${ship.exitDirection}`} hitSlop={PAD} onPress={() => onPress(ship.id)}>
        <ShipBody color={ship.color} symbol={ship.symbol} direction={ship.exitDirection} capacity={ship.capacity} length={vertical ? h : w} breadth={vertical ? w : h} />
      </Pressable>
      {hinted && <View pointerEvents="none" style={styles.hintRing} />}
    </Animated.View>
  );
}

export const YardShip = memo(YardShipImpl);

const useStyles = makeStyles((c) => ({
  wrap: {
    position: "absolute",
    shadowColor: c.shadow,
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  hintRing: { position: "absolute", top: -4, left: -4, right: -4, bottom: -4, borderRadius: 16, borderWidth: 2, borderColor: c.shipDetail },
}));
