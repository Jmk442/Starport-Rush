import { Ionicons } from "@react-native-vector-icons/ionicons";
import { BlurView } from "expo-blur";
import { Pressable, Text, View } from "react-native";

import type { IonName } from "@/src/game/visuals";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

interface Btn {
  id: string;
  icon: IonName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function ControlBar({ buttons, height }: { buttons: Btn[]; height: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { height }]}>
      <BlurView intensity={30} tint="dark" style={styles.bar}>
        {buttons.map((b) => (
          <Pressable
            key={b.id}
            testID={`control-${b.id}-button`}
            disabled={b.disabled}
            onPress={b.onPress}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed, b.disabled && styles.disabled]}
          >
            <Ionicons name={b.icon} size={22} color={colors.onSurface} />
            <Text style={styles.label}>{b.label}</Text>
          </Pressable>
        ))}
      </BlurView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 16, justifyContent: "center" },
  bar: {
    flexDirection: "row",
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary + "B3",
    paddingVertical: 4,
  },
  btn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: radius.md },
  pressed: { backgroundColor: c.surfaceTertiary, transform: [{ scale: 0.95 }] },
  disabled: { opacity: 0.35 },
  label: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceSecondary },
}));
