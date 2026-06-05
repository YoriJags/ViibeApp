"""
Attribution — the money organ.

Turns live signal into a merchant ROI proof: of the people who showed intent
(viewed the venue, tapped directions, said "enroute"), how many became
*verified arrivals* (geofence-confirmed check-ins / ratings), did the room
actually lift versus its own baseline, and what is that worth in naira.

Doctrine (inherited from the decay engine): honest-scarcity. If the baseline is
too thin to make an honest claim, we say so (`lift_pct = None`, `honest=False`)
rather than fabricate a number. A merchant ROI report that never lies is the one
that earns the contract — and the dataset that survives an acquirer's diligence.

Pure module: no Mongo, no await. Orchestration (DB queries) lives in the route;
the math lives here so it is unit-testable with closed-form expected values.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

# Estimated average spend per verified visit (matches blast-attribution).
AVG_SPEND_NGN = 8_000

# Honest lift needs at least this many comparable prior windows to compare to.
MIN_BASELINE_WINDOWS = 2

# Below this many verified arrivals the sample is too thin to trust at face value.
THIN_ARRIVALS = 3


# ─── Result containers ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class IntentFunnel:
    """Top-of-funnel demand signals in the window."""
    profile_views: int
    direction_taps: int
    enroute_intents: int

    @property
    def total_intent(self) -> int:
        return self.profile_views + self.direction_taps + self.enroute_intents


@dataclass(frozen=True)
class ArrivalStats:
    verified_arrivals: int
    arrival_user_ids: frozenset


@dataclass(frozen=True)
class LiftResult:
    current: float
    baseline: Optional[float]      # None when baseline too thin
    lift_pct: Optional[float]      # None when no honest baseline
    honest: bool                   # True only when baseline met the bar


@dataclass(frozen=True)
class AttributionReport:
    window_hours: float
    funnel: IntentFunnel
    verified_arrivals: int
    matched_conversions: int       # intent-users who became arrivals
    matched_conversion_pct: float
    lift: LiftResult
    estimated_revenue_ngn: int
    confidence: float              # [0..1] — honest read of how much to trust this


# ─── Pure computations ────────────────────────────────────────────────────────

def count_unique_arrivals(
    arrival_records: Iterable[dict],
    user_key: str = "user_id",
) -> ArrivalStats:
    """
    Dedupe verified-arrival records (check-ins + ratings) by user. Two ratings
    from the same scout in the window is one body in the room, not two.
    Falsy / missing user ids are ignored — an arrival we can't attribute to a
    person doesn't count toward verified bodies.
    """
    ids = frozenset(
        r[user_key] for r in arrival_records if r.get(user_key)
    )
    return ArrivalStats(verified_arrivals=len(ids), arrival_user_ids=ids)


def matched_conversion(
    intent_user_ids: Iterable[str],
    arrival_user_ids: Iterable[str],
) -> tuple[int, float]:
    """
    Of the people who showed intent (and we could identify), how many arrived?
    This is the honest conversion: a specific scout tapped directions, then
    showed up. Returns (matched_count, pct_of_identified_intent).
    """
    intent = frozenset(uid for uid in intent_user_ids if uid)
    arrivals = frozenset(uid for uid in arrival_user_ids if uid)
    if not intent:
        return 0, 0.0
    matched = len(intent & arrivals)
    return matched, round(matched / len(intent) * 100, 1)


def compute_lift(
    current: float,
    baseline_values: Iterable[float],
    min_windows: int = MIN_BASELINE_WINDOWS,
) -> LiftResult:
    """
    Lift of `current` against the mean of comparable prior windows (e.g. the
    same clock-window on the last 4 Saturdays). With fewer than `min_windows`
    comparables we refuse to claim a lift — honest-scarcity over a vanity number.
    """
    values = list(baseline_values)
    if len(values) < min_windows:
        return LiftResult(current=current, baseline=None, lift_pct=None, honest=False)

    baseline = sum(values) / len(values)
    if baseline <= 0:
        # No prior activity to compare against — a real but unquantifiable lift.
        return LiftResult(current=current, baseline=baseline, lift_pct=None, honest=False)

    lift_pct = round((current - baseline) / baseline * 100, 1)
    return LiftResult(current=current, baseline=round(baseline, 2), lift_pct=lift_pct, honest=True)


def estimate_revenue(verified_arrivals: int, avg_spend: int = AVG_SPEND_NGN) -> int:
    return max(0, verified_arrivals) * avg_spend


def _confidence(verified_arrivals: int, lift: LiftResult) -> float:
    """
    Honest read of how much weight to put on this report.
      0.0  — nobody verified showed up
      0.4  — single-digit handful (directional, not provable)
      0.7  — real arrivals but no honest baseline to compare against
      1.0  — real arrivals AND an honest baseline
    """
    if verified_arrivals == 0:
        return 0.0
    if verified_arrivals < THIN_ARRIVALS:
        return 0.4
    if not lift.honest:
        return 0.7
    return 1.0


def assemble_report(
    window_hours: float,
    funnel: IntentFunnel,
    arrivals: ArrivalStats,
    intent_user_ids: Iterable[str],
    baseline_arrival_counts: Iterable[float],
    avg_spend: int = AVG_SPEND_NGN,
) -> AttributionReport:
    """Assemble the full ROI report from the pre-queried pieces."""
    matched, matched_pct = matched_conversion(intent_user_ids, arrivals.arrival_user_ids)
    lift = compute_lift(arrivals.verified_arrivals, baseline_arrival_counts)
    revenue = estimate_revenue(arrivals.verified_arrivals, avg_spend)
    confidence = _confidence(arrivals.verified_arrivals, lift)

    return AttributionReport(
        window_hours=window_hours,
        funnel=funnel,
        verified_arrivals=arrivals.verified_arrivals,
        matched_conversions=matched,
        matched_conversion_pct=matched_pct,
        lift=lift,
        estimated_revenue_ngn=revenue,
        confidence=confidence,
    )
