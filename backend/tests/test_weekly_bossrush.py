# Weekly Cup leaderboard + Boss Rush leaderboard API tests (Round 6)
import os
import uuid
import threading
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/mobile/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
NOW = datetime.now(timezone.utc).date()
TODAY = NOW.isoformat()
MONDAY = NOW - timedelta(days=NOW.weekday())
LAST_MONDAY = MONDAY - timedelta(days=7)

mc = MongoClient(os.environ["MONGO_URL"])
db = mc[os.environ["DB_NAME"]]


# One device prefix per test class: xdist (--dist loadscope) may run TestWeekly and
# TestBossRush on different workers, so each class only cleans up its own records.
WK, BR = "test-wk-", "test-br-"


def dev(prefix):
    return f"{prefix}{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="class", autouse=True)
def cleanup(request):
    yield
    prefix = request.cls.PREFIX
    db.daily_scores.delete_many({"device_id": {"$regex": f"^{prefix}"}})
    db.bossrush_scores.delete_many({"device_id": {"$regex": f"^{prefix}"}})


@pytest.fixture
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


def seed_daily(device, handle, date, score, seconds=60):
    db.daily_scores.insert_one({"date": date, "device_id": device, "handle": handle, "score": score, "seconds": seconds,
                                "undos": 0, "best_combo": 1, "moves": 8, "replay_code": None,
                                "updated_at": datetime.now(timezone.utc).isoformat()})


# ---- Weekly Cup ----
class TestWeekly:
    PREFIX = WK

    def test_shape_and_bounds(self, s):
        r = s.get(f"{BASE_URL}/api/weekly/{MONDAY.isoformat()}/leaderboard")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["week_start"] == MONDAY.isoformat()
        assert d["week_end"] == (MONDAY + timedelta(days=6)).isoformat()
        assert isinstance(d["entries"], list) and isinstance(d["last_week_top"], list)
        assert d["total_players"] >= len(d["entries"])

    def test_non_monday_400(self, s):
        r = s.get(f"{BASE_URL}/api/weekly/{(MONDAY + timedelta(days=1)).isoformat()}/leaderboard")
        assert r.status_code == 400

    @pytest.mark.parametrize("bad", ["2026-13-01", "2026-02-30", "abc", "2026-1-5"])
    def test_bad_date_400(self, s, bad):
        r = s.get(f"{BASE_URL}/api/weekly/{bad}/leaderboard")
        assert r.status_code in (400, 404), r.text
        if bad != "abc":
            assert r.status_code == 400

    def _seed_week(self, s, a, b, c):
        """a: Mon+Tue seeded + today via POST (prev Sunday must not count); b ties a on 2 days; c: last week only."""
        seed_daily(a, "TEST_wa", MONDAY.isoformat(), 2400)
        seed_daily(a, "TEST_wa", (MONDAY + timedelta(days=1)).isoformat(), 2300)
        seed_daily(a, "TEST_wa", (MONDAY - timedelta(days=1)).isoformat(), 2500)
        r = s.post(f"{BASE_URL}/api/daily/{TODAY}/scores", json={"device_id": a, "handle": "TEST_wa", "score": 2200,
                   "seconds": 30, "undos": 0, "best_combo": 2, "moves": 8})
        assert r.status_code == 200, r.text
        a_total = 2400 + 2300 + 2200
        seed_daily(b, "TEST_wb", MONDAY.isoformat(), 2450)
        seed_daily(b, "TEST_wb", (MONDAY + timedelta(days=2)).isoformat(), a_total - 2450)
        seed_daily(c, "TEST_wc", LAST_MONDAY.isoformat(), 2499)
        seed_daily(c, "TEST_wc", (LAST_MONDAY + timedelta(days=3)).isoformat(), 2499)
        return a_total

    @staticmethod
    def _one(entries, handle):
        found = [e for e in entries if e["handle"] == handle]
        assert len(found) == 1, f"{handle}: {found}"
        return found[0]

    def test_totals_days_ties_you(self, s):
        if TODAY in (MONDAY.isoformat(), (MONDAY + timedelta(days=1)).isoformat()):
            pytest.skip("today collides with seeded Mon/Tue")
        a, b, c = dev(WK), dev(WK), dev(WK)
        a_total = self._seed_week(s, a, b, c)
        r = s.get(f"{BASE_URL}/api/weekly/{MONDAY.isoformat()}/leaderboard", params={"device_id": a, "limit": 100})
        assert r.status_code == 200
        d = r.json()
        ea, eb = self._one(d["entries"], "TEST_wa"), self._one(d["entries"], "TEST_wb")
        assert (ea["total"], ea["days"], ea["is_you"]) == (a_total, 3, True)
        assert (eb["total"], eb["days"], eb["is_you"]) == (a_total, 2, False)
        assert ea["rank"] == eb["rank"], "ties should share rank"
        assert (d["you"]["handle"], d["you"]["total"]) == ("TEST_wa", a_total)
        assert all(e["handle"] != "TEST_wc" for e in d["entries"])
        tots = [e["total"] for e in d["entries"]]
        assert tots == sorted(tots, reverse=True)

    def test_last_week_podium(self, s):
        c = dev(WK)
        seed_daily(c, "TEST_wc2", LAST_MONDAY.isoformat(), 2499)
        seed_daily(c, "TEST_wc2", (LAST_MONDAY + timedelta(days=3)).isoformat(), 2499)
        lw = s.get(f"{BASE_URL}/api/weekly/{MONDAY.isoformat()}/leaderboard").json()["last_week_top"]
        assert len(lw) <= 3
        assert {"handle": "TEST_wc2", "total": 4998, "days": 2} in [{k: e[k] for k in ("handle", "total", "days")} for e in lw], lw

    def test_unknown_device_you_null(self, s):
        r = s.get(f"{BASE_URL}/api/weekly/{MONDAY.isoformat()}/leaderboard", params={"device_id": dev(WK)})
        assert r.status_code == 200
        assert not r.json()["you"]


