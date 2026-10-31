// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Starport Rush is dark-first (design_guidelines.json). Single scheme.
  surface: "#0B0C10",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1F2833",
  onSurfaceSecondary: "#E0E6ED",
  surfaceTertiary: "#2C3643",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0B0C10",
  muted: "#8290A1",

  brand: "#00FFFF",
  onBrand: "#000000",
  brandPrimary: "#00FFFF",
  onBrandPrimary: "#000000",
  brandSecondary: "#FF007F",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#4169E1",
  onBrandTertiary: "#FFFFFF",

  success: "#50C878",
  onSuccess: "#000000",
  warning: "#FFD700",
  onWarning: "#000000",
  error: "#FF003F",
  onError: "#FFFFFF",
  info: "#FF7F50",
  onInfo: "#000000",

  border: "#2C3643",
  borderStrong: "#455A64",
  divider: "#1F2833",

  // Game entities (ships + aliens). Must match engine AlienColor keys.
  cyan: "#00FFFF",
  yellow: "#FFD700",
  orange: "#FF7F50",
  pink: "#FF007F",
  purple: "#8A2BE2",
  green: "#50C878",
  blue: "#4169E1",
  red: "#FF003F",
  shipDetail: "#FFFFFF", // arrows, cockpit glint
  shadow: "#000000",
  scrim: "rgba(5,6,10,0.72)",
  yardFloor: "#121821",
  yardCell: "#18202B",
  engineGlow: "#FFB347",
};

export type ThemeColors = typeof light;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark: light };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}



export const fonts = { display: "SpaceGrotesk", text: "DMSans" };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
