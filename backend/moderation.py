"""Handle moderation for public leaderboards (Round 8 "Name Safety").

Keep BLOCKED in sync with mobile/src/game/profanity.ts. Matching is done on a normalized
form (lowercase, common leetspeak mapped, non-letters dropped) and also with repeated
letters collapsed, so "F_u_u_ck", "Sh1t" and "B1tchhh" are caught. Short ambiguous words
(ass, cum, sex, anal, ...) are deliberately not listed to avoid blocking innocent names
like "Passenger", "Cumulus" or "Analog".
"""
import re

BLOCKED = [
    "fuck", "fuk", "shit", "cunt", "bitch", "asshole", "arsehole", "dick", "cock", "pussy",
    "nigger", "nigga", "faggot", "slut", "whore", "bastard", "wank", "twat", "prick", "penis",
    "vagina", "porn", "rape", "rapist", "nazi", "hitler", "retard", "chink", "kike",
    "tranny", "dildo", "boob", "tits", "milf", "jizz", "bollock", "douche", "motherf", "blowjob",
    "handjob", "horny", "orgasm", "semen", "anus", "scrotum", "testicle", "kkk", "isis",
]
# Innocent words that contain a blocked word; removed before matching (Scunthorpe problem).
ALLOWED = ["cocktail", "cockpit", "peacock", "hancock", "dickens", "scunthorpe", "grape", "drape", "therapist", "prickly",
    "uranus", "janus", "manuscript", "crisis", "mississippi", "thorny", "basement", "casement", "scraper", "trapeze",
    "parapet", "swanky", "hitchcock", "cockatoo", "shuttlecock", "cockroach", "shiitake", "shitake", "fukuoka",
    "dickinson", "retardant", "penistone"]

_LEET = str.maketrans({"0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "|": "i"})
_COLLAPSE = re.compile(r"(.)\1+")


def _norm(s: str) -> str:
    n = re.sub(r"[^a-z]", "", s.lower().translate(_LEET))
    for w in ALLOWED:
        n = n.replace(w, "")
    return n


def _collapse(s: str) -> str:
    return _COLLAPSE.sub(r"\1", s)


# collapsed forms catch "fuuuck"/"biitch"; skip ones that collapse too short to be safe ("kkk" -> "k")
_BLOCKED_COLLAPSED = [c for c in (_collapse(w) for w in BLOCKED) if len(c) >= 4]


def is_profane(handle: str) -> bool:
    n = _norm(handle)
    c = _collapse(n)
    return any(w in n for w in BLOCKED) or any(w in c for w in _BLOCKED_COLLAPSED)
