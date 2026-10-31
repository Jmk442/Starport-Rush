// Combo replay player: re-runs the shared tap list through the real engine and
// renders it with the real game components (read-only), focusing on the combo.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlienQueue } from "@/src/components/game/AlienQueue";
import { ComboPopup } from "@/src/components/game/ComboPopup";
import { DockBays } from "@/src/components/game/DockBays";
import { LaunchYard } from "@/src/components/game/LaunchYard";
import { Starfield } from "@/src/components/Starfield";
import { dailyLevel } from "@/src/game/daily";
import { applyTap, createInitialState } from "@/src/game/engine";
import { getLevel } from "@/src/game/levels";
import { decodeReplay, resolveLevel } from "@/src/game/replay";
import { DAILY_SECTOR, sectorFor } from "@/src/game/sectors";
import { DURATION_TABLE } from "@/src/game/timing";
import type { GameState } from "@/src/game/types";
import type { ComboFx, Mood } from "@/src/game/useGameSession";
import { feedbackFor } from "@/src/services/audio";
import { usePrefs } from "@/src/services/prefs";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

const TAP_GAP = 450;

export default function ReplayScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const prefs = usePrefs();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const data = useMemo(() => (code ? decodeReplay(code) : null), [code]);
  const level = useMemo(() => (data ? resolveLevel(data.levelRef, getLevel, dailyLevel) : undefined), [data]);
  const [display, setDisplay] = useState<GameState | null>(null);
  const [combo, setCombo] = useState<ComboFx | null>(null);
  const [mood, setMood] = useState<{ mood: Mood; n: number }>({ mood: "idle", n: 0 });
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(!data || !level);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = useCallback(() => {
    if (!data || !level) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDone(false);
    let s = createInitialState(level);
    // fast-forward to the move where the combo starts
    for (const m of data.moves.slice(0, data.fromMove)) {
      const r = applyTap(s, m);
      if (r.result !== "OK") return setInvalid(true);
      s = r.state;
    }
    setDisplay(s);
    let t = 700;
    let departs = 0;
    for (const m of data.moves.slice(data.fromMove)) {
      const r = applyTap(s, m);
      if (r.result !== "OK") return setInvalid(true);
      s = r.state;
      for (const te of r.events) {
        timers.current.push(
          setTimeout(() => {
            setDisplay(te.snapshot);
            if (te.event.type === "DEPART") {
              departs += 1;
              if (departs >= 2) setCombo({ count: departs, n: Date.now() });
              setMood((p) => ({ mood: "cheer", n: p.n + 1 }));
            }
            feedbackFor(te.event, Math.max(1, departs));
          }, t),
        );
        t += DURATION_TABLE[te.event.type];
      }
      t += TAP_GAP;
    }
    timers.current.push(setTimeout(() => setDone(true), t + 400));
  }, [data, level]);

  useEffect(() => {
    play();
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, [play]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (invalid || !data || !level) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="replay-invalid">
        <Ionicons name="alert-circle" size={44} color={colors.error} />
        <Text style={styles.title}>That replay code doesn&apos;t work</Text>
        <Text style={styles.sub}>It may be from a newer version or got cut off when copied.</Text>
        <Pressable testID="replay-back-button" onPress={back} style={styles.btn}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const sector = data.levelRef.startsWith("d") ? DAILY_SECTOR : sectorFor(level.levelId);
  const avail = height - insets.top - insets.bottom - 120;
  const yardH = avail * 0.5;
  const cell = Math.floor(Math.min((width - 32) / level.board.width, (yardH - 28) / level.board.height));
  return (
    <View style={styles.root} testID="replay-screen">
      <Starfield />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="replay-close-button" hitSlop={8} onPress={back} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[styles.kicker, { color: colors[sector.accent] }]} numberOfLines={1}>
            COMBO ×{data.combo} REPLAY · {data.levelRef.startsWith("d") ? `DAILY ${data.levelRef.slice(1)}` : `LEVEL ${level.levelId}`}
          </Text>
          <Text style={styles.title} testID="replay-title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            @{data.handle}
          </Text>
        </View>
      </View>
      {display && (
        <View pointerEvents="none" style={styles.flex}>
          <AlienQueue queue={display.queue} width={width} height={avail * 0.28} mood={mood} hat={prefs.hat} />
          <DockBays state={display} height={avail * 0.2} />
          <View style={{ height: yardH }}>
            <LaunchYard state={display} cell={cell} hintId={null} blocked={null} combo={combo} floor={colors[sector.floor]} cellColor={colors[sector.cell]} onTap={() => {}} />
            <ComboPopup combo={combo} />
          </View>
        </View>
      )}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable testID="replay-again-button" onPress={play} disabled={!done} style={({ pressed }) => [styles.btn, !done && styles.disabled, pressed && styles.pressed]}>
          <Ionicons name="refresh" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.btnText}>{done ? "Watch again" : "Playing…"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  kicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, textAlign: "left" },
  sub: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceSecondary, textAlign: "center" },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  btn: { height: 52, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch", marginTop: 8 },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: c.onBrandPrimary },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.97 }] },
}));
