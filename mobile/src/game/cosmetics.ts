// Unlockable cosmetics, earned by total stars (max 15 levels x 3 = 45).
export type HatId = "none" | "party" | "propeller" | "tophat" | "cone" | "crown" | "chef" | "viking" | "halo" | "fishbowl";
export type TrailId = "none" | "sparkle" | "bubbles" | "hearts" | "rainbow" | "lightning" | "confetti" | "flame";

export interface Cosmetic<T extends string> {
  id: T;
  name: string;
  stars: number;
  blurb: string;
}

export const HATS: Cosmetic<HatId>[] = [
  { id: "none", name: "Bare Antenna", stars: 0, blurb: "Classic. Wiggly." },
  { id: "party", name: "Party Cone", stars: 3, blurb: "Every launch is a party." },
  { id: "propeller", name: "Propeller Beanie", stars: 6, blurb: "Does not actually fly." },
  { id: "tophat", name: "Fancy Top Hat", stars: 10, blurb: "Very distinguished blob." },
  { id: "cone", name: "Traffic Cone", stars: 15, blurb: "Found it in the launch yard." },
  { id: "crown", name: "Tiny Crown", stars: 20, blurb: "Ruler of the queue." },
  { id: "chef", name: "Chef Toque", stars: 26, blurb: "Cooks a mean space soup." },
  { id: "viking", name: "Viking Horns", stars: 32, blurb: "RAAAH! (politely)" },
  { id: "halo", name: "Glowing Halo", stars: 38, blurb: "Never cuts in line." },
  { id: "fishbowl", name: "Fishbowl Helmet", stars: 45, blurb: "Breathes fine. Probably." },
];

export const TRAILS: Cosmetic<TrailId>[] = [
  { id: "none", name: "Standard Exhaust", stars: 0, blurb: "Puff puff." },
  { id: "sparkle", name: "Star Sparkles", stars: 4, blurb: "Twinkle on takeoff." },
  { id: "bubbles", name: "Space Bubbles", stars: 8, blurb: "Bloop bloop bloop." },
  { id: "hearts", name: "Love Beams", stars: 12, blurb: "Launch with affection." },
  { id: "rainbow", name: "Rainbow Wake", stars: 18, blurb: "Taste the nebula." },
  { id: "lightning", name: "Zap Bolts", stars: 24, blurb: "Unlimited power." },
  { id: "confetti", name: "Confetti Cannon", stars: 30, blurb: "Mess for the cleaners." },
  { id: "flame", name: "Hyper Flames", stars: 40, blurb: "Pure afterburner." },
];

export function totalStars(stars: Record<number, number>) {
  return Object.values(stars).reduce((a, b) => a + b, 0);
}

/** Items unlocked by going from `before` to `after` total stars. */
export function newlyUnlocked(before: number, after: number) {
  return [...HATS, ...TRAILS].filter((c) => c.stars > before && c.stars <= after);
}

const ADJ = ["Sneaky", "Wobbly", "Cosmic", "Zippy", "Grumpy", "Sparkly", "Bouncy", "Fuzzy", "Turbo", "Snoozy", "Giggly", "Sassy", "Squishy", "Loopy", "Spicy", "Wiggly"];
const NOUN = ["Glorp", "Zorb", "Blip", "Squidge", "Nebbo", "Flarp", "Wumbo", "Zibble", "Plonk", "Gloop", "Snorf", "Quark", "Blorb", "Zoink", "Mlem", "Fizzle"];

/** Funny default handle like "SneakyGlorp42". */
export function randomHandle(rand: () => number = Math.random) {
  const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
  return `${pick(ADJ)}${pick(NOUN)}${10 + Math.floor(rand() * 90)}`;
}

/** Player handle rules: 3-16 chars, letters/numbers/underscore. */
export function sanitizeHandle(raw: string) {
  return raw.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
}
export const isValidHandle = (h: string) => /^[A-Za-z0-9_]{3,16}$/.test(h);