# ---- Boss Rush ----
def rush(device, handle="TEST_rush", ms=90000, undos=0, splits=(30000, 30000, 30000)):
    return {"device_id": device, "handle": handle, "ms": ms, "undos": undos, "splits": list(splits)}


class TestBossRush:
    PREFIX = BR

    def test_post_returns_entry(self, s):
        r = s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(dev(BR), ms=95000))
        assert r.status_code == 200, r.text
        e = r.json()
        assert (e["ms"], e["is_you"], e["splits"]) == (95000, True, [30000, 30000, 30000])
        assert e["rank"] >= 1

    def test_get_board_sorted_with_you(self, s):
        d = dev(BR)
        s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d, ms=95000))
        g = s.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d}).json()
        assert (g["you"]["ms"], g["you"]["handle"]) == (95000, "TEST_rush")
        ms = [x["ms"] for x in g["entries"]]
        assert ms == sorted(ms)
        assert g["total"] >= len(g["entries"])

    def test_keeps_best_and_refreshes_handle(self, s):
        d = dev(BR)
        s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d, ms=100000))
        r = s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d, ms=92000, undos=1))
        assert r.json()["ms"] == 92000 and r.json()["undos"] == 1
        r = s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d, handle="TEST_renamed", ms=120000))
        assert r.status_code == 200
        assert r.json()["ms"] == 92000 and r.json()["handle"] == "TEST_renamed"
        assert db.bossrush_scores.count_documents({"device_id": d}) == 1
        g = s.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d}).json()
        assert g["you"]["ms"] == 92000 and g["you"]["handle"] == "TEST_renamed"

    def test_ms_less_than_splits_400(self, s):
        r = s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(dev(BR), ms=80000))
        assert r.status_code == 400

    @pytest.mark.parametrize("patch", [
        {"ms": 4999, "splits": [1000, 1000, 1000]}, {"ms": 3600001}, {"splits": [999, 30000, 30000]},
        {"splits": [30000, 30000]}, {"splits": [20000, 20000, 20000, 20000]}, {"splits": [3600001, 1000, 1000]},
        {"handle": "ab"}, {"handle": "bad handle!"}, {"handle": "x" * 17}, {"device_id": "short"},
        {"device_id": "bad$device$id"}, {"undos": -1},
    ])
    def test_validation_422(self, s, patch):
        b = rush(dev(BR))
        b.update(patch)
        r = s.post(f"{BASE_URL}/api/bossrush/scores", json=b)
        assert r.status_code in (400, 422), f"{patch} -> {r.status_code} {r.text}"

    def test_boundaries_ok(self, s):
        r = s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(dev(BR), ms=5000, splits=(1000, 1000, 3000)))
        assert r.status_code == 200, r.text

    def test_concurrent_no_duplicates(self, s):
        d = dev(BR)
        codes = []

        def go(ms):
            codes.append(requests.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d, ms=ms)).status_code)

        ts = [threading.Thread(target=go, args=(91000 + i * 100,)) for i in range(8)]
        [t.start() for t in ts]
        [t.join() for t in ts]
        assert all(c == 200 for c in codes), codes
        assert db.bossrush_scores.count_documents({"device_id": d}) == 1
        assert db.bossrush_scores.find_one({"device_id": d})["ms"] == 91000

    def test_ties_share_rank(self, s):
        d1, d2 = dev(BR), dev(BR)
        s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d1, ms=777777, splits=(1000, 1000, 1000)))
        s.post(f"{BASE_URL}/api/bossrush/scores", json=rush(d2, ms=777777, splits=(1000, 1000, 1000)))
        g = s.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d1, "limit": 100}).json()
        r2 = s.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d2}).json()["you"]
        assert g["you"]["rank"] == r2["rank"]
        assert "_id" not in str(g)
