"""
Vibe App - Real-time Service
Socket.IO event handlers and broadcast functions.
"""
from app.config import sio, db, logger

connected_clients = set()


# ===== Socket.IO Event Handlers =====

@sio.event
async def connect(sid, environ):
    connected_clients.add(sid)
    logger.info(f"Client connected: {sid}, Total: {len(connected_clients)}")
    await sio.emit(
        "connection_status",
        {"status": "connected", "total_connections": len(connected_clients)},
        to=sid,
    )


@sio.event
async def disconnect(sid):
    connected_clients.discard(sid)
    logger.info(f"Client disconnected: {sid}, Total: {len(connected_clients)}")


@sio.event
async def join_venue(sid, data):
    venue_id = data.get("venue_id")
    if venue_id:
        await sio.enter_room(sid, f"venue_{venue_id}")


@sio.event
async def join_city(sid, data):
    city = data.get("city", "lagos")
    await sio.enter_room(sid, f"city_{city}")


@sio.event
async def subscribe_leaderboard(sid, data=None):
    city = data.get("city", "all") if data else "all"
    await sio.enter_room(sid, f"leaderboard_{city}")


# ===== Broadcast Functions =====

async def broadcast_venue_update(venue_id: str):
    """Broadcast venue update to all subscribed clients."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if venue:
        await sio.emit("venue_update", venue, room=f"venue_{venue_id}")
        await sio.emit("venue_update", venue, room=f"city_{venue.get('city', 'lagos')}")


async def broadcast_leaderboard(city: str = "all"):
    """Broadcast leaderboard update to all subscribed clients."""
    query = {} if city == "all" else {"city": city}
    venues = await db.venues.find(query, {"_id": 0}).sort("current_vibe_score", -1).to_list(50)

    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": v.get("vibe_velocity", "stable"),
        })

    await sio.emit("leaderboard_update", leaderboard, room=f"leaderboard_{city}")


async def emit_checkin_update(venue_id: str, active_count: int):
    """Broadcast check-in count update to venue subscribers."""
    await sio.emit(
        "venue_checkin_update",
        {"venue_id": venue_id, "active_count": active_count},
        room=f"venue_{venue_id}",
    )


async def emit_crew_vote_update(crew_id: str, vote_data: dict):
    """Broadcast crew vote update to crew room."""
    await sio.emit(
        "crew_vote_update",
        vote_data,
        room=f"crew_{crew_id}",
    )


async def emit_crew_checkin(crew_id: str, member_name: str, venue_name: str):
    """Broadcast crew member check-in to crew room."""
    await sio.emit(
        "crew_checkin",
        {"member": member_name, "venue": venue_name},
        room=f"crew_{crew_id}",
    )


async def emit_campaign_update(city: str, campaign_data: dict):
    """Broadcast campaign update to city subscribers."""
    await sio.emit(
        "campaign_update",
        campaign_data,
        room=f"city_{city}",
    )


async def broadcast_reaction(venue_id: str, data: dict):
    """Broadcast a live bolt reaction to all clients watching a venue."""
    await sio.emit("reaction_pulse", data, room=f"venue_{venue_id}")


@sio.event
async def join_crew_room(sid, data):
    """Join a crew's real-time room for vote updates."""
    crew_id = data.get("crew_id")
    if crew_id:
        await sio.enter_room(sid, f"crew_{crew_id}")
