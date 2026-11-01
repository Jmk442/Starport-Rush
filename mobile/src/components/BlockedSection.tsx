// Settings section: players you blocked (hidden from every board on this device) + unblock.
import { Pressable, Text, View } from "react-native";

import { unblockHandle, useBlockedHandles } from "@/src/services/reports";
import { fonts, makeStyles, radius } from "@/src/theme";

export function BlockedSection() {
  const styles = useStyles();
  const blocked = useBlockedHandles();
  return (
    <View testID="blocked-section">
      <Text style={styles.section}>Blocked players</Text>
      {blocked.length === 0 ? (
        <Text style={styles.note} testID="blocked-empty">
          No blocked players. Tap the flag next to a name on any leaderboard to block it.
        </Text>
      ) : (
        blocked.map((h) => (
          <View key={h} style={styles.row} testID={`blocked-row-${h}`}>
            <Text style={styles.name} numberOfLines={1}>
              @{h}
            </Text>
            <Pressable testID={`blocked-unblock-${h}`} onPress={() => unblockHandle(h)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={styles.btnText}>Unblock</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  section: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, marginTop: 24 },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  name: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: c.onSurface },
  btn: { height: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.97 }] },
  btnText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurfaceTertiary },
}));
