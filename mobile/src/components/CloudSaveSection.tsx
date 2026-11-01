// Settings section: create/show a save code and restore progress from one (no login).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { formatCode, getSaveCode, restoreSave, uploadSave } from "@/src/services/cloudSave";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

type Status = { tone: "ok" | "error"; text: string } | null;

export function CloudSaveSection() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    getSaveCode().then(setCode);
  }, []);

  const run = async (fn: () => Promise<Status>) => {
    setBusy(true);
    setStatus(await fn());
    setBusy(false);
  };
  const save = () =>
    run(async () => {
      try {
        setCode(await uploadSave());
        return { tone: "ok", text: "Saved! Enter this code on another device to continue there." };
      } catch {
        return { tone: "error", text: "You're offline. Try again when you're connected." };
      }
    });
  const restore = () =>
    run(async () => {
      setConfirming(false);
      const r = await restoreSave(input);
      if (r === "restored") {
        setCode(await getSaveCode());
        setInput("");
        return { tone: "ok", text: "Progress restored. Welcome back, pilot!" };
      }
      return { tone: "error", text: r === "not-found" ? "No save found for that code. Check it and try again." : r === "busy" ? "Too many tries. Wait a minute and try again." : "You're offline. Try again when you're connected." };
    });
  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(formatCode(code));
    setStatus({ tone: "ok", text: "Code copied." });
  };
  const validInput = input.replace(/[^A-Za-z0-9]/g, "").length === 8;

  return (
    <View testID="cloud-save-section">
      <Text style={styles.section}>Cloud save</Text>
      <Text style={styles.note}>Move your progress to another device with a save code. No account needed. Keep your code private.</Text>
      {code && (
        <View style={styles.codeRow}>
          <Text style={styles.code} testID="cloud-save-code" selectable>
            {formatCode(code)}
          </Text>
          <Pressable testID="cloud-save-copy-button" onPress={copy} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name="copy-outline" size={18} color={colors.onSurface} />
          </Pressable>
        </View>
      )}
      {code && <Text style={styles.note}>Updates automatically when you earn stars or change cosmetics.</Text>}
      <Pressable testID="cloud-save-upload-button" disabled={busy} onPress={save} style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="cloud-upload" size={18} color={colors.onBrandPrimary} />}
        <Text style={[styles.btnText, styles.primaryText]}>{code ? "Save now" : "Create save code"}</Text>
      </Pressable>
      <Text style={styles.label}>Have a save code?</Text>
      <View style={styles.codeRow}>
        <TextInput
          testID="cloud-restore-input"
          value={input}
          onChangeText={(t) => {
            setInput(t.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9));
            setConfirming(false);
          }}
          placeholder="ABCD-1234"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          style={styles.input}
        />
        <Pressable
          testID="cloud-restore-button"
          disabled={!validInput || busy}
          onPress={() => setConfirming(true)}
          style={({ pressed }) => [styles.smallBtn, !validInput && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.btnText}>Restore</Text>
        </Pressable>
      </View>
      {confirming && (
        <View style={styles.confirm} testID="cloud-restore-confirm">
          <Text style={styles.note}>Your stars are merged, so nothing is lost. Your handle, hats, trails and settings are replaced by the saved ones.</Text>
          <View style={styles.actions}>
            <Pressable testID="cloud-restore-cancel-button" onPress={() => setConfirming(false)} style={({ pressed }) => [styles.btn, styles.flex, pressed && styles.pressed]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable testID="cloud-restore-confirm-button" onPress={restore} style={({ pressed }) => [styles.btn, styles.primary, styles.flex, pressed && styles.pressed]}>
              <Text style={[styles.btnText, styles.primaryText]}>Restore</Text>
            </Pressable>
          </View>
        </View>
      )}
      {status && (
        <Text testID="cloud-save-status" style={[styles.note, { color: status.tone === "ok" ? colors.success : colors.error }]}>
          {status.text}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  section: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, marginTop: 24 },
  label: { fontFamily: fonts.text, fontSize: 13, color: c.muted, marginTop: 16 },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 4 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  code: { flex: 1, fontFamily: fonts.display, fontSize: 24, letterSpacing: 3, color: c.yellow },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: 12,
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 2,
    color: c.onSurface,
    borderWidth: 1,
    borderColor: c.border,
  },
  btn: { height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 12, backgroundColor: c.surfaceTertiary },
  smallBtn: { height: 48, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary },
  primary: { backgroundColor: c.brandPrimary },
  disabled: { opacity: 0.4 },
  flex: { flex: 1 },
  confirm: { marginTop: 8 },
  actions: { flexDirection: "row", gap: 12 },
  pressed: { transform: [{ scale: 0.97 }] },
  btnText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceTertiary },
  primaryText: { color: c.onBrandPrimary },
}));
