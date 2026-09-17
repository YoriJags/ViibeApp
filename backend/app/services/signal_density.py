"""
Signal Density: how much evidence sits behind a venue's reading.

This measures the VOLUME of signal, never the energy itself. It is deliberately
kept in its own module, with its own vocabulary, because of the bug it caused:

It used to be `compute_pulse()` in the venues route and returned tiers named
dormant / stirring / charged / electric / max_pulse / source. Four of those also
name states on the ENERGY ladder, so a venue that had merely received eighty
ratings displayed "ELECTRIC" to its own owner on the merchant dashboard, and to
a person standing outside it on the nearby prompt. That is a false claim about
someone's business, made by the product whose entire moat is not making false
claims.

The ladders may never share a word again. See docs/VOCABULARY.md.
"""

# Density says how much we know. Energy says what the room is like.
# Nothing in this list appears on the energy ladder in docs/ENERGY.md.
LADDER = ["none", "thin", "partial", "firm", "dense", "saturated"]

THRESHOLDS = [
    (100, "saturated", 0),
    (80,  "dense",     100),
    (60,  "firm",      80),
    (40,  "partial",   60),
    (20,  "thin",      40),
    (0,   "none",      20),
]

MAX_COUNT = 100


def compute_signal_density(venue: dict) -> dict:
    """
    Derive the evidence tier from a venue's 24h reading count.

    Absent or unreadable counts resolve to "none", never to a flattering
    default. Not knowing is reported as not knowing.
    """
    try:
        raw = int(venue.get("total_ratings_24h") or 0)
    except (TypeError, ValueError):
        raw = 0

    count = max(0, min(raw, MAX_COUNT))

    for floor, tier, next_at in THRESHOLDS:
        if count >= floor:
            return {
                "count": count,
                "total": MAX_COUNT,
                "tier": tier,
                "next_tier_at": next_at,
            }

    # Unreachable: the table's last floor is 0.
    return {"count": count, "total": MAX_COUNT, "tier": "none", "next_tier_at": 20}
