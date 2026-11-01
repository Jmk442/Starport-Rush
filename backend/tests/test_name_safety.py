"""Round 8 Name Safety + privacy page: profanity filter, reports/masking, /api/privacy."""
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "mobile", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PREFIX = "test-ns-"


def dev():
    return f"{PREFIX}{uuid.uuid4().hex[:12]}"


def handle():
    return "ZzNs" + uuid.uuid4().hex[:8]


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    db.bossrush_scores.delete_many({"device_id": {"$regex": f"^{PREFIX}"}})
    db.handle_reports.delete_many({"reporter_device_id": {"$regex": f"^{PREFIX}"}})


def rush(device, h, ms=90000):
    third = ms // 3
    splits = [third, third, ms - 2 * third]
    return requests.post(f"{BASE_URL}/api/bossrush/scores", json={"device_id": device, "handle": h, "ms": ms, "undos": 0, "splits": splits})


def report(h, reporter=None, reason="offensive"):
    return requests.post(f"{BASE_URL}/api/reports", json={"reporter_device_id": reporter or dev(), "handle": h, "board": "bossrush", "reason": reason})


def test_profane_handles_rejected():
    for h in ("Sh1tLord", "FUUUCK", "xXdickXx", "N4zi99"):
        r = rush(dev(), h)
        assert r.status_code == 422, (h, r.text)
        assert "not allowed" in r.text


def test_innocent_and_generated_handles_allowed():
    from moderation import is_profane
    for h in ("Passenger", "Cumulus", "Analog", "Scunthorpe", "CocktailX", "Dickens", "SpicyGlorp42", "SneakyZoink10"):
        assert not is_profane(h), h


def test_reports_hide_handle_after_threshold():
    d, h = dev(), handle()
    assert rush(d, h, ms=5005).status_code == 200
    assert report(h).json() == {"ok": True, "duplicate": False, "hidden": False}
    again = dev()
    report(h, again)
    assert report(h, again).json()["duplicate"]
    assert report(h).json()["hidden"]
    board = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d, "limit": 100}).json()
    assert board["you"]["handle"] == "HiddenPilot"
    assert all(e["handle"] != h for e in board["entries"])


def test_report_validation():
    assert report("HiddenPilot").status_code == 422
    assert report("ok", reason="spam").status_code == 422
    r = requests.post(f"{BASE_URL}/api/reports", json={"reporter_device_id": "bad id!", "handle": handle(), "board": "daily", "reason": "other"})
    assert r.status_code == 422


def test_privacy_page():
    r = requests.get(f"{BASE_URL}/api/privacy")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "Privacy Policy" in r.text
    assert "johntilv4575@gmail.com" in r.text
