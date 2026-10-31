import { Ionicons } from "@react-native-vector-icons/ionicons";

import type { AlienColor, Direction, ShapeSymbol } from "@/src/game/types";

export type IonName = React.ComponentProps<typeof Ionicons>["name"];

export const SYMBOL_ICON: Record<ShapeSymbol, IonName> = {
  triangle: "triangle",
  star: "star",
  square: "square",
  circle: "ellipse",
  diamond: "diamond",
  heart: "heart",
  moon: "moon",
  flame: "flame",
};

export const COLOR_SYMBOL: Record<AlienColor, ShapeSymbol> = {
  cyan: "triangle",
  yellow: "star",
  orange: "square",
  pink: "circle",
  purple: "diamond",
  green: "heart",
  blue: "moon",
  red: "flame",
};

export const COLOR_LABEL: Record<AlienColor, string> = {
  cyan: "Cyan",
  yellow: "Yellow",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  green: "Green",
  blue: "Blue",
  red: "Red",
};

export const SHIP_CLASS: Record<number, string> = { 4: "Scout Shuttle", 6: "Commuter Cruiser", 8: "Galaxy Transport" };

export const DIR_VEC: Record<Direction, [number, number]> = {
  NORTH: [0, -1],
  SOUTH: [0, 1],
  EAST: [1, 0],
  WEST: [-1, 0],
};

export const DIR_DEG: Record<Direction, string> = { NORTH: "0deg", EAST: "90deg", SOUTH: "180deg", WEST: "270deg" };
