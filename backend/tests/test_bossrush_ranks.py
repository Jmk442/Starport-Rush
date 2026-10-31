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


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    db.bossrush_scores.delete_many({"device_id": {"$regex": "^test-rk-"}})
    yield
    db.bossrush_scores.delete_many({"device_id": {"$regex": "^test-rk-"}})


def post(d, ms, handle):
    r = requests.post(f"{BASE_URL}/api/bossrush/scores",
                      json={"device_id": d, "handle": handle, "ms": ms, "undos": 0, "splits": [1500, 1500, 1500]})
    assert r.status_code == 200, r.text
    return r.json()


def test_list_ranks_with_ties_match_you_rank():
    # very fast times so they're the top of the board
    devs = {f"test-rk-{uuid.uuid4().hex[:8]}": ms for ms in (5001, 5001, 5002, 5003, 5003, 5003, 5004)}
    for i, (d, ms) in enumerate(devs.items()):
        post(d, ms, f"TEST_rk{i}")
    g = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"limit": 100}).json()
    ents = g["entries"]
    # entries sorted ascending by ms
    assert [e["ms"] for e in ents] == sorted(e["ms"] for e in ents)
    # competition ranking over the whole list
    for i, e in enumerate(ents):
        if i and ents[i - 1]["ms"] == e["ms"]:
            assert e["rank"] == ents[i - 1]["rank"]
        else:
            assert e["rank"] == i + 1
    ours = {e["ms"]: e["rank"] for e in ents if e["handle"].startswith("TEST_rk")}
    base = ours[5001]
    assert ours[5002] == base + 2 and ours[5003] == base + 3 and ours[5004] == base + 6
    # "you" rank agrees with list rank for every device
    for d, ms in devs.items():
        you = requests.get(f"{BASE_URL}/api/bossrush/leaderboard", params={"device_id": d, "limit": 1}).json()["you"]
        assert you["rank"] == ours[ms] and you["is_you"] is True
    # POST response rank matches too
    d0 = next(iter(devs))
    assert post(d0, 5001, "TEST_rk0")["rank"] == base
