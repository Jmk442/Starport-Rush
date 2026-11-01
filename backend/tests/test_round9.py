"""Round 9: Cloud Save codes (Champion Hat is covered in test_round9_extra.py, one module so seeds don't race)."""
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
PREFIX = "test-r9-"


def dev():
    return f"{PREFIX}{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    db.daily_scores.delete_many({"device_id": {"$regex": f"^{PREFIX}"}})
    db.cloud_saves.delete_many({"device_id": {"$regex": f"^{PREFIX}"}})


def test_cloud_save_roundtrip_and_update():
    d = dev()
    r1 = requests.post(f"{BASE_URL}/api/saves", json={"device_id": d, "data": {"sr_stars_1": 3, "sr_handle": "ZippyBlip22"}})
    assert r1.status_code == 200
    code = r1.json()["code"]
    assert len(code) == 8
    r2 = requests.post(f"{BASE_URL}/api/saves", json={"device_id": d, "data": {"sr_stars_1": 3, "sr_stars_2": 2}})
    assert r2.json()["code"] == code  # stable per device
    got = requests.get(f"{BASE_URL}/api/saves/{code[:4].lower()}-{code[4:]}").json()
    assert got["device_id"] == d and got["data"] == {"sr_stars_1": 3, "sr_stars_2": 2}


def test_cloud_save_validation():
    assert requests.get(f"{BASE_URL}/api/saves/ZZZZZZZZ").status_code == 404
    bad = [
        {"device_id": "bad id!", "data": {}},
        {"device_id": dev(), "data": {"not_sr": 1}},
        {"device_id": dev(), "data": {"sr_x": "a" * 40_000}},
        {"device_id": dev(), "data": {"sr_x": {"nested": 1}}},
    ]
    for body in bad:
        assert requests.post(f"{BASE_URL}/api/saves", json=body).status_code == 422, body
