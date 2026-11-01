from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict, field_validator
from typing import Annotated, Dict, List, Optional, Union
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.responses import HTMLResponse

from moderation import is_profane

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()


# Deployment health probes (plain and /api-prefixed). No DB call, so it answers as soon as the server is up.
@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)

    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()

    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)

    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])

    return status_checks


# ---------------------------------------------------------------------------
# Starport Rush Daily Challenge leaderboard (no login: handle + random device id)
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v))]
HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{3,16}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DEVICE_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude_none=True)
        d.pop("_id", None)
        return d

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)


class DailyScore(BaseDocument):
    date: str
    device_id: str
    handle: str
    score: int
    seconds: int
    undos: int
    best_combo: int
    moves: int
    replay_code: Optional[str] = None
    updated_at: str


class DailyScoreIn(BaseModel):
    device_id: str
    handle: str
    score: int = Field(ge=100, le=2500)
    seconds: int = Field(ge=1, le=36000)
    undos: int = Field(ge=0, le=999)
    best_combo: int = Field(ge=0, le=30)
    moves: int = Field(ge=1, le=200)
    replay_code: Optional[str] = Field(default=None, max_length=1200)

    @field_validator("handle")
    @classmethod
    def _handle(cls, v: str) -> str:
        if not HANDLE_RE.match(v):
            raise ValueError("handle must be 3-16 letters, numbers or _")
        if is_profane(v):
            raise ValueError("handle not allowed")
        return v

    @field_validator("device_id")
    @classmethod
    def _device(cls, v: str) -> str:
        if not DEVICE_RE.match(v):
            raise ValueError("invalid device id")
        return v


class LeaderboardEntry(BaseModel):
    rank: int
    handle: str
    score: int
    seconds: int
    undos: int
    best_combo: int
    replay_code: Optional[str] = None
    is_you: bool = False
    champion: bool = False  # last week's Weekly Cup winner


class LeaderboardOut(BaseModel):
    date: str
    total: int
    entries: List[LeaderboardEntry]
    you: Optional[LeaderboardEntry] = None


def _parse_day(value: str, fmt_error: str):
    """YYYY-MM-DD -> date, or a 400. Always returns a date or raises (no unassigned paths)."""
    if not DATE_RE.match(value):
        raise HTTPException(400, fmt_error)
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "invalid date") from None


def _check_date(date: str, posting: bool):
    d = _parse_day(date, "date must be YYYY-MM-DD")
    today = datetime.now(timezone.utc).date()
    # +-1 day tolerance for time zones; scores only accepted for the live puzzle window
    if posting and abs((d - today).days) > 1:
        raise HTTPException(400, "scores are only accepted for today's puzzle")
    if d - today > timedelta(days=1):
        raise HTTPException(400, "future date")


async def _rank_of(date: str, score: int, seconds: int) -> int:
    better = await db.daily_scores.count_documents(
        {"date": date, "$or": [{"score": {"$gt": score}}, {"score": score, "seconds": {"$lt": seconds}}]}
    )
    return better + 1


def _entry(s: DailyScore, rank: int, device_id: Optional[str], champs: frozenset = frozenset()) -> LeaderboardEntry:
    return LeaderboardEntry(
        rank=rank, handle=s.handle, score=s.score, seconds=s.seconds, undos=s.undos,
        best_combo=s.best_combo, replay_code=s.replay_code, is_you=device_id == s.device_id, champion=s.device_id in champs,
    )


