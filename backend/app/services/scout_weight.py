"""
Scout Weight: how much one reading moves a venue's Energy.

This replaces the old standard, which had a serious flaw at its centre.

The previous weighting (see `scout_integrity.py`) was 50% track record, 30%
consensus accuracy, 20% fraud penalty. Two problems:

  1. Half the weight was VOLUME. Rating often made you trusted. That measures
     attendance, not accuracy.

  2. The consensus factor scored a scout on landing within 15 points of their
     peers in the same half hour. So a scout who correctly called a room turning
     before anyone else was penalised as an outlier, while a scout who simply
     echoed the crowd scored perfectly while adding no information at all.
     The weighting was rewarding herding, and herding is what makes a live
     signal slow. Slow is the one thing this product cannot be.

The new standard asks a different question. Not "how much has this scout done"
and not "does this scout agree", but **how much does this reading tell us that
we did not already know, and how sure are we the person was really there**.

Five factors. Two work from day one with no history at all. Three need weeks of
real readings before they mean anything, so they sit behind a flag rather than
generating confident noise on an empty database.

    LIVE NOW
      1. Marginal information   How much uncertainty this reading removes
      2. Presence quality       How sure we are they were actually in the room

    NEEDS HISTORY (SCOUT_WEIGHT_CALIBRATION=1)
      3. Calibration            Were they right about the room, judged by what
                                the room then did, not by what peers said
      4. Contrarian credit      Being right while disagreeing is worth more
      5. Discrimination         A scout whose readings never vary is a constant,
                                and a constant carries no information

Every factor returns a bounded multiplier and the composition is multiplicative
with a hard floor and ceiling, so no single factor can dominate or zero out a
reading. `compute_reading_weight` returns the breakdown alongside the number,
because a weighting nobody can audit is indistinguishable from one that is
rigged, and "you cannot buy the number" only means something if we can show why.
"""
import os
from statistics import pstdev

# ── Bounds ────────────────────────────────────────────────────────────────────
# A reading never counts for nothing (every voice counts a little) and never
# counts for more than roughly two ordinary readings.
WEIGHT_FLOOR = 0.15
WEIGHT_CEILING = 2.0

CALIBRATION_ENABLED = os.environ.get("SCOUT_WEIGHT_CALIBRATION", "0") == "1"


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ── 1. Marginal information ───────────────────────────────────────────────────
# The value of a reading is how much uncertainty it removes. The error on an
# average falls roughly as 1/sqrt(n), so the tenth reading of the night at a
# venue is worth far less than the first. This is the factor that makes the
# empty corners of the map the most rewarding place for a scout to be, which is
# exactly where we need them and exactly where nobody goes today.
MARGIN_MAX = 1.60   # a venue nobody has read tonight
MARGIN_MIN = 0.55   # a venue already saturated
MARGIN_HALF_LIFE = 12.0


def marginal_information_factor(existing_readings: int) -> float:
    """
    Weight by how little is already known about this venue tonight.

        0 readings   1.60   the first honest read of the night
        5 readings   1.29
        12 readings  1.08
        40 readings  0.79
        100 readings 0.66

    Ties directly to Signal Density: as density rises, marginal value falls.
    """
    try:
        n = max(0, int(existing_readings or 0))
    except (TypeError, ValueError):
        n = 0
    decay = n / (n + MARGIN_HALF_LIFE)
    return round(MARGIN_MAX - (MARGIN_MAX - MARGIN_MIN) * decay, 4)


# ── 2. Presence quality ───────────────────────────────────────────────────────
# Energy can only be read from inside the room, so how confident we are that
# someone was inside, and for how long, is a real part of how much their reading
# is worth. This needs no new user action, which is the whole point of moving
# away from the tap: the phone already knows.

def dwell_factor(dwell_minutes: float | None) -> float:
    """
    Someone ninety minutes into a room knows it. Someone three minutes in the
    door has seen the queue and the coat check.

        unknown   0.85   not penalised to nothing, we simply do not know
        0 min     0.70
        15 min    1.00
        45 min    1.12
        90+ min   1.15
    """
    if dwell_minutes is None:
        return 0.85
    try:
        m = max(0.0, float(dwell_minutes))
    except (TypeError, ValueError):
        return 0.85
    if m >= 90:
        return 1.15
    if m >= 15:
        # 15 min -> 1.00, 90 min -> 1.15
        return round(1.00 + (m - 15) * (0.15 / 75), 4)
    # 0 min -> 0.70, 15 min -> 1.00
    return round(0.70 + m * (0.30 / 15), 4)


