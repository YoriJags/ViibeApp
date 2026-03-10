"""
Vibe App - Real-time Service
Socket.IO event handlers and broadcast functions.
Includes Kinetic Quest: aggregate BPM tracking + resonance reward per venue.
"""
import asyncio
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from app.config import sio, db, logger

connected_clients = set()

# ─── Kinetic Quest State ───────────────────────────────────────────────────────
# Keyed by venue_id. Fully in-memory; resets on server restart.

def _fresh_venue_kinetics():
    return {
        "taps": [],            # list of (unix_ts_float, user_id, intensity)
        "participants": set(), # user_ids who tapped in current window
        "quest_state": "idle", # idle | cooldown
        "cooldown_until": None,
    }

_venue_kinetics: dict = defaultdict(_fresh_venue_kinetics)

# ─── Vibe Pulse Shadow State ──────────────────────────────────────────────────
# Visual tap shadow-log: tracked per-venue in a 5-min rolling window.
# Persisted to vibe_pulses collection (never touches vibe_score).

def _fresh_pulse_state():
    return {
        "pulses": [],              # (unix_ts_float, user_id, intensity)
        "surge_cooldown_until": None,
    }

_venue_pulses: dict = defaultdict(_fresh_pulse_state)

PULSE_WINDOW_SECONDS = 300       # 5-min rolling window
GLOBAL_SURGE_THRESHOLD = 1000    # pulses in window → global_surge
GLOBAL_SURGE_COOLDOWN_MIN = 10   # minutes between global_surge events
ENERGY_CRITICAL_THRESHOLD = 40   # vibe_score below this → energy_critical

RESONANCE_BPM_MIN = 123
RESONANCE_BPM_MAX = 133
RESONANCE_MIN_SCOUTS = 3    # at least 3 unique scouts required
CHARGE_LOW_SCORE = 80        # below this → emit global_charge_depletion
QUEST_COOLDOWN_MINUTES = 30
QUEST_FLAT_BONUS_CLOUT = 30 # clout per scout on quest success
TAP_WINDOW_SECONDS = 30      # rolling window for aggregate BPM


def _calc_bpm(timestamps: list) -> float:
    """BPM from a list of unix float timestamps. Uses last 8 within window."""
    if len(timestamps) < 2:
        return 0.0
    recent = sorted(timestamps)[-8:]
    if len(recent) < 2:
        return 0.0
    duration = recent[-1] - recent[0]
    if duration <= 0:
        return 0.0
    return min((len(recent) - 1) / duration * 60, 300.0)


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


@sio.event
async def tap_velocity(sid, data):
    """
    Kinetic Tap — receives a scout's tap event.
    data: { venue_id, user_id, bpm, intensity, g_force }

    Aggregates all scout taps for the venue, calculates collective BPM,
    detects resonance (128 BPM ±5, ≥3 scouts), and fires quest_succeeded.
    """
    venue_id = data.get("venue_id")
    user_id = data.get("user_id")
    intensity = data.get("intensity", "chill")

    if not venue_id or not user_id:
        return

    state = _venue_kinetics[venue_id]
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()

    # Check cooldown
    if state["quest_state"] == "cooldown" and state["cooldown_until"]:
        if now < state["cooldown_until"]:
            # Quest cooling down — still broadcast kinetics but skip resonance check
            pass
        else:
            state["quest_state"] = "idle"
            state["participants"] = set()

    # Prune stale taps
    cutoff_ts = now_ts - TAP_WINDOW_SECONDS
    state["taps"] = [(ts, uid, i) for ts, uid, i in state["taps"] if ts > cutoff_ts]

    # Record this tap
    state["taps"].append((now_ts, user_id, intensity))
    state["participants"].add(user_id)

    # Calculate aggregate BPM and unique scouts
    tap_times = [ts for ts, _, _ in state["taps"]]
    aggregate_bpm = _calc_bpm(tap_times)
    unique_scouts = len({uid for _, uid, _ in state["taps"]})

    # ── Resonance check ───────────────────────────────────────────────────────
    if (
        state["quest_state"] == "idle"
        and RESONANCE_BPM_MIN <= aggregate_bpm <= RESONANCE_BPM_MAX
        and unique_scouts >= RESONANCE_MIN_SCOUTS
    ):
        state["quest_state"] = "cooldown"
        state["cooldown_until"] = now + timedelta(minutes=QUEST_COOLDOWN_MINUTES)
        participants = list(state["participants"])

        # Award clout in background — don't block the socket response
        asyncio.ensure_future(_award_quest_clout(venue_id, participants))

        await sio.emit("quest_succeeded", {
            "venue_id": venue_id,
            "aggregate_bpm": round(aggregate_bpm),
            "participants": len(participants),
            "reward": f"{QUEST_FLAT_BONUS_CLOUT} clout each — 3× multiplier active",
        }, room=f"venue_{venue_id}")

        logger.info(
            f"Collective Quest succeeded at {venue_id} — "
            f"{len(participants)} scouts @ {round(aggregate_bpm)} BPM"
        )

    # Broadcast current kinetics to all venue watchers
    await sio.emit("kinetics_update", {
        "venue_id": venue_id,
        "aggregate_bpm": round(aggregate_bpm),
        "unique_scouts": unique_scouts,
        "resonance_target": 128,
        "resonance_min": RESONANCE_BPM_MIN,
        "resonance_max": RESONANCE_BPM_MAX,
        "quest_state": state["quest_state"],
    }, room=f"venue_{venue_id}")


