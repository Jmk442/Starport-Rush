# Daily Challenge leaderboard API tests (submit/upsert, ranking, validation)
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/mobile/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")


def dev():
    return f"test-{uuid.uuid4().hex[:12]}"


def body(device_id, handle="TEST_pilot", score=1000, seconds=60, **kw):
    b = {"device_id": device_id, "handle": handle, "score": score, "seconds": seconds,
         "undos": 0, "best_combo": 2, "moves": 8}
    b.update(kw)
    return b


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    c = MongoClient(os.environ["MONGO_URL"])
    c[os.environ["DB_NAME"]].daily_scores.delete_many({"device_id": {"$regex": "^test-"}})


@pytest.fixture
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


def post(s, b, date=TODAY):
    return s.post(f"{BASE_URL}/api/daily/{date}/scores", json=b, timeout=15)


def board(s, device_id=None, date=TODAY):
    p = {"device_id": device_id} if device_id else {}
    return s.get(f"{BASE_URL}/api/daily/{date}/leaderboard", params=p, timeout=15)


class TestSubmit:
    def test_submit_returns_rank_and_fields(self, s):
        d = dev()
        r = post(s, body(d, score=2400, seconds=30, replay_code="SR1.d.0.2.x.a-01"))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["rank"] >= 1 and j["score"] == 2400 and j["is_you"] is True
        assert j["handle"] == "TEST_pilot" and j["replay_code"] == "SR1.d.0.2.x.a-01"
        assert "_id" not in j and "device_id" not in j

    def test_worse_score_does_not_overwrite(self, s):
        d = dev()
        assert post(s, body(d, score=1500, seconds=40)).status_code == 200
        r = post(s, body(d, handle="TEST_renamed", score=900, seconds=10))
        assert r.status_code == 200
        assert r.json()["score"] == 1500 and r.json()["seconds"] == 40
        you = board(s, d).json()["you"]
        assert you["score"] == 1500 and you["seconds"] == 40
        assert you["handle"] == "TEST_renamed"  # handle refreshes

    def test_better_score_overwrites(self, s):
        d = dev()
        post(s, body(d, score=1200, seconds=50))
        r = post(s, body(d, score=1300, seconds=70))
        assert r.json()["score"] == 1300
        # equal score faster time also improves
        r = post(s, body(d, score=1300, seconds=20))
        assert r.json()["seconds"] == 20

    def test_one_doc_per_device(self, s):
        d = dev()
        for sc in (500, 700, 600):
            post(s, body(d, score=sc))
        c = MongoClient(os.environ["MONGO_URL"])
        assert c[os.environ["DB_NAME"]].daily_scores.count_documents({"device_id": d, "date": TODAY}) == 1


class TestLeaderboard:
    def test_sorted_and_you_total(self, s):
        a, b, c = dev(), dev(), dev()
        post(s, body(a, handle="TEST_a", score=2500, seconds=50))
        post(s, body(b, handle="TEST_b", score=2500, seconds=20))
        post(s, body(c, handle="TEST_c", score=2499, seconds=5))
        r = board(s, a)
        assert r.status_code == 200
        j = r.json()
        es = j["entries"]
        keys = [(-e["score"], e["seconds"]) for e in es]
        assert keys == sorted(keys)
        assert [e["rank"] for e in es] == list(range(1, len(es) + 1))
        assert j["you"]["handle"] == "TEST_a" and j["total"] >= 3 and j["date"] == TODAY
        hb = next(e for e in es if e["handle"] == "TEST_b")
        ha = next(e for e in es if e["handle"] == "TEST_a")
        assert hb["rank"] < ha["rank"]
        assert sum(1 for e in es if e["is_you"]) == 1

    def test_no_device_you_null(self, s):
        j = board(s).json()
        assert j["you"] is None and all(not e["is_you"] for e in j["entries"])

    def test_empty_old_date(self, s):
        r = board(s, date="2020-01-01")
        assert r.status_code == 200 and r.json()["entries"] == [] and r.json()["total"] == 0

    def test_future_date_400(self, s):
        fut = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
        assert board(s, date=fut).status_code == 400

    def test_bad_date_format_400(self, s):
        assert board(s, date="2026-13-45").status_code == 400
        assert board(s, date="abc").status_code == 400


class TestValidation:
    @pytest.mark.parametrize("h", ["ab", "x" * 17, "bad name", "émoji", "a.b"])
    def test_invalid_handle_422(self, s, h):
        assert post(s, body(dev(), handle=h)).status_code == 422

    @pytest.mark.parametrize("d", ["short", "has space here", "x" * 65, "bad_underscore"])
    def test_invalid_device_422(self, s, d):
        assert post(s, body(d)).status_code == 422

    @pytest.mark.parametrize("sc", [99, 2501])
    def test_score_range_422(self, s, sc):
        assert post(s, body(dev(), score=sc)).status_code == 422

    def test_date_outside_window_400(self, s):
        for delta in (-2, 2):
            dt = (datetime.now(timezone.utc) + timedelta(days=delta)).strftime("%Y-%m-%d")
            assert post(s, body(dev()), date=dt).status_code == 400

    def test_date_yesterday_tomorrow_ok(self, s):
        for delta in (-1, 1):
            dt = (datetime.now(timezone.utc) + timedelta(days=delta)).strftime("%Y-%m-%d")
            assert post(s, body(dev()), date=dt).status_code == 200

    def test_long_replay_code_422(self, s):
        assert post(s, body(dev(), replay_code="x" * 1201)).status_code == 422


# Race: concurrent first submissions for a new device must all succeed and leave 1 doc
class TestConcurrentFirstSubmit:
    @pytest.mark.parametrize("n", [12, 24])
    def test_parallel_first_posts(self, n):
        from concurrent.futures import ThreadPoolExecutor
        for _ in range(3):
            d = dev()
            def go(i):
                return requests.post(f"{BASE_URL}/api/daily/{TODAY}/scores",
                                     json=body(d, score=1000 + i, seconds=60), timeout=20)
            with ThreadPoolExecutor(max_workers=n) as ex:
                rs = list(ex.map(go, range(n)))
            codes = [r.status_code for r in rs]
            assert all(c == 200 for c in codes), codes
            c = MongoClient(os.environ["MONGO_URL"])
            assert c[os.environ["DB_NAME"]].daily_scores.count_documents({"device_id": d, "date": TODAY}) == 1
            j = board(requests, d).json()
            assert j["you"] is not None and 1000 <= j["you"]["score"] <= 1000 + n - 1