def proximity_factor(distance_m: float | None, geofence_radius_m: float) -> float:
    """
    Standing in the middle of the room is better evidence than standing at the
    edge of the geofence, which could be the car park or the building next door.

        unknown            0.85
        centre             1.10
        half the radius    1.00
        at the boundary    0.80
        outside            0.60
    """
    if distance_m is None or not geofence_radius_m:
        return 0.85
    try:
        d = max(0.0, float(distance_m))
        r = float(geofence_radius_m)
    except (TypeError, ValueError):
        return 0.85
    if r <= 0:
        return 0.85
    ratio = d / r
    if ratio > 1.0:
        return 0.60
    # ratio 0 -> 1.10, ratio 1 -> 0.80
    return round(1.10 - 0.30 * ratio, 4)


def presence_factor(dwell_minutes: float | None,
                    distance_m: float | None,
                    geofence_radius_m: float) -> float:
    """Combined presence confidence, bounded so it corroborates rather than decides."""
    combined = dwell_factor(dwell_minutes) * proximity_factor(distance_m, geofence_radius_m)
    return round(_clamp(combined, 0.50, 1.25), 4)


# ── 3. Calibration (needs history) ────────────────────────────────────────────

def calibration_factor(graded: list[tuple[float, float]]) -> float:
    """
    Grade a scout on whether they were RIGHT, judged by what the venue actually
    settled to afterwards. Not by whether they agreed with anyone.

    `graded` is a list of (reading_score, outcome_score) pairs, where outcome is
    what the venue read 30 to 60 minutes later from independent readings.

        no history      1.00   neutral, never a flattering default
        avg error 0     1.40
        avg error 15    1.10
        avg error 30    0.80
        avg error 50+   0.60
    """
    if not graded:
        return 1.00
    errors = [abs(float(r) - float(o)) for r, o in graded]
    avg_error = sum(errors) / len(errors)
    factor = 1.40 - (avg_error / 50.0) * 0.80
    return round(_clamp(factor, 0.60, 1.40), 4)


def contrarian_credit(reading_score: float,
                      consensus_at_time: float | None,
                      outcome_score: float) -> float:
    """
    The factor that makes the map fast.

    Agreeing with a settled consensus and being right adds almost nothing: we
    already knew. Disagreeing with the consensus and being right is the most
    valuable event in the system, because that scout moved the map before
    anybody else could.

    Returns a credit multiplier for a single graded reading:
        right and far from consensus   up to 2.0
        right and with consensus       about 1.0
        wrong                          below 1.0, and worse the louder the call

    Deliberately multiplied by correctness, so spamming contrarian readings
    costs rather than pays. Conviction without accuracy is just noise.
    """
    error = abs(float(reading_score) - float(outcome_score))
    correctness = _clamp(1.0 - (error / 50.0), 0.0, 1.0)

    if consensus_at_time is None:
        departure = 0.0
    else:
        departure = _clamp(abs(float(reading_score) - float(consensus_at_time)) / 50.0, 0.0, 1.0)

    # Right: pays more the further out on a limb they were.
    # Wrong: costs more the further out on a limb they were.
    if correctness >= 0.5:
        return round(1.0 + departure * (correctness - 0.5) * 2.0, 4)
    return round(1.0 - departure * (0.5 - correctness), 4)


def discrimination_factor(recent_scores: list[float]) -> float:
    """
    A scout who rates everything 85 carries no information, however often that
    happens to look correct. Weight by the spread of their own readings.

    Quietly the most important of the five, because the only way to look
    discriminating is to actually discriminate: to report dead rooms as dead.
    That is the exact behaviour social pressure suppresses and the product
    depends on.

        under 5 readings   1.00   not enough to judge
        spread 0           0.60   a constant
        spread 10          0.88
        spread 20+         1.15
    """
    scores = [float(s) for s in (recent_scores or []) if s is not None]
    if len(scores) < 5:
        return 1.00
    spread = pstdev(scores)
    if spread >= 20:
        return 1.15
    return round(0.60 + (spread / 20.0) * 0.55, 4)


