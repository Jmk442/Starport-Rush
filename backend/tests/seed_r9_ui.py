"""Seed/cleanup UI test data for round 9 (python seed_r9_ui.py [clean])."""
import os
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
TODAY = datetime.now(timezone.utc).date()
LAST_MON = (TODAY - timedelta(days=TODAY.weekday() + 7)).isoformat()
NOW = datetime.now(timezone.utc).isoformat()
P = "test-ui9-"

for col in ("daily_scores", "bossrush_scores", "cloud_saves", "handle_reports"):
    key = "reporter_device_id" if col == "handle_reports" else "device_id"
    db[col].delete_many({key: {"$regex": f"^{P}"}})
if sys.argv[1:] == ["clean"]:
    print("cleaned")
    sys.exit()


def daily(dev, handle, score, date):
    db.daily_scores.insert_one({"date": date, "device_id": dev, "handle": handle, "score": score, "seconds": 30, "undos": 0,
                                "best_combo": 1, "moves": 10, "replay_code": None, "updated_at": NOW})


def rush(dev, handle, ms):
    db.bossrush_scores.insert_one({"device_id": dev, "handle": handle, "ms": ms, "undos": 0, "splits": [2000, 2000, 2000], "updated_at": NOW})


daily(P + "champ0001", "ZzChampion", 9_000_000, LAST_MON)
daily(P + "champ0001", "ZzChampion", 2400, TODAY.isoformat())
rush(P + "champ0001", "ZzChampion", 6100)
daily(P + "block0001", "ZzBlockMe", 8_000_000, LAST_MON)
daily(P + "block0001", "ZzBlockMe", 2450, TODAY.isoformat())
rush(P + "block0001", "ZzBlockMe", 6000)
print("seeded", TODAY, LAST_MON)
