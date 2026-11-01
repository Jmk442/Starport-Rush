# Boss Rush leaderboard: ranks computed from sorted order (ties share a rank, competition ranking)
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/mobile/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def cleanup():
    # per test, so each test sees only its own seeded ties
    db.bossrush_scores.delete_many({"device_id": {"$regex": "^test-rk-"}})
    yield
    db.bossrush_scores.delete_many({"device_id": {"$regex": "^test-rk-"}})


def post(d, ms, handle):
    r = requests.post(f"{BASE_URL}/api/bossrush/scores",
                      json={"device_id": d, "handle": handle, "ms": ms, "undos": 0, "splits": [1500, 1500, 1500]})
    assert r.status_code == 200, r.text
    return r.json()


def expected_ranks(ms_list):
    """Competition ranking for an ascending list: ties share the rank of the first of them."""
    ranks = []
    for i, ms in enumerate(ms_list):
        ranks.append(ranks[-1] if i and ms_list[i - 1] == ms else i + 1)
    return ranks


def seed_board():
    devs = {f"test-rk-{uuid.uuid4().hex[:8]}": ms for ms in (5001, 5001, 5002, 5003, 5003, 5003, 5004)}
    for i, (d, ms) in enumerate(devs.items()):
        post(d, ms, f"TEST_rk{i}")
    return devs


def test_list_is_sorted_with_competition_ranks():
    seed_board()
    ents = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"limit": 100}).json()["entries"]
    ms = [e["ms"] for e in ents]
    assert ms == sorted(ms)
    assert [e["rank"] for e in ents] == expected_ranks(ms)


def test_tie_ranks_match_you_and_post_rank():
    devs = seed_board()
    ents = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"limit": 100}).json()["entries"]
    ours = {e["ms"]: e["rank"] for e in ents if e["handle"].startswith("TEST_rk")}
    base = ours[5001]
    assert (ours[5002], ours[5003], ours[5004]) == (base + 2, base + 3, base + 6)
    for d, ms in devs.items():
        you = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d, "limit": 1}).json()["you"]
        assert (you["rank"], you["is_you"]) == (ours[ms], True)
    d0 = next(iter(devs))
    assert post(d0, 5001, "TEST_rk0")["rank"] == base
