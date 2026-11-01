// Report-a-handle bottom sheet + the small flag button shown on leaderboard rows.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HIDDEN_HANDLE } from "@/src/game/profanity";
import { blockHandle, type ReportBoard, type ReportReason, reportHandle } from "@/src/services/reports";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "offensive", label: "Offensive name" },
  { id: "impersonation", label: "Impersonation" },
  { id: "other", label: "Something else" },
];

/** Handle as shown on a board: hidden if this device reported it or the server masked it. */
export const shownHandle = (handle: string, reported: string[]) => (reported.includes(handle.toLowerCase()) ? HIDDEN_HANDLE : handle);

export function ReportFlag({ testID, onPress }: { testID: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} hitSlop={8} onPress={onPress} accessibilityLabel="Report or block this name" style={({ pressed }) => [styles.flag, pressed && styles.pressed]}>
      <Ionicons name="flag-outline" size={14} color={colors.muted} />
    </Pressable>
  );
}

export function ReportSheet({ target, board, onClose }: { target: string | null; board: ReportBoard; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason>("offensive");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "offline" | "blocked">("idle");
  const close = () => {
    setStatus("idle");
    setReason("offensive");
    onClose();
  };
  const submit = async () => {
    if (!target) return;
    setStatus("sending");
    setStatus(await reportHandle(target, board, reason));
  };
  const block = async () => {
    if (!target) return;
    await blockHandle(target);
    setStatus("blocked");
  };
  const done = status === "sent" || status === "offline" || status === "blocked";
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <Pressable testID="report-backdrop" style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID="report-sheet">
        <View style={styles.grabber} />
        <Text style={styles.title}>{status === "blocked" ? `@${target} blocked` : done ? "Thanks for reporting" : `Report or block @${target}?`}</Text>
        {status === "blocked" ? (
          <Text style={styles.note} testID="report-blocked-message">
            {`You won't see @${target} on any leaderboard again. You can unblock them in Settings.`}
          </Text>
        ) : done ? (
          <Text style={styles.note} testID="report-done-message">
            {`@${target} is now hidden on your leaderboards. Names reported by several players are hidden for everyone and reviewed.`}
            {status === "offline" ? " You're offline, so the report will need another try later." : ""}
          </Text>
        ) : (
          <>
            <Text style={styles.note}>Tell us what&apos;s wrong with this name. Reports are anonymous.</Text>
            <View style={styles.reasons}>
              {REASONS.map((r) => (
                <Pressable
                  key={r.id}
                  testID={`report-reason-${r.id}`}
                  onPress={() => setReason(r.id)}
                  style={[styles.reason, reason === r.id && { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary }]}
                >
                  <Ionicons name={reason === r.id ? "radio-button-on" : "radio-button-off"} size={18} color={reason === r.id ? colors.brandPrimary : colors.muted} />
                  <Text style={styles.reasonText}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable testID="report-block-button" onPress={block} style={({ pressed }) => [styles.blockBtn, pressed && styles.pressed]}>
              <Ionicons name="ban" size={18} color={colors.error} />
              <Text style={[styles.btnText, { color: colors.error }]}>Block @{target}</Text>
            </Pressable>
          </>
        )}
        <View style={styles.actions}>
          {!done && (
            <Pressable testID="report-cancel-button" onPress={close} style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
          )}
          <Pressable
            testID={done ? "report-done-button" : "report-submit-button"}
            disabled={status === "sending"}
            onPress={done ? close : submit}
            style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, styles.primaryText]}>{done ? "Done" : status === "sending" ? "Sending…" : "Report"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  flag: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.8 },
  backdrop: { flex: 1, backgroundColor: c.scrim },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 24, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 22, color: c.onSurface },
  note: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: c.onSurfaceSecondary, marginTop: 8 },
  reasons: { gap: 8, marginTop: 16 },
  reason: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 },
  reasonText: { fontFamily: fonts.text, fontSize: 15, color: c.onSurface },
  actions: { flexDirection: "row", gap: 12, marginTop: 24 },
  blockBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, marginTop: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.error },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  btnText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceTertiary },
  primaryText: { color: c.onBrandPrimary },
}));
