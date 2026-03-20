from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import uuid
import random
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="VIIBE API", description="Scene Intelligence Terminal")
api_router = APIRouter(prefix="/api")


# --- Models ---

class WaitlistSignup(BaseModel):
    email: str
    role: str = "scout"
    city: str = "lagos"


# --- Seed Data ---

SEED_VENUES = [
    {"id": "quilox-vi", "name": "Quilox", "category": "nightclub", "city": "lagos", "district": "Victoria Island", "vibe_score": 87, "energy_state": "electric", "capacity_pct": 85, "gate_status": "open", "trending": True, "lat": 6.4281, "lng": 3.4219, "peak_hour": "1:00 AM"},
    {"id": "shiro-vi", "name": "Shiro Lagos", "category": "lounge", "city": "lagos", "district": "Victoria Island", "vibe_score": 72, "energy_state": "warming", "capacity_pct": 60, "gate_status": "open", "trending": False, "lat": 6.4305, "lng": 3.4252, "peak_hour": "10:00 PM"},
    {"id": "escape-vi", "name": "Escape Nightclub", "category": "nightclub", "city": "lagos", "district": "Victoria Island", "vibe_score": 91, "energy_state": "peak", "capacity_pct": 92, "gate_status": "queue", "trending": True, "lat": 6.4312, "lng": 3.4187, "peak_hour": "12:30 AM"},
    {"id": "hardrock-vi", "name": "Hard Rock Cafe", "category": "bar", "city": "lagos", "district": "Victoria Island", "vibe_score": 65, "energy_state": "steady", "capacity_pct": 55, "gate_status": "open", "trending": False, "lat": 6.4295, "lng": 3.4198, "peak_hour": "9:00 PM"},
    {"id": "nok-ikoyi", "name": "NOK by Alara", "category": "restaurant", "city": "lagos", "district": "Ikoyi", "vibe_score": 78, "energy_state": "warming", "capacity_pct": 70, "gate_status": "reservation", "trending": True, "lat": 6.4465, "lng": 3.4328, "peak_hour": "8:30 PM"},
    {"id": "club-joker-vi", "name": "Club Joker", "category": "nightclub", "city": "lagos", "district": "Victoria Island", "vibe_score": 83, "energy_state": "electric", "capacity_pct": 78, "gate_status": "open", "trending": True, "lat": 6.4275, "lng": 3.4201, "peak_hour": "1:30 AM"},
    {"id": "circa-lekki", "name": "Circa Lekki", "category": "restaurant", "city": "lagos", "district": "Lekki Phase 1", "vibe_score": 69, "energy_state": "steady", "capacity_pct": 45, "gate_status": "open", "trending": False, "lat": 6.4489, "lng": 3.4756, "peak_hour": "8:00 PM"},
    {"id": "sky-lounge-vi", "name": "Sky Lounge", "category": "lounge", "city": "lagos", "district": "Victoria Island", "vibe_score": 76, "energy_state": "warming", "capacity_pct": 65, "gate_status": "open", "trending": False, "lat": 6.4298, "lng": 3.4265, "peak_hour": "11:00 PM"},
    {"id": "rhapsodys-vi", "name": "Rhapsody's", "category": "lounge", "city": "lagos", "district": "Victoria Island", "vibe_score": 81, "energy_state": "electric", "capacity_pct": 75, "gate_status": "open", "trending": True, "lat": 6.4308, "lng": 3.4229, "peak_hour": "11:30 PM"},
    {"id": "eko-hotel", "name": "Eko Hotel & Suites", "category": "event_space", "city": "lagos", "district": "Victoria Island", "vibe_score": 74, "energy_state": "warming", "capacity_pct": 50, "gate_status": "ticketed", "trending": False, "lat": 6.4267, "lng": 3.4183, "peak_hour": "9:00 PM"},
]


# --- Routes ---

@api_router.get("/")
async def root():
    return {"message": "VIIBE API — Scene Intelligence Terminal", "version": "1.0.0"}


