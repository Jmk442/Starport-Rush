from fastapi import FastAPI, APIRouter, HTTPException, Query
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
from typing import Annotated, List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import boto3

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Tigris S3-compatible client
s3_client = boto3.client(
    's3',
    endpoint_url=os.environ.get('TIGRIS_ENDPOINT', 'http://localhost:8085'),
    aws_access_key_id=os.environ.get('TIGRIS_ACCESS_KEY_ID', ''),
    aws_secret_access_key=os.environ.get('TIGRIS_SECRET_ACCESS_KEY', ''),
    region_name='auto',
)
TIGRIS_BUCKET = os.environ.get('TIGRIS_BUCKET', 'default-bucket')

# Create the main app without a prefix
app = FastAPI()

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


class LeaderboardOut(BaseModel):
    date: str
    total: int
    entries: List[LeaderboardEntry]
    you: Optional[LeaderboardEntry] = None


def _check_date(date: str, posting: bool):
    if not DATE_RE.match(date):
        raise HTTPException(400, "date must be YYYY-MM-DD")
    try:
        d = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "invalid date")
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


def _entry(s: DailyScore, rank: int, device_id: Optional[str]) -> LeaderboardEntry:
    return LeaderboardEntry(
        rank=rank, handle=s.handle, score=s.score, seconds=s.seconds, undos=s.undos,
        best_combo=s.best_combo, replay_code=s.replay_code, is_you=device_id == s.device_id,
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
            if doc is None:  # not better: keep the stored score, just refresh the handle
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
    if doc is None:
        raise HTTPException(409, "please retry")
    s = DailyScore.from_mongo(doc)
    return _entry(s, await _rank_of(date, s.score, s.seconds), body.device_id)


@api_router.get("/daily/{date}/leaderboard", response_model=LeaderboardOut)
async def daily_leaderboard(date: str, limit: int = Query(50, ge=1, le=100), device_id: Optional[str] = None):
    _check_date(date, posting=False)
    cursor = db.daily_scores.find({"date": date}).sort([("score", -1), ("seconds", 1)]).limit(limit)
    docs = await cursor.to_list(limit)
    entries = [_entry(DailyScore.from_mongo(d), i + 1, device_id) for i, d in enumerate(docs)]
    you = None
    if device_id and DEVICE_RE.match(device_id):
        mine = await db.daily_scores.find_one({"date": date, "device_id": device_id})
        if mine:
            s = DailyScore.from_mongo(mine)
            you = _entry(s, await _rank_of(date, s.score, s.seconds), device_id)
    total = await db.daily_scores.count_documents({"date": date})
    return LeaderboardOut(date=date, total=total, entries=entries, you=you)


@app.on_event("startup")
async def ensure_indexes():
    await db.daily_scores.create_index([("date", 1), ("device_id", 1)], unique=True)
    await db.daily_scores.create_index([("date", 1), ("score", -1), ("seconds", 1)])

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