@api_router.post("/daily/{date}/scores", response_model=LeaderboardEntry)
async def submit_daily_score(date: str, body: DailyScoreIn):
    _check_date(date, posting=True)
    now = datetime.now(timezone.utc).isoformat()
    doc = None
    for _ in range(2):  # retry once if a concurrent first insert wins the unique index
        existing = await db.daily_scores.find_one({"date": date, "device_id": body.device_id})
        if existing:
            # atomic "only if better" write: safe when the same device posts several scores at once
            better = {"$or": [{"score": {"$lt": body.score}}, {"score": body.score, "seconds": {"$gt": body.seconds}}]}
            doc = await db.daily_scores.find_one_and_update(
                {"_id": existing["_id"], **better},
                {"$set": {**body.model_dump(exclude={"device_id"}), "updated_at": now}},
                return_document=ReturnDocument.AFTER,
            )
            if not doc:  # not better: keep the stored score, just refresh the handle
                doc = await db.daily_scores.find_one_and_update(
                    {"_id": existing["_id"]}, {"$set": {"handle": body.handle, "updated_at": now}}, return_document=ReturnDocument.AFTER
                )
            break
        try:
            rec = DailyScore(date=date, updated_at=now, **body.model_dump())
            res = await db.daily_scores.insert_one(rec.to_mongo())
            doc = await db.daily_scores.find_one({"_id": res.inserted_id})
            break
        except DuplicateKeyError:
            continue
    if not doc:
        raise HTTPException(409, "please retry")
    s = DailyScore.from_mongo(doc)
    return _entry(s, await _rank_of(date, s.score, s.seconds), body.device_id)


@api_router.get("/daily/{date}/leaderboard", response_model=LeaderboardOut)
async def daily_leaderboard(date: str, limit: int = Query(50, ge=1, le=100), device_id: Optional[str] = None):
    _check_date(date, posting=False)
    cursor = db.daily_scores.find({"date": date}).sort([("score", -1), ("seconds", 1)]).limit(limit)
    docs = await cursor.to_list(limit)
    champs = await _champion_devices()
    entries = [_entry(DailyScore.from_mongo(d), i + 1, device_id, champs) for i, d in enumerate(docs)]
    you = None
    if device_id and DEVICE_RE.match(device_id):
        mine = await db.daily_scores.find_one({"date": date, "device_id": device_id})
        if mine:
            s = DailyScore.from_mongo(mine)
            you = _entry(s, await _rank_of(date, s.score, s.seconds), device_id, champs)
    total = await db.daily_scores.count_documents({"date": date})
    _mask_all([*entries, you], await _hidden_handles([*entries, you]))
    return LeaderboardOut(date=date, total=total, entries=entries, you=you)


# ---------------------------------------------------------------------------
# Name safety: reports + masking. Handles that fail the filter, or are reported by
# REPORT_THRESHOLD different devices, are shown as HIDDEN_HANDLE on every board.
# ---------------------------------------------------------------------------
HIDDEN_HANDLE = "HiddenPilot"
REPORT_THRESHOLD = 3


