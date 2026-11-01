// In-app Privacy Policy (Round 8). Keep in sync with backend/static/privacy.html, which is the
// public web version (served at /api/privacy and /privacy.html on the deployed site).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export const PRIVACY_EMAIL = "johntilv4575@gmail.com";
export const PRIVACY_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/privacy`;

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What stays on your device",
    body: [
      "Your game progress, stars, unlocked cosmetics and settings (music, sound, haptics).",
      "Your pilot handle and a random device ID created by the app (not linked to your name, Apple ID or advertising ID).",
      "Your best Daily Challenge and Boss Rush results, and handles you have reported.",
    ],
  },
  {
    title: "What we send to our server",
    body: [
      "Only when you play the Daily Challenge or Boss Rush, or report a handle.",
      "Leaderboard scores: your handle, the random device ID, your score or time, moves, undos, best combo and an optional replay code of your moves.",
      "Reports: the reported handle, the reason you chose, which leaderboard it was on and your random device ID (so one device can report a handle only once).",
      "Your handle and scores are shown publicly on the in-game leaderboards (Daily, Weekly Cup and Boss Rush). Please don't use your real name or personal information as your handle.",
    ],
  },
  {
    title: "Name safety",
    body: ["Handles are checked against a profanity filter. Any player can report a handle; handles reported by several players are hidden from leaderboards and reviewed."],
  },
  {
    title: "How long we keep data",
    body: ["Leaderboard entries and reports are kept while the leaderboards are running. You can ask us to delete your entries at any time (see Contact)."],
  },
  {
    title: "Children",
    body: ["The game does not ask for personal information and is not directed at collecting data from children. Handles are generated randomly by default."],
  },
  {
    title: "Your choices",
    body: [
      "Keep the random handle or change it in Settings.",
      "Skip the Daily Challenge and Boss Rush to never send any data.",
      "Deleting the app removes all data stored on your device.",
    ],
  },
  { title: "Changes", body: ["If this policy changes we will update it and the date above."] },
];

export default function PrivacyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root} testID="privacy-screen">
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="privacy-back-button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.updated}>Last updated: 1 November 2026</Text>
        <Text style={styles.lead}>
          Starport Rush is a puzzle game. We collect as little as possible: there are no accounts, no ads, no analytics or tracking SDKs, and we never sell data.
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.h2}>{s.title}</Text>
            {s.body.map((b) => (
              <Text key={b} style={styles.p}>
                {b}
              </Text>
            ))}
          </View>
        ))}
        <View style={styles.section}>
          <Text style={styles.h2}>Contact</Text>
          <Text style={styles.p}>Questions or deletion requests (include your handle so we can find your entries):</Text>
          <Pressable testID="privacy-email-link" onPress={() => Linking.openURL(`mailto:${PRIVACY_EMAIL}`)} style={styles.link}>
            <Ionicons name="mail" size={16} color={colors.brandPrimary} />
            <Text style={styles.linkText}>{PRIVACY_EMAIL}</Text>
          </Pressable>
        </View>
        <Pressable testID="privacy-web-link" onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.link}>
          <Ionicons name="open-outline" size={16} color={colors.brandPrimary} />
          <Text style={styles.linkText}>Open the web version</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  content: { paddingHorizontal: 16 },
  updated: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 8 },
  lead: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: c.onSurface, marginTop: 8 },
  section: { marginTop: 24 },
  h2: { fontFamily: fonts.display, fontSize: 17, color: c.yellow, marginBottom: 4 },
  p: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: c.onSurfaceSecondary, marginTop: 4 },
  link: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginTop: 8 },
  linkText: { fontFamily: fonts.display, fontSize: 15, color: c.brandPrimary },
}));
