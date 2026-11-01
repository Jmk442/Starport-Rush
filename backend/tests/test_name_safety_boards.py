"""Round 8 Name Safety on daily + weekly (incl. last_week_top) boards, report edge cases (iteration 11)."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "mobile", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PREFIX = "test-nsb-"
TODAY = datetime.now(timezone.utc).date()
MONDAY = TODAY - timedelta(days=TODAY.weekday())
LAST_MONDAY = MONDAY - timedelta(days=7)


def dev():
    return f"{PREFIX}{uuid.uuid4().hex[:12]}"


def handle():
    return "ZzNb" + uuid.uuid4().hex[:8]


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    db.daily_scores.delete_many({"device_id": {"$regex": f"^{PREFIX}"}})
    db.handle_reports.delete_many({"reporter_device_id": {"$regex": f"^{PREFIX}"}})


def daily(device, h, score=2400, date=None):
    return requests.post(
        f"{BASE_URL}/api/daily/{date or TODAY.isoformat()}/scores",
        json={"device_id": device, "handle": h, "score": score, "seconds": 30, "undos": 0, "best_combo": 3, "moves": 10},
    )


def report(h, board="daily", reporter=None, reason="offensive"):
    return requests.post(f"{BASE_URL}/api/reports", json={"reporter_device_id": reporter or dev(), "handle": h, "board": board, "reason": reason})


# Daily: profane handles rejected, innocent ones accepted
@pytest.mark.parametrize("h", ["Sh1tLord", "FUUUCK", "N4zi99", "F_u_c_k"])
def test_daily_rejects_profane(h):
    r = daily(dev(), h)
    assert r.status_code == 422, r.text
    assert "handle not allowed" in r.text


@pytest.mark.parametrize("h", ["Scunthorpe", "CocktailX", "Dickens", "SpicyGlorp42", "Passenger"])
def test_daily_accepts_innocent(h):
    r = daily(dev(), h, score=150)
    assert r.status_code == 200, r.text
    assert r.json()["handle"] == h


# Report -> hidden on daily + weekly for everyone after 3 reporters
def test_report_threshold_masks_daily_and_weekly():
    d, h = dev(), handle()
    assert daily(d, h, score=2500).status_code == 200
    r1 = report(h)
    assert r1.json() == {"ok": True, "duplicate": False, "hidden": False}
    rep2 = dev()
    assert report(h.lower(), "weekly", rep2).json()["duplicate"] is False  # case-insensitive count
    assert report(h, "weekly", rep2).json()["duplicate"] is True
    # still visible with 2 reporters
    b = requests.get(f"{BASE_URL}/api/daily/{TODAY}/leaderboard", params={"limit": 100}).json()
    assert any(e["handle"] == h for e in b["entries"])
    assert report(h, "bossrush").json()["hidden"] is True
    b = requests.get(f"{BASE_URL}/api/daily/{TODAY}/leaderboard", params={"limit": 100, "device_id": d}).json()
    assert all(e["handle"] != h for e in b["entries"])
    assert b["you"]["handle"] == "HiddenPilot"
    w = requests.get(f"{BASE_URL}/api/weekly/{MONDAY}/leaderboard", params={"limit": 100, "device_id": d}).json()
    assert all(e["handle"] != h for e in w["entries"])
    assert w["you"]["handle"] == "HiddenPilot"


def test_last_week_top_masked():
    d, h = dev(), handle()
    # seed directly (posting only allowed for today); max scores on all 7 days so it reaches the podium
    for i in range(7):
        db.daily_scores.insert_one({"date": (LAST_MONDAY + timedelta(days=i)).isoformat(), "device_id": d, "handle": h, "score": 2500,
                                    "seconds": 1, "undos": 0, "best_combo": 3, "moves": 5, "updated_at": datetime.now(timezone.utc).isoformat()})
    w = requests.get(f"{BASE_URL}/api/weekly/{MONDAY}/leaderboard").json()
    assert any(e["handle"] == h for e in w["last_week_top"]), w["last_week_top"]
    for _ in range(3):
        report(h, "weekly")
    w = requests.get(f"{BASE_URL}/api/weekly/{MONDAY}/leaderboard").json()
    assert all(e["handle"] != h for e in w["last_week_top"])
    assert any(e["handle"] == "HiddenPilot" for e in w["last_week_top"])


def test_report_bad_board_and_reason():
    assert report(handle(), board="global").status_code == 422
    assert report(handle(), reason="spam").status_code == 422
    assert report("HiddenPilot").status_code == 422