async def _award_quest_clout(venue_id: str, participant_ids: list):
    """Award flat clout bonus to each participating scout."""
    for user_id in participant_ids:
        try:
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"clout_points": QUEST_FLAT_BONUS_CLOUT}},
            )
        except Exception as exc:
            logger.warning(f"Quest clout award failed for {user_id}: {exc}")
    logger.info(
        f"Quest clout awarded at {venue_id} — "
        f"{len(participant_ids)} scouts +{QUEST_FLAT_BONUS_CLOUT} clout each"
    )


@sio.event
async def vibe_pulse(sid, data):
    """
    Shadow tap event from VibeCharge screen (SurgeFullScreen).
    data: { venue_id, user_id, intensity: 'soft'|'power', ui_increment }

    Counts pulses per venue in a 5-min rolling window.
    On 1000 pulses → emit global_surge to venue room.
    Persists to vibe_pulses collection (never touches vibe_score).
    """
    venue_id = data.get("venue_id")
    user_id  = data.get("user_id")
    intensity = data.get("intensity", "soft")

    if not venue_id:
        return

    pulse_state = _venue_pulses[venue_id]
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()
    cutoff = now_ts - PULSE_WINDOW_SECONDS

    # Prune old pulses
    pulse_state["pulses"] = [(ts, uid, i) for ts, uid, i in pulse_state["pulses"] if ts > cutoff]
    pulse_state["pulses"].append((now_ts, user_id, intensity))
    pulse_count = len(pulse_state["pulses"])

    # Check global surge
    cooldown_until = pulse_state["surge_cooldown_until"]
    if pulse_count >= GLOBAL_SURGE_THRESHOLD and (not cooldown_until or now > cooldown_until):
        pulse_state["surge_cooldown_until"] = now + timedelta(minutes=GLOBAL_SURGE_COOLDOWN_MIN)
        pulse_state["pulses"] = []  # reset window after surge

        await sio.emit("global_surge", {
            "venue_id": venue_id,
            "pulse_count": pulse_count,
            "message": "1,000 taps hit — venue is ELECTRIC",
        }, room=f"venue_{venue_id}")
        logger.info(f"Global Surge at {venue_id} — {pulse_count} pulses in 5 min")

    # Persist shadow log asynchronously (fire-and-forget)
    asyncio.ensure_future(_persist_vibe_pulse(venue_id, user_id, intensity, now))


async def _persist_vibe_pulse(venue_id: str, user_id: str, intensity: str, ts: datetime):
    """Write one vibe_pulse shadow-log doc — never read for scoring."""
    try:
        await db.vibe_pulses.insert_one({
            "venue_id": venue_id,
            "user_id": user_id,
            "intensity": intensity,
            "timestamp": ts,
        })
    except Exception as exc:
        logger.debug(f"vibe_pulse persist skipped: {exc}")


# ===== Broadcast Functions =====

async def broadcast_venue_update(venue_id: str):
    """Broadcast venue update to all subscribed clients.
    Also emits global_charge_depletion if vibe score falls below threshold.
    """
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if venue:
        await sio.emit("venue_update", venue, room=f"venue_{venue_id}")
        await sio.emit("venue_update", venue, room=f"city_{venue.get('city', 'lagos')}")

        # Score-based alerts
        score = venue.get("current_vibe_score", 100)
        if score < CHARGE_LOW_SCORE:
            await sio.emit("global_charge_depletion", {
                "venue_id": venue_id,
                "current_score": score,
                "threshold": CHARGE_LOW_SCORE,
                "message": "Energy dropping — keep it alive!",
            }, room=f"venue_{venue_id}")

        # Energy critical: very low score → 5× clout incentive blast
        if score < ENERGY_CRITICAL_THRESHOLD:
            await sio.emit("energy_critical", {
                "venue_id": venue_id,
                "current_score": score,
                "message": f"ENERGY CRITICAL — 5× CLOUT FOR NEXT 30 TAPS at {venue.get('name', 'this venue')}",
            }, room=f"venue_{venue_id}")


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


async def broadcast_city_pulse(city: str):
    """Broadcast updated city heartbeat to all city subscribers."""
    from app.routes.city_pulse import compute_city_pulse
    pulse = await compute_city_pulse(city)
    await sio.emit("city_pulse_update", pulse, room=f"city_{city}")


@sio.event
async def join_crew_room(sid, data):
    """Join a crew's real-time room for vote updates."""
    crew_id = data.get("crew_id")
    if crew_id:
        await sio.enter_room(sid, f"crew_{crew_id}")