async def _hidden_handles(entries: list) -> set:
    names = list({e.handle.lower() for e in entries if e})
    rows = await db.handle_reports.aggregate([
        {"$match": {"handle_lower": {"$in": names}}},
        {"$group": {"_id": "$handle_lower", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gte": REPORT_THRESHOLD}}},
    ]).to_list(None)
    return {r["_id"] for r in rows}


def _mask_all(entries: list, hidden: set) -> None:
    for e in entries:
        if e and (e.handle.lower() in hidden or is_profane(e.handle)):
            e.handle = HIDDEN_HANDLE


class ReportIn(BaseModel):
    reporter_device_id: str
    handle: str
    board: str = Field(pattern=r"^(daily|weekly|bossrush)$")
    reason: str = Field(pattern=r"^(offensive|impersonation|other)$")

    @field_validator("reporter_device_id")
    @classmethod
    def _device(cls, v: str) -> str:
        if not DEVICE_RE.match(v):
            raise ValueError("invalid device id")
        return v

    @field_validator("handle")
    @classmethod
    def _reported(cls, v: str) -> str:
        if not HANDLE_RE.match(v) or v.lower() == HIDDEN_HANDLE.lower():
            raise ValueError("invalid handle")
        return v


class HandleReport(BaseDocument):
    reporter_device_id: str
    handle: str
    handle_lower: str
    board: str
    reason: str
    created_at: str


@api_router.post("/reports")
async def report_handle(body: ReportIn):
    rec = HandleReport(handle_lower=body.handle.lower(), created_at=datetime.now(timezone.utc).isoformat(), **body.model_dump())
    try:
        await db.handle_reports.insert_one(rec.to_mongo())
        duplicate = False
    except DuplicateKeyError:  # one report per device per handle
        duplicate = True
    count = await db.handle_reports.count_documents({"handle_lower": rec.handle_lower})
    return {"ok": True, "duplicate": duplicate, "hidden": count >= REPORT_THRESHOLD}


PRIVACY_HTML = Path(__file__).parent / "static" / "privacy.html"


@api_router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return HTMLResponse(PRIVACY_HTML.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Weekly Cup: sum of each player's best daily score for each day of a UTC week (Mon-Sun)
# ---------------------------------------------------------------------------
class WeeklyEntry(BaseModel):
    rank: int
    handle: str
    total: int
    days: int
    is_you: bool = False
    champion: bool = False


class WeeklyOut(BaseModel):
    week_start: str
    week_end: str
    total_players: int
    entries: List[WeeklyEntry]
    you: Optional[WeeklyEntry] = None
    last_week_top: List[WeeklyEntry]


def _week_bounds(week_start: str):
    d = _parse_day(week_start, "week must be YYYY-MM-DD")
    if d.weekday() != 0:
        raise HTTPException(400, "week must start on a Monday (UTC)")
    return d


async def _weekly_rows(start, limit: Optional[int] = None) -> list:
    days = [(start + timedelta(days=i)).isoformat() for i in range(7)]
    pipeline = [
        {"$match": {"date": {"$in": days}}},
        {"$sort": {"updated_at": -1}},
        {"$group": {"_id": "$device_id", "handle": {"$first": "$handle"}, "total": {"$sum": "$score"}, "days": {"$sum": 1}}},
        {"$sort": {"total": -1, "days": 1, "handle": 1}},
    ]
    if limit:
        pipeline.append({"$limit": limit})
    return await db.daily_scores.aggregate(pipeline).to_list(None)


def _weekly_entries(rows: list, device_id: Optional[str], champs: frozenset = frozenset()) -> List[WeeklyEntry]:
    out, rank, prev = [], 0, None
    for i, r in enumerate(rows):
        if r["total"] != prev:  # ties share a rank
            rank, prev = i + 1, r["total"]
        out.append(WeeklyEntry(rank=rank, handle=r["handle"], total=r["total"], days=r["days"], is_you=r["_id"] == device_id, champion=r["_id"] in champs))
    return out


@api_router.get("/weekly/{week_start}/leaderboard", response_model=WeeklyOut)
async def weekly_leaderboard(week_start: str, limit: int = Query(50, ge=1, le=100), device_id: Optional[str] = None):
    start = _week_bounds(week_start)
    dev = device_id if device_id and DEVICE_RE.match(device_id) else None
    champs = await _champion_devices(start)
    entries = _weekly_entries(await _weekly_rows(start), dev, champs)
    last = _weekly_entries(await _weekly_rows(start - timedelta(days=7), limit=3), dev, champs)  # podium only
    you = next((e for e in entries if e.is_you), None)
    _mask_all([*entries, *last], await _hidden_handles([*entries, *last]))
    return WeeklyOut(
        week_start=start.isoformat(), week_end=(start + timedelta(days=6)).isoformat(), total_players=len(entries),
        entries=entries[:limit], you=you, last_week_top=last,
    )


# ---------------------------------------------------------------------------
# Boss Rush: all 3 sector bosses back to back, one combined time (lower is better)
# ---------------------------------------------------------------------------
class BossRushScore(BaseDocument):
    device_id: str
    handle: str
    ms: int  # total incl. undo penalties
    undos: int
    splits: List[int]
    updated_at: str


class BossRushIn(BaseModel):
    device_id: str
    handle: str
    ms: int = Field(ge=5000, le=3_600_000)
    undos: int = Field(ge=0, le=999)
    splits: List[int] = Field(min_length=3, max_length=3)

    _handle = field_validator("handle")(DailyScoreIn._handle.__func__)
    _device = field_validator("device_id")(DailyScoreIn._device.__func__)

    @field_validator("splits")
    @classmethod
    def _splits(cls, v: List[int]) -> List[int]:
        if any(s < 1000 or s > 3_600_000 for s in v):
            raise ValueError("invalid split")
        return v


class BossRushEntry(BaseModel):
    rank: int
    handle: str
    ms: int
    undos: int
    splits: List[int]
    is_you: bool = False
    champion: bool = False


class BossRushOut(BaseModel):
    total: int
    entries: List[BossRushEntry]
    you: Optional[BossRushEntry] = None


async def _rush_rank(ms: int) -> int:
    return await db.bossrush_scores.count_documents({"ms": {"$lt": ms}}) + 1


def _rush_entry(s: BossRushScore, rank: int, device_id: Optional[str], champs: frozenset = frozenset()) -> BossRushEntry:
    return BossRushEntry(
        rank=rank, handle=s.handle, ms=s.ms, undos=s.undos, splits=s.splits, is_you=device_id == s.device_id, champion=s.device_id in champs,
    )


@api_router.post("/bossrush/scores", response_model=BossRushEntry)
async def submit_bossrush(body: BossRushIn):
    if body.ms < sum(body.splits):
        raise HTTPException(400, "total time can't be less than the boss splits")
    now = datetime.now(timezone.utc).isoformat()
    doc = None
    for _ in range(2):
        existing = await db.bossrush_scores.find_one({"device_id": body.device_id})
        if existing:
            doc = await db.bossrush_scores.find_one_and_update(
                {"_id": existing["_id"], "ms": {"$gt": body.ms}},
                {"$set": {**body.model_dump(exclude={"device_id"}), "updated_at": now}},
                return_document=ReturnDocument.AFTER,
            )
            if not doc:  # not faster: keep the best time, refresh handle
                doc = await db.bossrush_scores.find_one_and_update(
                    {"_id": existing["_id"]}, {"$set": {"handle": body.handle, "updated_at": now}}, return_document=ReturnDocument.AFTER
                )
            break
        try:
            rec = BossRushScore(updated_at=now, **body.model_dump())
            res = await db.bossrush_scores.insert_one(rec.to_mongo())
            doc = await db.bossrush_scores.find_one({"_id": res.inserted_id})
            break
        except DuplicateKeyError:
            continue
    if not doc:
        raise HTTPException(409, "please retry")
    s = BossRushScore.from_mongo(doc)
    return _rush_entry(s, await _rush_rank(s.ms), body.device_id)


@api_router.get("/bossrush/leaderboard", response_model=BossRushOut)
async def bossrush_leaderboard(limit: int = Query(50, ge=1, le=100), device_id: Optional[str] = None):
    docs = await db.bossrush_scores.find({}).sort([("ms", 1), ("updated_at", 1)]).limit(limit).to_list(limit)
    champs = await _champion_devices()
    entries = []
    for i, d in enumerate(docs):
        s = BossRushScore.from_mongo(d)
        # sorted by ms: rank = position of the first entry with the same time (ties share a rank)
        rank = entries[-1].rank if entries and entries[-1].ms == s.ms else i + 1
        entries.append(_rush_entry(s, rank, device_id, champs))
    you = None
    if device_id and DEVICE_RE.match(device_id):
        mine = await db.bossrush_scores.find_one({"device_id": device_id})
        if mine:
            s = BossRushScore.from_mongo(mine)
            you = _rush_entry(s, await _rush_rank(s.ms), device_id, champs)
    _mask_all([*entries, you], await _hidden_handles([*entries, you]))
    return BossRushOut(total=await db.bossrush_scores.count_documents({}), entries=entries, you=you)


# ---------------------------------------------------------------------------
# Champion Hat: last week's Weekly Cup winner(s) wear it for the whole current week
# ---------------------------------------------------------------------------
def _current_week_start():
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())


async def _champion_rows(week_start=None) -> list:
    """Top row(s) of the week before `week_start` (ties all win)."""
    start = week_start or _current_week_start()
    rows = await _weekly_rows(start - timedelta(days=7))
    return [r for r in rows if rows and r["total"] == rows[0]["total"]]


async def _champion_devices(week_start=None) -> frozenset:
    return frozenset(r["_id"] for r in await _champion_rows(week_start))


@api_router.get("/champion")
async def current_champion(device_id: Optional[str] = None):
    start = _current_week_start()
    rows = await _champion_rows(start)
    champs = [WeeklyEntry(rank=1, handle=r["handle"], total=r["total"], days=r["days"], is_you=r["_id"] == device_id, champion=True) for r in rows]
    _mask_all(champs, await _hidden_handles(champs))
    return {
        "week_start": start.isoformat(),
        "expires": (start + timedelta(days=7)).isoformat(),
        "champions": [c.model_dump() for c in champs],
        "is_you": any(c.is_you for c in champs),
    }


# ---------------------------------------------------------------------------
# Cloud Save: no accounts. A device uploads its progress and gets a save code;
# entering the code on another device restores it (and adopts the same device id,
# so leaderboard entries follow the player).
# ---------------------------------------------------------------------------
SAVE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I/L
SAVE_KEY_RE = re.compile(r"^sr_[A-Za-z0-9_-]{1,60}$")
SaveValue = Union[str, int, float, bool, None]
SAVE_LOOKUPS_PER_MIN = 30
_SAVE_LOOKUPS: Dict[str, list] = {}  # client ip -> recent lookup times (in-memory, per process)


class SaveIn(BaseModel):
    device_id: str
    data: Dict[str, SaveValue]

    @field_validator("device_id")
    @classmethod
    def _device(cls, v: str) -> str:
        if not DEVICE_RE.match(v):
            raise ValueError("invalid device id")
        return v

    @field_validator("data")
    @classmethod
    def _data(cls, v: Dict[str, SaveValue]) -> Dict[str, SaveValue]:
        if len(v) > 300 or not all(SAVE_KEY_RE.match(k) for k in v):
            raise ValueError("invalid save data")
        if len(json.dumps(v)) > 32_000:
            raise ValueError("save data too large")
        return v


class CloudSave(BaseDocument):
    code: str
    device_id: str
    data: Dict[str, SaveValue]
    updated_at: str


def _new_code() -> str:
    return "".join(secrets.choice(SAVE_ALPHABET) for _ in range(8))


def _norm_code(code: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", code.upper())


@api_router.post("/saves")
async def upload_save(body: SaveIn):
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.cloud_saves.find_one({"device_id": body.device_id})
    if existing:
        await db.cloud_saves.update_one({"_id": existing["_id"]}, {"$set": {"data": body.data, "updated_at": now}})
        return {"code": existing["code"], "updated_at": now}
    for _ in range(5):
        rec = CloudSave(code=_new_code(), device_id=body.device_id, data=body.data, updated_at=now)
        try:
            await db.cloud_saves.insert_one(rec.to_mongo())
            return {"code": rec.code, "updated_at": now}
        except DuplicateKeyError:  # code clash (or same device racing): retry / reuse
            again = await db.cloud_saves.find_one({"device_id": body.device_id})
            if again:
                return {"code": again["code"], "updated_at": again["updated_at"]}
    raise HTTPException(409, "please retry")


@api_router.get("/saves/{code}")
async def download_save(code: str, request: Request):
    # slow down code guessing: a few lookups per minute per client
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.monotonic()
    hits = [t for t in _SAVE_LOOKUPS.get(ip, []) if now - t < 60]
    if len(hits) >= SAVE_LOOKUPS_PER_MIN:
        raise HTTPException(429, "too many attempts, try again in a minute")
    _SAVE_LOOKUPS[ip] = [*hits, now]
    doc = await db.cloud_saves.find_one({"code": _norm_code(code)})
    if not doc:
        raise HTTPException(404, "save code not found")
    s = CloudSave.from_mongo(doc)
    return {"code": s.code, "device_id": s.device_id, "data": s.data, "updated_at": s.updated_at}


@app.on_event("startup")
async def ensure_indexes():
    await db.daily_scores.create_index([("date", 1), ("device_id", 1)], unique=True)
    await db.daily_scores.create_index([("date", 1), ("score", -1), ("seconds", 1)])
    await db.bossrush_scores.create_index([("device_id", 1)], unique=True)
    await db.bossrush_scores.create_index([("ms", 1)])
    await db.handle_reports.create_index([("reporter_device_id", 1), ("handle_lower", 1)], unique=True)
    await db.handle_reports.create_index([("handle_lower", 1)])
    await db.cloud_saves.create_index([("code", 1)], unique=True)
    await db.cloud_saves.create_index([("device_id", 1)], unique=True)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