@api_router.post("/waitlist")
async def join_waitlist(signup: WaitlistSignup):
    existing = await db.waitlist.find_one({"email": signup.email})
    if existing:
        raise HTTPException(status_code=409, detail="Already on the waitlist")

    position = await db.waitlist.count_documents({}) + 1
    entry = {
        "id": str(uuid.uuid4()),
        "email": signup.email,
        "role": signup.role,
        "city": signup.city,
        "position": position,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.waitlist.insert_one(entry)
    return {
        "id": entry["id"],
        "email": entry["email"],
        "role": entry["role"],
        "position": position,
        "message": "You're in."
    }


@api_router.get("/waitlist/stats")
async def waitlist_stats():
    total = await db.waitlist.count_documents({})
    by_role = {}
    for role in ["scout", "venue_owner", "developer"]:
        by_role[role] = await db.waitlist.count_documents({"role": role})
    return {"total": total, "by_role": by_role}


# --- Agent API v1 ---

@api_router.get("/v1/agent/venues/live")
async def agent_venues_live(city: str = "lagos", limit: int = 5, category: Optional[str] = None):
    query = {"city": city}
    if category:
        query["category"] = category
    venues = await db.venues.find(query, {"_id": 0}).sort("vibe_score", -1).limit(limit).to_list(limit)
    return {
        "city": city,
        "count": len(venues),
        "venues": venues,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/v1/agent/venues/{venue_id}")
async def agent_venue_detail(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@api_router.get("/v1/agent/city/pulse")
async def agent_city_pulse(city: str = "lagos"):
    venues = await db.venues.find({"city": city}, {"_id": 0}).to_list(100)
    if not venues:
        raise HTTPException(status_code=404, detail=f"No data for {city}")

    # Add live fluctuation to simulate real-time scout ratings
    live_venues = []
    for v in venues:
        base = v.get("vibe_score", 0)
        fluctuated = max(40, min(99, base + random.randint(-3, 3)))
        live_v = {**v, "vibe_score": fluctuated}
        live_venues.append(live_v)

    scores = [v["vibe_score"] for v in live_venues]
    avg = round(sum(scores) / len(scores), 1) if scores else 0
    top3 = sorted(live_venues, key=lambda x: x["vibe_score"], reverse=True)[:3]

    return {
        "city": city,
        "avg_vibe_score": avg,
        "total_venues": len(live_venues),
        "active_scouts": random.randint(3, 12),
        "energy_tiers": {
            "electric": len([s for s in scores if s >= 80]),
            "warming": len([s for s in scores if 60 <= s < 80]),
            "quiet": len([s for s in scores if s < 60])
        },
        "top_venues": [{"name": v["name"], "score": v["vibe_score"], "district": v.get("district")} for v in top3],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# --- Receipt Generator ---

@api_router.post("/receipt/generate")
async def generate_receipt(data: dict):
    venue_id = data.get("venue_id")
    username = data.get("username", "Anonymous Scout")

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    receipt_id = str(uuid.uuid4())[:8].upper()
    now = datetime.now(timezone.utc)

    receipt = {
        "receipt_id": receipt_id,
        "venue_name": venue["name"],
        "district": venue.get("district", "Lagos"),
        "category": venue.get("category", "venue"),
        "vibe_score": venue.get("vibe_score", 0),
        "energy_state": venue.get("energy_state", "steady"),
        "capacity_pct": venue.get("capacity_pct", 0),
        "scout_name": username,
        "checked_out": now.strftime("%b %d, %Y — %I:%M %p UTC"),
        "peak_hour": venue.get("peak_hour", "N/A"),
        "tagline": f"You were at {venue['name']} when the energy hit {venue.get('vibe_score', 0)}."
    }
    return receipt


# --- Weekly Report ---

@api_router.get("/report/weekly")
async def weekly_report(city: str = "lagos"):
    venues = await db.venues.find({"city": city}, {"_id": 0}).to_list(100)
    if not venues:
        raise HTTPException(status_code=404, detail=f"No data for {city}")

    live_venues = []
    for v in venues:
        base = v.get("vibe_score", 0)
        fluctuated = max(40, min(99, base + random.randint(-3, 3)))
        live_v = {**v, "vibe_score": fluctuated}
        live_venues.append(live_v)

    scores = [v["vibe_score"] for v in live_venues]
    avg = round(sum(scores) / len(scores), 1) if scores else 0
    top5 = sorted(live_venues, key=lambda x: x["vibe_score"], reverse=True)[:5]
    bottom3 = sorted(live_venues, key=lambda x: x["vibe_score"])[:3]
    trending = [v for v in live_venues if v.get("trending")]

    categories = {}
    for v in live_venues:
        cat = v.get("category", "other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(v["vibe_score"])
    cat_avg = {cat: round(sum(s) / len(s), 1) for cat, s in categories.items()}

    districts = {}
    for v in live_venues:
        d = v.get("district", "Unknown")
        if d not in districts:
            districts[d] = []
        districts[d].append(v["vibe_score"])
    district_avg = {d: round(sum(s) / len(s), 1) for d, s in districts.items()}

    waitlist_count = await db.waitlist.count_documents({})

    now = datetime.now(timezone.utc)
    return {
        "city": city,
        "report_week": now.strftime("Week of %b %d, %Y"),
        "generated_at": now.isoformat(),
        "summary": {
            "total_venues": len(live_venues),
            "avg_energy": avg,
            "active_scouts": random.randint(8, 25),
            "waitlist_signups": waitlist_count,
            "peak_night": random.choice(["Friday", "Saturday"]),
        },
        "energy_tiers": {
            "electric": len([s for s in scores if s >= 80]),
            "warming": len([s for s in scores if 60 <= s < 80]),
            "quiet": len([s for s in scores if s < 60])
        },
        "top_venues": [{"name": v["name"], "score": v["vibe_score"], "district": v.get("district"), "category": v.get("category")} for v in top5],
        "coldest_venues": [{"name": v["name"], "score": v["vibe_score"], "district": v.get("district")} for v in bottom3],
        "trending": [{"name": v["name"], "score": v["vibe_score"]} for v in trending],
        "category_breakdown": cat_avg,
        "district_breakdown": district_avg,
    }


# --- Setup ---

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    count = await db.venues.count_documents({})
    if count == 0:
        docs = []
        for v in SEED_VENUES:
            docs.append({
                "id": v["id"], "name": v["name"], "category": v["category"],
                "city": v["city"], "district": v["district"],
                "vibe_score": v["vibe_score"], "energy_state": v["energy_state"],
                "capacity_pct": v["capacity_pct"], "gate_status": v["gate_status"],
                "trending": v["trending"],
                "coordinates": {"lat": v["lat"], "lng": v["lng"]},
                "peak_hour": v["peak_hour"],
                "last_updated": datetime.now(timezone.utc).isoformat()
            })
        await db.venues.insert_many(docs)
        logger.info(f"Seeded {len(docs)} Lagos venues")


@app.on_event("shutdown")
async def shutdown():
    client.close()
