import { BlurView } from "expo-blur";
import { Modal, Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DIAG_KEYS, resetProgress, setToggle, usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

const TOGGLES = [
  { key: "music", label: "Music", sub: "Ambient spaceport loop" },
  { key: "sfx", label: "Sound effects", sub: "Launches, docking, boarding" },
  { key: "haptics", label: "Haptics", sub: "Tactile feedback on taps" },
] as const;

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable testID="settings-backdrop" style={styles.backdrop} onPress={onClose} />
      <BlurView intensity={40} tint="dark" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Settings</Text>
        {TOGGLES.map((t) => (
          <View key={t.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t.label}</Text>
              <Text style={styles.rowSub}>{t.sub}</Text>
            </View>
            <Switch
              testID={`settings-${t.key}-switch`}
              value={prefs[t.key]}
              onValueChange={(v) => setToggle(t.key, v)}
              trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
              thumbColor={colors.onSurface}
            />
          </View>
        ))}
        <Text style={styles.section}>On-device diagnostics</Text>
        <Text style={styles.note}>Counters stay on this device. Nothing is sent anywhere.</Text>
        <View style={styles.diagGrid} testID="settings-diagnostics">
          {DIAG_KEYS.map((k) => (
            <View key={k} style={styles.diagCell}>
              <Text style={styles.diagNum}>{prefs.diag[k]}</Text>
              <Text style={styles.diagLabel}>{k}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable testID="settings-reset-button" onPress={resetProgress} style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.btnText}>Reset progress</Text>
          </Pressable>
          <Pressable testID="settings-close-button" onPress={onClose} style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}>
            <Text style={[styles.btnText, styles.primaryText]}>Done</Text>
          </Pressable>
        </View>
      </BlurView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.surfaceSecondary + "E6",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 60, borderBottomWidth: 1, borderBottomColor: c.border },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.text, fontSize: 16, color: c.onSurface },
  rowSub: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 2 },
  section: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, marginTop: 24 },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 4 },
  diagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  diagCell: { width: "23%", backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, padding: 8 },
  diagNum: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  diagLabel: { fontFamily: fonts.text, fontSize: 10, color: c.muted },
  actions: { flexDirection: "row", gap: 12, marginTop: 24 },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  pressed: { transform: [{ scale: 0.97 }] },
  btnText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceTertiary },
  primaryText: { color: c.onBrandPrimary },
}));