# ── Composition ───────────────────────────────────────────────────────────────

def compose(marginal: float,
            presence: float,
            integrity: float,
            calibration: float = 1.0,
            discrimination: float = 1.0) -> float:
    """Multiply the factors and clamp. No single factor can zero a reading out."""
    raw = marginal * presence * integrity * calibration * discrimination
    return round(_clamp(raw, WEIGHT_FLOOR, WEIGHT_CEILING), 4)


async def compute_reading_weight(user_id: str,
                                 venue: dict,
                                 dwell_minutes: float | None = None,
                                 distance_m: float | None = None,
                                 staked: bool = False) -> dict:
    """
    The weight this reading carries, with the reasoning attached.

    Returns {"weight": float, "factors": {...}} so the number is always
    auditable. Falls back to a neutral, never flattering, weight on any error:
    a reading we cannot justify should count a little, not a lot.
    """
    from app.config import GEOFENCE_RADIUS_METERS
    from app.services.scout_integrity import get_sis_weight

    factors: dict = {}

    existing = venue.get("total_ratings_24h", 0)
    radius = venue.get("geofence_radius_m") or GEOFENCE_RADIUS_METERS
    factors["marginal_information"] = marginal_information_factor(existing)
    factors["presence"] = presence_factor(dwell_minutes, distance_m, radius)

    # Integrity still comes from SIS, which carries the fraud penalty and track
    # record. Its consensus-accuracy component is the herding factor described
    # at the top of this file and is being replaced by calibration below.
    try:
        factors["integrity"] = float(await get_sis_weight(user_id))
    except Exception:
        factors["integrity"] = 0.5

    factors["calibration"] = 1.0
    factors["discrimination"] = 1.0

    # The Call. Bounded, and the scout is risking clout on it either way.
    from app.services.stake import stake_multiplier
    factors["stake"] = stake_multiplier(bool(staked))

    if CALIBRATION_ENABLED:
        try:
            graded, recent = await _load_history(user_id)
            factors["calibration"] = calibration_factor(graded)
            factors["discrimination"] = discrimination_factor(recent)
        except Exception:
            pass  # neutral factors already set

    weight = compose(
        factors["marginal_information"],
        factors["presence"],
        factors["integrity"],
        factors["calibration"],
        factors["discrimination"] * factors["stake"],
    )
    return {"weight": weight, "factors": factors}


async def _load_history(user_id: str, limit: int = 50):
    """
    Pull a scout's recent readings and grade each against what the venue
    actually read 30 to 60 minutes later, from OTHER people's readings.

    Returns (graded_pairs, recent_scores).
    """
    from datetime import timedelta
    from app.config import db

    rows = await db.ratings.find(
        {"user_id": user_id, "vibe_score": {"$exists": True}, "provisional": {"$ne": True}},
        {"venue_id": 1, "vibe_score": 1, "timestamp": 1},
    ).sort("timestamp", -1).to_list(limit)

    graded: list[tuple[float, float]] = []
    recent: list[float] = []

    for row in rows:
        score = row.get("vibe_score")
        if score is None:
            continue
        recent.append(float(score))

        ts = row.get("timestamp")
        venue_id = row.get("venue_id")
        if not venue_id or ts is None:
            continue

        # What the room turned out to be, from independent readings AFTER this one.
        after = await db.ratings.find(
            {
                "venue_id": venue_id,
                "user_id": {"$ne": user_id},
                "timestamp": {"$gte": ts + timedelta(minutes=30),
                              "$lte": ts + timedelta(minutes=60)},
                "vibe_score": {"$exists": True},
                "provisional": {"$ne": True},
            },
            {"vibe_score": 1},
        ).to_list(20)

        outcomes = [r["vibe_score"] for r in after if r.get("vibe_score") is not None]
        if outcomes:
            graded.append((float(score), sum(outcomes) / len(outcomes)))

    return graded, recent
