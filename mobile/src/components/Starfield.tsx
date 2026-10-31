import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/src/theme";

// Deterministic starfield (seeded), rendered once.
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const STARS = (() => {
  const r = rand(42);
  return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, s: 1 + r() * 2, o: 0.2 + r() * 0.6 }));
})();

export const Starfield = memo(function Starfield() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map((st, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            borderRadius: st.s,
            backgroundColor: colors.shipDetail,
            opacity: st.o,
          }}
        />
      ))}
    </View>
  );
});
