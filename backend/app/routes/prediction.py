"""
Prediction Market — orchestration + endpoints.

Wires the pari-mutuel core (services/prediction.py) to Mongo + clout balances.
  POST /api/predictions/stake            — stake clout on tonight's peak venue
  GET  /api/predictions/market/{city}    — live pool, per-venue odds, your call
  POST /api/predictions/resolve/{city}   — settle the night (super admin)

One prediction per scout per market (city + night, noon→noon). Staking debits
clout atomically; resolution credits winners from the pari-mutuel pool.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional

from app.config import db, logger
from app.services.auth import require_auth, get_current_user
from app.services.prediction import (
    Prediction,
    validate_stake,
    compute_payouts,
    implied_odds,
    MIN_STAKE,
    MAX_STAKE,
)

router = APIRouter(tags=["prediction"])

PREDICTIONS = "predictions"
MARKETS = "prediction_markets"


def _night_key(now: datetime) -> str:
    anchor = now if now.hour >= 12 else now - timedelta(days=1)
    return anchor.strftime("%Y-%m-%d")


def _market_id(city: str, now: datetime) -> str:
    return f"{city.lower()}:{_night_key(now)}"


async def _load_predictions(market: str):
    docs = await db[PREDICTIONS].find({"market": market}, {"_id": 0}).to_list(5000)
    return docs


class StakeRequest(BaseModel):
    city:     str
    venue_id: str
    stake:    int = Field(ge=1)


@router.post("/predictions/stake")
async def stake_prediction(body: StakeRequest, user: dict = Depends(require_auth)):
    now = datetime.now(timezone.utc)
    market = _market_id(body.city, now)

    mkt = await db[MARKETS].find_one({"market": market})
    if mkt and mkt.get("status") == "resolved":
        raise HTTPException(status_code=409, detail="Tonight's market is already settled.")

    existing = await db[PREDICTIONS].find_one({"market": market, "scout_id": user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="You've already called it tonight.")

    balance = int(user.get("clout_points", 0))
    check = validate_stake(body.stake, balance)
    if not check.ok:
        raise HTTPException(status_code=400, detail=check.reason)

    venue = await db.venues.find_one({"id": body.venue_id}, {"_id": 0, "name": 1, "city": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Atomic debit — only succeeds if the scout still has the clout.
    res = await db.users.update_one(
        {"id": user["id"], "clout_points": {"$gte": body.stake}},
        {"$inc": {"clout_points": -body.stake}},
    )
    if res.modified_count != 1:
        raise HTTPException(status_code=400, detail="insufficient clout")

    await db[PREDICTIONS].insert_one({
        "market":     market,
        "city":       body.city.lower(),
        "night":      _night_key(now),
        "scout_id":   user["id"],
        "venue_id":   body.venue_id,
        "venue_name": venue.get("name", ""),
        "stake":      body.stake,
        "status":     "open",
        "payout":     0,
        "created_at": now,
    })
    await db[MARKETS].update_one(
        {"market": market},
        {"$setOnInsert": {"city": body.city.lower(), "night": _night_key(now), "status": "open"}},
        upsert=True,
    )
    logger.info(f"Prediction staked: {user['id']} {body.stake} on {body.venue_id} ({market})")
    return {"ok": True, "market": market, "staked": body.stake, "venue_id": body.venue_id}


@router.get("/predictions/market/{city}")
async def get_market(city: str, authorization: str = Header(default="")):
    now = datetime.now(timezone.utc)
    market = _market_id(city, now)
    docs = await _load_predictions(market)
    preds = [Prediction(d["scout_id"], d["venue_id"], d["stake"]) for d in docs]
    total_pool = sum(p.stake for p in preds)

    # Per-venue book: stake + implied odds + name
    book: dict = {}
    for d in docs:
        v = d["venue_id"]
        b = book.setdefault(v, {"venue_id": v, "venue_name": d.get("venue_name", ""), "staked": 0, "backers": 0})
        b["staked"] += d["stake"]
        b["backers"] += 1
    for v, b in book.items():
        b["odds"] = implied_odds(preds, v)
    venues_book = sorted(book.values(), key=lambda b: b["staked"], reverse=True)

    mkt = await db[MARKETS].find_one({"market": market}, {"_id": 0})

    # Caller's own prediction, if authenticated
    your_pick = None
    if authorization.startswith("Bearer "):
        u = await db.users.find_one({"token": authorization.split(" ")[1]}, {"id": 1})
        if u:
            mine = await db[PREDICTIONS].find_one({"market": market, "scout_id": u["id"]}, {"_id": 0})
            your_pick = mine

    return {
        "market":     market,
        "city":       city.lower(),
        "status":     (mkt or {}).get("status", "open"),
        "total_pool": total_pool,
        "venues":     venues_book,
        "your_pick":  your_pick,
        "min_stake":  MIN_STAKE,
        "max_stake":  MAX_STAKE,
    }


@router.post("/predictions/resolve/{city}")
async def resolve_market(city: str, request_user=Depends(get_current_user)):
    if not request_user or not request_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required.")

    now = datetime.now(timezone.utc)
    market = _market_id(city, now)
    mkt = await db[MARKETS].find_one({"market": market})
    if not mkt:
        raise HTTPException(status_code=404, detail="No market for tonight.")
    if mkt.get("status") == "resolved":
        raise HTTPException(status_code=409, detail="Already resolved.")

    docs = await _load_predictions(market)
    if not docs:
        await db[MARKETS].update_one({"market": market}, {"$set": {"status": "resolved", "winning_venue_id": None, "resolved_at": now}})
        return {"market": market, "winning_venue_id": None, "paid": 0, "winners": 0}

    # Winning venue = highest current energy in the city right now (peak of the night).
    staked_venue_ids = list({d["venue_id"] for d in docs})
    venues = await db.venues.find(
        {"id": {"$in": staked_venue_ids}}, {"_id": 0, "id": 1, "current_vibe_score": 1}
    ).to_list(500)
    if not venues:
        winning_venue_id = None
    else:
        winning_venue_id = max(venues, key=lambda v: v.get("current_vibe_score", 0))["id"]

    preds = [Prediction(d["scout_id"], d["venue_id"], d["stake"]) for d in docs]
    payouts = compute_payouts(preds, winning_venue_id) if winning_venue_id else {
        d["scout_id"]: d["stake"] for d in docs  # no venue data → refund
    }

    total_paid = 0
    for scout_id, payout in payouts.items():
        if payout > 0:
            await db.users.update_one({"id": scout_id}, {"$inc": {"clout_points": payout}})
            total_paid += payout

    # Mark each prediction won/lost/refunded
    for d in docs:
        won = d["venue_id"] == winning_venue_id
        await db[PREDICTIONS].update_one(
            {"market": market, "scout_id": d["scout_id"]},
            {"$set": {
                "status": "won" if won else "lost",
                "payout": payouts.get(d["scout_id"], 0) if won else 0,
                "resolved_at": now,
            }},
        )

    await db[MARKETS].update_one(
        {"market": market},
        {"$set": {"status": "resolved", "winning_venue_id": winning_venue_id, "resolved_at": now, "total_paid": total_paid}},
    )
    logger.info(f"Market resolved {market}: winner={winning_venue_id} paid={total_paid} to {len(payouts)} scouts")
    return {
        "market": market,
        "winning_venue_id": winning_venue_id,
        "paid": total_paid,
        "winners": sum(1 for d in docs if d["venue_id"] == winning_venue_id),
    }
