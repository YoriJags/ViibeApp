"""
Vibe App - Real-time Service
Socket.IO event handlers and broadcast functions.
Includes Kinetic Quest: aggregate BPM tracking + resonance reward per venue.
"""
import asyncio
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from app.config import sio, db, logger
from app.services.decay_ingest import ingest_pulse

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

# ─── Collective Surge Windows ─────────────────────────────────────────────────
# In-memory 5-second tap buckets per venue.
# Keyed by venue_id → { "taps": [(unix_ts, user_id)], "cooldown_until": datetime | None }
# Resets on server restart; never persisted — surge is a live ephemeral signal.

SURGE_WINDOW_SECONDS  = 5      # sliding bucket width
SURGE_SCOUT_MULTIPLIER = 5     # taps_per_second must exceed active_scouts × this
SURGE_COOLDOWN_SECONDS = 8     # minimum gap between consecutive surge events

def _fresh_surge_window():
    return {"taps": [], "cooldown_until": None}

_venue_surge_windows: dict = defaultdict(_fresh_surge_window)

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
    Kinetic tap event from VibeReactor / VibeCharge.
    data: {
        venue_id, user_id,
        intensity: 'soft'|'power',
        ui_increment,
        avg_g_force: float,       # average G-force across the 15s window
        max_bpm: int,
        tap_count: int,
        peak_count: int,
        stationary_peak_abuse: bool  # fraud signal: low G + claiming peak
    }

    Counts pulses per venue in a 5-min rolling window.
    On 1000 pulses → emit global_surge to venue room.
    Persists to vibe_pulses collection WITH kinetic fields — used by the
    Oracle (calculate_venue_aggregate) for momentum persistence scoring.
    """
    venue_id  = data.get("venue_id")
    user_id   = data.get("user_id")
    intensity = data.get("intensity", "soft")

    if not venue_id:
        return

    # Phase 2 — feed the Energy Decay Engine (L1 active layer). In-memory,
    # synchronous, fraud-aware; never touches vibe_score directly.
    ingest_pulse(
        venue_id=venue_id,
        scout_id=user_id,
        avg_g_force=data.get("avg_g_force", 1.0),
        stationary_peak_abuse=bool(data.get("stationary_peak_abuse", False)),
    )

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

    # ── Collective Surge check (5-second sliding window) ─────────────────────
    # Runs synchronously before persist so the surge fires on the same tick.
    if user_id:
        surge_window = _venue_surge_windows[venue_id]
        surge_cutoff = now_ts - SURGE_WINDOW_SECONDS

        # Prune stale taps from the window
        surge_window["taps"] = [(ts, uid) for ts, uid in surge_window["taps"] if ts > surge_cutoff]
        surge_window["taps"].append((now_ts, user_id))

        # Count unique active scouts and taps_per_second
        window_taps     = surge_window["taps"]
        active_scouts   = len({uid for _, uid in window_taps})
        taps_per_second = len(window_taps) / SURGE_WINDOW_SECONDS
        surge_threshold = active_scouts * SURGE_SCOUT_MULTIPLIER

        cooldown_until = surge_window.get("cooldown_until")
        surge_ready    = (not cooldown_until) or (now > cooldown_until)

        if taps_per_second > surge_threshold and active_scouts >= 2 and surge_ready:
            surge_window["cooldown_until"] = now + timedelta(seconds=SURGE_COOLDOWN_SECONDS)

            # surge_intensity: 0..1 ratio of how far above threshold we are (cap at 1)
            surge_intensity = min(1.0, round(
                (taps_per_second - surge_threshold) / max(surge_threshold, 1), 3
            ))
            contributing_scout_ids = list({uid for _, uid in window_taps})

            asyncio.ensure_future(_emit_venue_surge(
                venue_id=venue_id,
                surge_intensity=surge_intensity,
                contributing_scout_ids=contributing_scout_ids,
                taps_per_second=round(taps_per_second, 2),
                active_scouts=active_scouts,
            ))

    # Persist kinetic data asynchronously — read by Oracle for momentum scoring
    asyncio.ensure_future(_persist_vibe_pulse(
        venue_id=venue_id,
        user_id=user_id,
        intensity=intensity,
        ts=now,
        avg_g_force=data.get("avg_g_force", 1.0),
        max_bpm=data.get("max_bpm", 0),
        tap_variance=data.get("tap_variance"),
        tap_count=data.get("tap_count", 1),
        peak_count=data.get("peak_count", 0),
        stationary_peak_abuse=bool(data.get("stationary_peak_abuse", False)),
    ))


async def _persist_vibe_pulse(
    venue_id: str, user_id: str, intensity: str, ts: datetime,
    avg_g_force: float = 1.0, max_bpm: int = 0,
    tap_count: int = 1, peak_count: int = 0,
    stationary_peak_abuse: bool = False,
    tap_variance: float | None = None,
):
    """
    Persist vibe_pulse event with full kinetic fields.
    Read by calculate_venue_aggregate for momentum-persistence scoring.
    tap_variance (std dev of inter-tap intervals in seconds) is used by
    the VibeSignature classifier to detect HIGH_VELOCITY / STEADY_GROOVE /
    ATMOSPHERIC_CHILL tap patterns.
    Abusive pulses (stationary_peak_abuse) are stored but discounted by Oracle.
    """
    try:
        doc = {
            "venue_id":              venue_id,
            "user_id":               user_id,
            "intensity":             intensity,
            "avg_g_force":           avg_g_force,
            "max_bpm":               max_bpm,
            "tap_count":             tap_count,
            "peak_count":            peak_count,
            "stationary_peak_abuse": stationary_peak_abuse,
            "timestamp":             ts,
        }
        if tap_variance is not None:
            doc["tap_variance"] = tap_variance
        await db.vibe_pulses.insert_one(doc)
    except Exception as exc:
        logger.debug(f"vibe_pulse persist skipped: {exc}")


async def _emit_venue_surge(
    venue_id: str,
    surge_intensity: float,
    contributing_scout_ids: list,
    taps_per_second: float,
    active_scouts: int,
):
    """
    Collective Surge — emitted when scouts' collective tap rate exceeds the
    dynamic threshold (active_scouts × 5 taps/second).

    Payload delivered to all clients in the venue_{id} room:
      surge_intensity        0..1 (how far above threshold the surge is)
      contributing_scout_ids list of user_ids fueling the surge
      taps_per_second        raw tap rate at time of trigger
      active_scouts          unique scouts in the 5-second window
    """
    try:
        await sio.emit("venue_surge", {
            "venue_id":               venue_id,
            "surge_intensity":        surge_intensity,
            "contributing_scout_ids": contributing_scout_ids,
            "taps_per_second":        taps_per_second,
            "active_scouts":          active_scouts,
        }, room=f"venue_{venue_id}")
        logger.info(
            f"Collective surge at {venue_id} — "
            f"{active_scouts} scouts @ {taps_per_second:.1f} tps, "
            f"intensity {surge_intensity:.2f}"
        )
    except Exception as exc:
        logger.warning(f"venue_surge emit failed: {exc}")


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

        # First Spark / Pioneer — vindicate the night's pioneer if the venue heated up.
        from app.routes.pioneer import resolve_pioneers
        await resolve_pioneers(venue_id, score)
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
