// Shareable "Cleared in N moves ★★★" card. Captures the card as an image
// (react-native-view-shot + expo-sharing); falls back to the system text share.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Share, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { AlienFace } from "@/src/components/game/AlienFace";
import type { HatId } from "@/src/game/cosmetics";
import type { AlienColor } from "@/src/game/types";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export interface ShareData {
  levelId: number;
  levelName: string;
  moves: number;
  stars: number;
  bestCombo: number;
  seconds: number;
  handle: string;
  hat: HatId;
}

const CREW: AlienColor[] = ["cyan", "pink", "yellow", "green", "purple"];

export function shareText(d: ShareData) {
  const stars = "★".repeat(d.stars) + "☆".repeat(3 - d.stars);
  return `@${d.handle} cleared STARPORT RUSH · Level ${d.levelId} "${d.levelName}"\nCleared in ${d.moves} moves ${stars}${d.bestCombo >= 2 ? ` · combo ×${d.bestCombo}` : ""} · ${d.seconds}s\nCan you launch faster? 🚀`;
}

export function ShareCardModal({ data, onClose }: { data: ShareData | null; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const card = useRef<any>(null); // host view ref for captureRef
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const share = async () => {
    if (!data) return;
    setWorking(true);
    setStatus(null);
    try {
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your Starport Rush score", UTI: "public.png" });
      } else {
        await Share.share({ message: shareText(data) });
      }
      setStatus("Shared! Challenge sent.");
    } catch {
      try {
        await Clipboard.setStringAsync(shareText(data));
        setStatus("Score copied to clipboard. Paste it to a friend!");
      } catch {
        setStatus("Sharing isn't available here.");
      }
    } finally {
      setWorking(false);
    }
  };

  if (!data) return null;
  return (
    <View style={styles.backdrop} testID="share-card-overlay">
      {data && (
          <View ref={card} collapsable={false} style={styles.card} testID="share-card">
            <Text style={styles.brand}>STARPORT RUSH</Text>
            <Text style={styles.level}>
              LEVEL {data.levelId} · {data.levelName.toUpperCase()}
            </Text>
            <View style={styles.crew}>
              {CREW.map((c, i) => (
                <View key={c} style={{ transform: [{ translateY: i % 2 ? -6 : 0 }, { rotate: `${(i - 2) * 6}deg` }] }}>
                  <AlienFace color={c} size={34} mood="party" variant={i} hat={data.hat} />
                </View>
              ))}
            </View>
            <Text style={styles.handle} testID="share-card-handle">
              @{data.handle}
            </Text>
            <Text style={styles.cleared} testID="share-card-moves">
              Cleared in {data.moves} moves
            </Text>
            <View style={styles.stars} testID="share-card-stars">
              {[0, 1, 2].map((i) => (
                <Ionicons key={i} name={i < data.stars ? "star" : "star-outline"} size={34} color={i < data.stars ? colors.yellow : colors.borderStrong} />
              ))}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>×{Math.max(1, data.bestCombo)}</Text>
                <Text style={styles.statLabel}>best combo</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{data.seconds}s</Text>
                <Text style={styles.statLabel}>launch time</Text>
              </View>
            </View>
            <Text style={styles.challenge}>Can you beat it?</Text>
          </View>
        )}
        {status && (
          <Text style={styles.status} testID="share-status">
            {status}
          </Text>
        )}
        <View style={styles.actions}>
          <Pressable testID="share-card-share-button" onPress={share} disabled={working} style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}>
            {working ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="share-social" size={18} color={colors.onBrandPrimary} />}
            <Text style={[styles.btnText, styles.primaryText]}>Share</Text>
          </Pressable>
          <Pressable testID="share-card-close-button" onPress={onClose} style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.btnText}>Close</Text>
          </Pressable>
        </View>
      </View>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface + "F2", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: c.brandPrimary,
    padding: 24,
    alignItems: "center",
  },
  brand: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface, letterSpacing: 2, textShadowColor: c.brandPrimary, textShadowRadius: 12 },
  level: { fontFamily: fonts.display, fontSize: 11, color: c.brandPrimary, letterSpacing: 2, marginTop: 4 },
  crew: { flexDirection: "row", gap: 6, marginTop: 24, marginBottom: 16, alignItems: "flex-end" },
  handle: { fontFamily: fonts.display, fontSize: 16, color: c.yellow, marginBottom: 4 },
  cleared: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface },
  stars: { flexDirection: "row", gap: 6, marginTop: 8 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16, alignSelf: "stretch" },
  stat: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 12, alignItems: "center" },
  statNum: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: 11, color: c.muted },
  challenge: { fontFamily: fonts.display, fontSize: 15, color: c.pink, marginTop: 16, letterSpacing: 1 },
  status: { fontFamily: fonts.text, color: c.onSurface, marginTop: 12 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16, width: "100%", maxWidth: 360 },
  btn: { flex: 1, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  pressed: { transform: [{ scale: 0.97 }] },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: c.onSurfaceTertiary },
  primaryText: { color: c.onBrandPrimary },
}));
