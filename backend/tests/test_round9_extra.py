"""Round 9 extra: champion ties + champion flags on every board, cloud save edge cases."""
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
PREFIX = "test-r9x-"
TODAY = datetime.now(timezone.utc).date()
WEEK = (TODAY - timedelta(days=TODAY.weekday())).isoformat()
LAST_MON = (TODAY - timedelta(days=TODAY.weekday() + 7)).isoformat()
NOW = datetime.now(timezone.utc).isoformat()


def dev():
    return f"{PREFIX}{uuid.uuid4().hex[:12]}"


def seed_daily(device, handle, score, date):
    db.daily_scores.insert_one({"date": date, "device_id": device, "handle": handle, "score": score, "seconds": 10,
                                "undos": 0, "best_combo": 1, "moves": 10, "replay_code": None, "updated_at": NOW})


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for col in ("daily_scores", "cloud_saves", "bossrush_scores"):
        db[col].delete_many({"device_id": {"$regex": f"^{PREFIX}"}})


# Champion: ties all win + flag present on daily / weekly / bossrush boards
def test_champion_ties_and_flags_on_all_boards():
    a, b = dev(), dev()
    ha, hb = "ZzTieA" + uuid.uuid4().hex[:5], "ZzTieB" + uuid.uuid4().hex[:5]
    seed_daily(a, ha, 20_000_000, LAST_MON)
    seed_daily(b, hb, 20_000_000, LAST_MON)
    r = requests.get(f"{BASE_URL}/api/champion", params={"device_id": a}).json()
    assert sorted(c["handle"] for c in r["champions"]) == sorted([ha, hb])
    assert r["is_you"] is True
    assert r["week_start"] == WEEK
    assert r["expires"] == (TODAY - timedelta(days=TODAY.weekday()) + timedelta(days=7)).isoformat()
    # today's daily board
    rp = requests.post(f"{BASE_URL}/api/daily/{TODAY.isoformat()}/scores", json={
        "device_id": a, "handle": ha, "score": 100, "seconds": 3000, "undos": 0, "best_combo": 0, "moves": 5})
    assert rp.status_code == 200, rp.text
    d = requests.get(f"{BASE_URL}/api/daily/{TODAY.isoformat()}/leaderboard", params={"device_id": a, "limit": 100}).json()
    mine = [e for e in d["entries"] if e["handle"] == ha]
    assert mine and mine[0]["champion"] is True and d["you"]["champion"] is True
    assert all(not e["champion"] for e in d["entries"] if e["handle"] != ha)
    # weekly current + podium
    w = requests.get(f"{BASE_URL}/api/weekly/{WEEK}/leaderboard", params={"device_id": a}).json()
    assert any(e["handle"] == ha and e["champion"] for e in w["entries"])
    assert {e["handle"] for e in w["last_week_top"] if e["champion"]} == {ha, hb}
    # bossrush
    rb = requests.post(f"{BASE_URL}/api/bossrush/scores", json={"device_id": b, "handle": hb, "ms": 3_500_000, "undos": 0, "splits": [1000, 1000, 1000]})
    assert rb.status_code == 200, rb.text
    br = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": b, "limit": 100}).json()
    assert br["you"]["champion"] is True


def test_champion_empty_shape():
    r = requests.get(f"{BASE_URL}/api/champion").json()
    assert set(r) == {"week_start", "expires", "champions", "is_you"}
    assert r["is_you"] is False


# Cloud save edge cases
def test_save_scalar_types_roundtrip_and_code_format():
    d = dev()
    data = {"sr_music": True, "sr_rush_ms": 12345, "sr_x": 1.5, "sr_handle": "Pilot_1", "sr_n": None, "sr_blocked": "a,b"}
    r = requests.post(f"{BASE_URL}/api/saves", json={"device_id": d, "data": data})
    assert r.status_code == 200
    code = r.json()["code"]
    assert len(code) == 8 and all(c in "ABCDEFGHJKMNPQRSTUVWXYZ23456789" for c in code)
    got = requests.get(f"{BASE_URL}/api/saves/{code.lower()}")
    assert got.status_code == 200 and got.json()["data"] == data
    assert "_id" not in got.json()
    assert requests.get(f"{BASE_URL}/api/saves/{code[:4]} -{code[4:]}").status_code == 200


def test_save_more_validation():
    assert requests.post(f"{BASE_URL}/api/saves", json={"device_id": dev(), "data": {"sr_x": [1, 2]}}).status_code == 422
    assert requests.post(f"{BASE_URL}/api/saves", json={"device_id": dev(), "data": {f"sr_{i}": 1 for i in range(301)}}).status_code == 422
    assert requests.post(f"{BASE_URL}/api/saves", json={"device_id": dev()}).status_code == 422
    assert requests.get(f"{BASE_URL}/api/saves/abc").status_code == 404
