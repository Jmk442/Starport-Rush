// Handle moderation (Round 8 "Name Safety"). Keep BLOCKED in sync with backend/moderation.py.
// Normalized match (lowercase, leetspeak mapped, non-letters dropped) plus a repeated-letter
// collapsed match. Short ambiguous words (ass, cum, sex, anal...) are not listed on purpose so
// names like "Passenger", "Cumulus" or "Analog" stay allowed.
const BLOCKED = [
  "fuck", "fuk", "shit", "cunt", "bitch", "asshole", "arsehole", "dick", "cock", "pussy",
  "nigger", "nigga", "faggot", "slut", "whore", "bastard", "wank", "twat", "prick", "penis",
  "vagina", "porn", "rape", "rapist", "nazi", "hitler", "retard", "chink", "kike",
  "tranny", "dildo", "boob", "tits", "milf", "jizz", "bollock", "douche", "motherf", "blowjob",
  "handjob", "horny", "orgasm", "semen", "anus", "scrotum", "testicle", "kkk", "isis",
];
// Innocent words that contain a blocked word; removed before matching (Scunthorpe problem).
const ALLOWED = ["cocktail", "cockpit", "peacock", "hancock", "dickens", "scunthorpe", "grape", "drape", "therapist", "prickly",
    "uranus", "janus", "manuscript", "crisis", "mississippi", "thorny", "basement", "casement", "scraper", "trapeze",
    "parapet", "swanky", "hitchcock", "cockatoo", "shuttlecock", "cockroach", "shiitake", "shitake", "fukuoka",
    "dickinson", "retardant", "penistone"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "|": "i" };
const collapse = (s: string) => s.replace(/(.)\1+/g, "$1");
const norm = (s: string) =>
  ALLOWED.reduce(
    (n, w) => n.split(w).join(""),
    s
      .toLowerCase()
      .split("")
      .map((ch) => LEET[ch] ?? ch)
      .join("")
      .replace(/[^a-z]/g, ""),
  );
// collapsed forms catch "fuuuck"/"biitch"; skip ones that collapse too short ("kkk" -> "k")
const BLOCKED_COLLAPSED = BLOCKED.map(collapse).filter((w) => w.length >= 4);

export function isProfane(handle: string) {
  const n = norm(handle);
  const c = collapse(n);
  return BLOCKED.some((w) => n.includes(w)) || BLOCKED_COLLAPSED.some((w) => c.includes(w));
}

/** Shown instead of a handle that was filtered or hidden after reports. */
export const HIDDEN_HANDLE = "HiddenPilot";
