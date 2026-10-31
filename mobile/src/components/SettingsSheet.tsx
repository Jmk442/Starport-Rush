import { BlurView } from "expo-blur";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isValidHandle, randomHandle, sanitizeHandle } from "@/src/game/cosmetics";
import { musicStatus } from "@/src/services/audio";
import { DIAG_KEYS, resetProgress, setHandle, setToggle, usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

const TOGGLES = [
  { key: "music", label: "Music", sub: "Upbeat arcade loop" },
  { key: "sfx", label: "Sound effects", sub: "Launches, docking, boarding" },
  { key: "haptics", label: "Haptics", sub: "Tactile feedback on taps" },
] as const;

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const [draft, setDraft] = useState(prefs.handle);
  const [, tick] = useState(0);
  useEffect(() => {
    if (visible) setDraft(prefs.handle);
  }, [visible, prefs.handle]);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => tick((n) => n + 1), 1000); // live music status
    return () => clearInterval(id);
  }, [visible]);
  const valid = isValidHandle(draft);
  const commit = () => {
    if (valid && draft !== prefs.handle) setHandle(draft);
  };
  const reroll = () => {
    const h = randomHandle();
    setDraft(h);
    setHandle(h);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={16} style={styles.flex}>
      <Pressable testID="settings-backdrop" style={styles.backdrop} onPress={onClose} />
      <BlurView intensity={40} tint="dark" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.label}>Your pilot handle</Text>
        <View style={styles.handleRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            testID="settings-handle-input"
            value={draft}
            onChangeText={(t) => setDraft(sanitizeHandle(t))}
            onBlur={commit}
            onSubmitEditing={commit}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={16}
            placeholder="SneakyGlorp42"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable testID="settings-handle-reroll-button" onPress={reroll} hitSlop={6} style={({ pressed }) => [styles.dice, pressed && styles.pressed]}>
            <Ionicons name="dice" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        <Text testID="settings-handle-hint" style={[styles.note, !valid && { color: colors.error }]}>
          {valid ? "Shown on your share card. Tap the dice for a silly new one." : "3-16 letters, numbers or _"}
        </Text>
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
        <Text style={styles.note} testID="settings-music-status">
          Music player: {musicStatus()}
        </Text>
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
          <Pressable testID="settings-close-button" onPress={() => { commit(); onClose(); }} style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}>
            <Text style={[styles.btnText, styles.primaryText]}>Done</Text>
          </Pressable>
        </View>
        </ScrollView>
      </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim },
  flex: { flex: 1 },
  label: { fontFamily: fonts.text, fontSize: 13, color: c.muted, marginTop: 8 },
  handleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  at: { fontFamily: fonts.display, fontSize: 20, color: c.yellow },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: 12,
    fontFamily: fonts.display,
    fontSize: 17,
    color: c.onSurface,
    borderWidth: 1,
    borderColor: c.border,
  },
  dice: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  sheet: {
    maxHeight: "88%",
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
