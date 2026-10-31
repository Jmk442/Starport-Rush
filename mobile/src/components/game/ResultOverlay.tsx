import { Ionicons } from "@react-native-vector-icons/ionicons";
import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";

import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

function Star({ on, index }: { on: boolean; index: number }) {
  const { colors } = useTheme();
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(250 + index * 220, withSpring(1, { damping: 9, stiffness: 180 }));
  }, [s, index]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { translateY: index === 1 ? -10 : 0 }] }));
  return (
    <Animated.View style={anim} testID={`victory-star-${index + 1}${on ? "-earned" : ""}`}>
      <Ionicons name={on ? "star" : "star-outline"} size={index === 1 ? 56 : 44} color={on ? colors.yellow : colors.borderStrong} />
    </Animated.View>
  );
}

interface Action {
  id: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
}

interface Props {
  kind: "victory" | "deadlock";
  title: string;
  message: string;
  stars?: number;
  actions: Action[];
}

export function ResultOverlay({ kind, title, message, stars = 0, actions }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [pop]);
  const cardAnim = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.85 + 0.15 * pop.value }] }));
  return (
    <View style={styles.fill} testID={`${kind}-overlay`}>
      <BlurView intensity={40} tint="dark" style={styles.fill} />
      <View style={[styles.fill, styles.scrim]} />
      <Animated.View style={[styles.card, cardAnim]}>
        {kind === "victory" ? (
          <View style={styles.stars}>
            {[0, 1, 2].map((i) => (
              <Star key={i} index={i} on={i < stars} />
            ))}
          </View>
        ) : (
          <View style={styles.warnIcon}>
            <Ionicons name="alert-circle" size={44} color={colors.error} />
          </View>
        )}
        <Text style={styles.title} testID={`${kind}-title`}>
          {title}
        </Text>
        <Text style={styles.message} testID={`${kind}-message`}>
          {message}
        </Text>
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.id}
              testID={`${kind}-${a.id}-button`}
              onPress={a.onPress}
              style={({ pressed }) => [styles.btn, a.primary ? styles.primary : styles.secondary, pressed && styles.pressed]}
            >
              <Text style={[styles.btnText, a.primary && styles.primaryText]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  scrim: { backgroundColor: c.scrim },
  card: {
    width: "86%",
    maxWidth: 380,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  stars: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12, height: 72 },
  warnIcon: { marginBottom: 8 },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface, textAlign: "center" },
  message: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceSecondary, textAlign: "center", marginTop: 8, lineHeight: 20 },
  actions: { alignSelf: "stretch", gap: 12, marginTop: 24 },
  btn: { height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: c.onSurfaceTertiary },
  primaryText: { color: c.onBrandPrimary },
}));
