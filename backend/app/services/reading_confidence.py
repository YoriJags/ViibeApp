"""
Reading confidence: how far a venue's energy reading can be trusted, 0 to 1.

Energy says what the room is like. Signal Density says how much was ever said
about it. Confidence says whether to believe the reading RIGHT NOW, and it is
the number the honest map renders by: solid when trusted, faded when not.

It is computed on read, never stored as a fact, because trust decays with the
clock. A reading five scouts agreed on is strong at 11pm and worth little by
1am if nobody has refreshed it. The evidence is stored on the venue when a
reading lands (services/vibe.calculate_venue_aggregate); this module turns
that evidence plus the current time into the score.

Four parts, multiplied, so one weak part cannot be bought back by another:

    corroboration  how many distinct real scouts stand behind the reading
    freshness      how long ago the newest reading landed
    agreement      whether those scouts said the same thing
    presence       whether the decay engine still sees people in the room

Then the gates from PLAN.md Phase 3, which cap the score outright:

    single_scout           one voice is a claim, not a reading  -> below 0.5
    taps_without_presence  hot taps while presence collapses    -> below 0.5
    presence_lost          heartbeats stopped                   -> below 0.5
    stale                  newest reading older than 90 minutes -> below 0.5

A reading is "solid" on the map only at 0.5 or above, so any failed gate means
it draws faded. Pure functions, no I/O.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.services.energy_decay import EnergyReading
from app.services.synthetic import SOURCE_DEMO, SOURCE_SCOUTS

# The map draws a reading solid at or above this, faded below it.
SOLID_AT = 0.5
# A failed gate holds the score just under the solid line.
GATED_CAP = 0.49

# Distinct real scouts behind the reading. One scout is a claim; five is a room.
CORROBORATION = {0: 0.0, 1: 0.4, 2: 0.65, 3: 0.8, 4: 0.9}
CORROBORATION_FULL = 1.0  # five or more

# Freshness, in minutes since the newest reading. Full for a quarter of an
# hour, fading to 0.4 at ninety minutes (where the app stops showing a reading
# as current) and to nothing at three hours (where docs/ENERGY.md says a
# reading's weight reaches zero).
FRESH_FULL_MIN = 15.0
STALE_MIN = 90.0
EXPIRED_MIN = 180.0
FRESHNESS_AT_STALE = 0.4

# Presence, from the decay engine. Unknown is the usual case (the engine holds
# state in memory and most scouts do not run auto check-in), so it costs a
# little and fails nothing. Seen and then lost is the meaningful signal.
PRESENCE_CONFIRMED = 1.0
PRESENCE_UNKNOWN = 0.85
PRESENCE_LOST = 0.6
PRESENCE_CONTRADICTED = 0.5
L2_ALIVE = 0.3


def _as_utc(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def corroboration_factor(scouts: int) -> float:
    if scouts >= 5:
        return CORROBORATION_FULL
    return CORROBORATION.get(max(0, scouts), 0.0)


def freshness_factor(age_minutes: float) -> float:
    if age_minutes <= FRESH_FULL_MIN:
        return 1.0
    if age_minutes >= EXPIRED_MIN:
        return 0.0
    if age_minutes <= STALE_MIN:
        span = (age_minutes - FRESH_FULL_MIN) / (STALE_MIN - FRESH_FULL_MIN)
        return 1.0 - span * (1.0 - FRESHNESS_AT_STALE)
    span = (age_minutes - STALE_MIN) / (EXPIRED_MIN - STALE_MIN)
    return FRESHNESS_AT_STALE * (1.0 - span)


def agreement_factor(consensus_count: int, consensus_rate: float) -> float:
    """Two or more scouts in the consensus window: full only if they agree."""
    if consensus_count < 2:
        return 1.0  # nothing to disagree with; corroboration already paid for it
    rate = max(0.0, min(1.0, consensus_rate or 0.0))
    return 0.7 + 0.3 * rate


def presence_factor(presence: Optional[EnergyReading]) -> tuple[float, Optional[str]]:
    """(factor, failed gate or None) from the decay engine's view of the room."""
    if presence is None:
        return PRESENCE_UNKNOWN, None
    if "G1" in presence.gates_failed:
        return PRESENCE_CONTRADICTED, "taps_without_presence"
    if "G3" in presence.gates_failed:
        return PRESENCE_LOST, "presence_lost"
    if presence.layer_breakdown.get("L2", 0.0) >= L2_ALIVE:
        return PRESENCE_CONFIRMED, None
    return PRESENCE_UNKNOWN, None


def band(confidence: Optional[float]) -> str:
    """The existing low / medium / high words, now derived from the score."""
    if confidence is None or confidence < SOLID_AT:
        return "low"
    return "high" if confidence >= 0.75 else "medium"


def reading_confidence(venue: dict, now: datetime,
                       presence: Optional[EnergyReading] = None) -> dict:
    """
    Confidence in a venue's current reading.

    Returns {"confidence", "confidence_gates", "confidence_parts",
    "score_confidence"}. Confidence is None for a demo reading: a demo is not
    evidence, so it is neither trusted nor distrusted, and it is never served
    to machines at all.
    """
    source = venue.get("energy_source")
    if source == SOURCE_DEMO:
        return {"confidence": None, "confidence_gates": ["demo"],
                "confidence_parts": {}, "score_confidence": "low"}

    last = _as_utc(venue.get("last_rated_at"))
    # Older records predate energy_source; a real last_rated_at stands for scouts.
    if last is None or source not in (SOURCE_SCOUTS, None):
        return {"confidence": 0.0, "confidence_gates": ["no_reading"],
                "confidence_parts": {}, "score_confidence": "low"}

    now = _as_utc(now)
    age = max(0.0, (now - last).total_seconds() / 60.0)
    try:
        scouts = int(venue.get("active_scouts") or 0)
    except (TypeError, ValueError):
        scouts = 0
    try:
        consensus_count = int(venue.get("consensus_count") or 0)
    except (TypeError, ValueError):
        consensus_count = 0

    corroboration = corroboration_factor(scouts)
    freshness = freshness_factor(age)
    agreement = agreement_factor(consensus_count, venue.get("consensus_rate") or 0.0)
    present, presence_gate = presence_factor(presence)

    score = corroboration * freshness * agreement * present

    gates = []
    if freshness <= 0.0 or corroboration <= 0.0:
        gates.append("no_reading")
        score = 0.0
    else:
        if scouts < 2:
            gates.append("single_scout")
        if presence_gate:
            gates.append(presence_gate)
        if age > STALE_MIN:
            gates.append("stale")
        if gates:
            score = min(score, GATED_CAP)

    score = round(max(0.0, min(1.0, score)), 2)
    return {
        "confidence": score,
        "confidence_gates": gates,
        "confidence_parts": {
            "corroboration": round(corroboration, 2),
            "freshness": round(freshness, 2),
            "agreement": round(agreement, 2),
            "presence": round(present, 2),
            "scouts": scouts,
            "age_minutes": round(age, 1),
        },
        "score_confidence": band(score),
    }


def attach_confidence(venue: dict, now: Optional[datetime] = None) -> dict:
    """Stamp a venue payload with its confidence as of now. Mutates and returns it."""
    from app.services.decay_ingest import read_venue_energy

    now = now or datetime.now(timezone.utc)
    presence = read_venue_energy(venue["id"], now.timestamp()) if venue.get("id") else None
    venue.update(reading_confidence(venue, now, presence))
    return venue
