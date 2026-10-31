// Silly alien hats drawn with plain views (scaled to the alien's size).
import { View } from "react-native";

import type { HatId } from "@/src/game/cosmetics";
import { makeStyles, useTheme } from "@/src/theme";

export function Hat({ id, size }: { id: HatId; size: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const s = size;
  switch (id) {
    case "party":
      return (
        <View style={styles.wrap}>
          <View style={[styles.dot, { width: s * 0.18, height: s * 0.18, backgroundColor: colors.yellow }]} />
          <View style={[styles.tri, { borderLeftWidth: s * 0.2, borderRightWidth: s * 0.2, borderBottomWidth: s * 0.45, borderBottomColor: colors.pink }]} />
        </View>
      );
    case "propeller":
      return (
        <View style={styles.wrap}>
          <View style={{ width: s * 0.6, height: s * 0.08, borderRadius: 2, backgroundColor: colors.yellow, transform: [{ rotate: "12deg" }] }} />
          <View style={{ width: 2, height: s * 0.08, backgroundColor: colors.shipDetail }} />
          <View style={{ width: s * 0.6, height: s * 0.26, borderTopLeftRadius: s, borderTopRightRadius: s, backgroundColor: colors.blue, borderBottomWidth: 2, borderBottomColor: colors.red }} />
        </View>
      );
    case "tophat":
      return (
        <View style={styles.wrap}>
          <View style={{ width: s * 0.42, height: s * 0.36, backgroundColor: colors.shadow, borderBottomWidth: s * 0.07, borderBottomColor: colors.red }} />
          <View style={{ width: s * 0.72, height: s * 0.07, borderRadius: 2, backgroundColor: colors.shadow }} />
        </View>
      );
    case "cone":
      return (
        <View style={styles.wrap}>
          <View style={[styles.tri, { borderLeftWidth: s * 0.18, borderRightWidth: s * 0.18, borderBottomWidth: s * 0.42, borderBottomColor: colors.orange }]} />
          <View style={{ position: "absolute", bottom: s * 0.16, width: s * 0.2, height: s * 0.06, backgroundColor: colors.shipDetail }} />
          <View style={{ width: s * 0.56, height: s * 0.06, backgroundColor: colors.orange, borderRadius: 1 }} />
        </View>
      );
    case "crown":
      return (
        <View style={styles.wrap}>
          <View style={{ flexDirection: "row" }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.tri, { borderLeftWidth: s * 0.1, borderRightWidth: s * 0.1, borderBottomWidth: s * 0.18, borderBottomColor: colors.yellow }]} />
            ))}
          </View>
          <View style={{ width: s * 0.6, height: s * 0.12, backgroundColor: colors.yellow }}>
            <View style={[styles.dot, { width: s * 0.1, height: s * 0.1, backgroundColor: colors.red, alignSelf: "center", marginTop: 1 }]} />
          </View>
        </View>
      );
    case "chef":
      return (
        <View style={styles.wrap}>
          <View style={{ flexDirection: "row", marginBottom: -s * 0.1 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, { width: s * 0.26, height: s * 0.26, backgroundColor: colors.shipDetail, marginHorizontal: -s * 0.03 }]} />
            ))}
          </View>
          <View style={{ width: s * 0.5, height: s * 0.16, backgroundColor: colors.shipDetail, borderBottomWidth: 1, borderBottomColor: colors.muted }} />
        </View>
      );
    case "viking":
      return (
        <View style={[styles.wrap, { flexDirection: "row", alignItems: "flex-end" }]}>
          <View style={{ width: s * 0.1, height: s * 0.34, borderRadius: s, backgroundColor: colors.shipDetail, transform: [{ rotate: "-30deg" }], marginRight: -2 }} />
          <View style={{ width: s * 0.5, height: s * 0.2, borderTopLeftRadius: s, borderTopRightRadius: s, backgroundColor: colors.muted }} />
          <View style={{ width: s * 0.1, height: s * 0.34, borderRadius: s, backgroundColor: colors.shipDetail, transform: [{ rotate: "30deg" }], marginLeft: -2 }} />
        </View>
      );
    case "halo":
      return (
        <View style={[styles.wrap, { paddingBottom: s * 0.08 }]}>
          <View style={{ width: s * 0.62, height: s * 0.2, borderRadius: s, borderWidth: 2, borderColor: colors.yellow, shadowColor: colors.yellow, shadowOpacity: 0.9, shadowRadius: 4 }} />
        </View>
      );
    default:
      return null;
  }
}

/** Fishbowl is worn around the whole head, drawn as an overlay. */
export function FishbowlOverlay({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -size * 0.25,
        width: size * 1.35,
        height: size * 1.35,
        borderRadius: size,
        borderWidth: 1.5,
        borderColor: colors.cyan,
        backgroundColor: colors.cyan + "22",
      }}
    />
  );
}

const useStyles = makeStyles(() => ({
  wrap: { alignItems: "center", justifyContent: "flex-end" },
  dot: { borderRadius: 999 },
  // triangle via borders: side borders must be transparent in every theme
  tri: { width: 0, height: 0, borderLeftColor: "transparent", borderRightColor: "transparent" },
}));
