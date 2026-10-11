"""
Synthetic readings: the one place that decides what is real.

The ambient demo engine (DEMO_AMBIENT=1) seeds readings from demo-scout-*
accounts so the map is not empty during cold start. That is a legitimate demo
tool. What it must never do is pass for evidence, because the entire product
is the claim "we would rather show you nothing than lie to you".

Audit of what was going wrong before this module existed:

  - Real and demo readings were BLENDED into one score. "Organic wins" only
    stopped future seeding; demo readings already in the window stayed in the
    average after a real scout rated.
  - Demo readings counted towards total_ratings_24h, so they inflated Signal
    Density (the evidence scale) and could earn VIIBE CERTIFIED on their own.
  - City Energy counted demo accounts as "active scouts", so the live API
    reported ten scouts in Lagos who do not exist.
  - The agent API and public API, which sell "the truth" to machines, served
    demo scores with nothing to distinguish them.

The rules, applied everywhere through this module:

  1. Never blend. If any real reading exists, demo readings are dropped.
  2. Demo readings are never evidence: they never count as readings, never
     count as scouts, and never certify anything.
  3. Every score says where it came from: energy_source is "scouts", "demo" or
     "none".
  4. Machines never receive a demo score as a reading.
"""

DEMO_PREFIX = "demo-scout-"

SOURCE_SCOUTS = "scouts"
SOURCE_DEMO = "demo"
SOURCE_NONE = "none"


def is_synthetic(rating: dict) -> bool:
    """A reading the ambient engine made up, by flag or by its demo account."""
    if not rating:
        return False
    if rating.get("synthetic") is True:
        return True
    return str(rating.get("user_id") or "").startswith(DEMO_PREFIX)


def separate(ratings: list[dict]) -> tuple[list[dict], str]:
    """
    The readings a score may be built from, and where that score comes from.

    Real readings win outright: if there is even one, every demo reading is
    dropped, so the two are never averaged together.
    """
    ratings = ratings or []
    real = [r for r in ratings if not is_synthetic(r)]
    if real:
        return real, SOURCE_SCOUTS
    if ratings:
        return ratings, SOURCE_DEMO
    return [], SOURCE_NONE


def real_only_filter() -> dict:
    """Mongo clause excluding synthetic readings, for counts that mean evidence."""
    return {
        "synthetic": {"$ne": True},
        "user_id": {"$not": {"$regex": f"^{DEMO_PREFIX}"}},
    }


def is_demo_venue(venue: dict) -> bool:
    return (venue or {}).get("energy_source") == SOURCE_DEMO


# Fields that carry a reading of the room. A machine consumer must never get a
# demo value in any of them.
READING_FIELDS = (
    "current_vibe_score", "vibe_score", "energy_score", "energy_level",
    "energy_label", "vibe_state", "capacity_level", "gate_level",
    "vibe_velocity", "is_surging", "viibe_certified",
)


def for_machines(venue: dict) -> dict:
    """
    The version of a venue an agent or API partner may see.

    A demo-driven venue reports no reading at all rather than a made-up one,
    and says plainly why.
    """
    if not is_demo_venue(venue):
        return venue
    out = dict(venue)
    for field in READING_FIELDS:
        if field in out:
            out[field] = None
    out["energy_source"] = SOURCE_NONE
    out["note"] = "No live reading from scouts yet."
    return out
