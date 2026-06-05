"""
Weekly Lift Report — wealth organ #2.

One auto-generated, screenshot-able card per venue per week. It is three tools
in one: the sales pitch ("here's what VIIBE did for you"), the retention hook
(a merchant who gets this every Monday stays subscribed), and the virality
engine (venues post it to their own IG). It renders the attribution numbers
(organ #1) into something a venue owner feels.

Doctrine: honest-scarcity carries through. A night with no honest baseline shows
its verified arrivals and revenue but makes no "% vs average" claim. A believable
report that never over-promises is what survives contact with a real venue owner.

Pure module: assembly + HTML render only. No Mongo, no await. The endpoint feeds
it pre-queried nights; this turns them into a headline + a shareable card.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.services.attribution import AVG_SPEND_NGN


# ─── Data shapes ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class VenueNight:
    """One night's attribution roll-up."""
    day_label: str                       # "Saturday"
    verified_arrivals: int
    pre_arrival_taps: int                # direction taps in the run-up
    peak_hour_label: Optional[str] = None  # "12:40am" or None if no arrivals
    lift_pct: Optional[float] = None     # None when baseline too thin (honest)
    estimated_revenue_ngn: int = 0


@dataclass(frozen=True)
class WeeklyLiftReport:
    venue_name: str
    week_label: str                      # "Jun 1–7, 2026"
    nights: List[VenueNight]
    best_night: Optional[VenueNight]
    total_arrivals: int
    total_revenue_ngn: int
    total_taps: int
    headline: str


# Energy label from how far the best night beat its own baseline.
def energy_label(lift_pct: Optional[float], arrivals: int) -> str:
    if arrivals <= 0:
        return "DORMANT"
    if lift_pct is None:
        return "BUZZING"          # real crowd, no baseline to rank it against
    if lift_pct >= 50:
        return "ELECTRIC"
    if lift_pct >= 15:
        return "POPPING"
    if lift_pct >= 0:
        return "BUZZING"
    return "STIRRING"             # below its own average


# ─── Assembly (pure) ──────────────────────────────────────────────────────────

def _make_headline(venue_name: str, best: Optional[VenueNight]) -> str:
    if best is None or best.verified_arrivals <= 0:
        return f"{venue_name}: quiet week — no verified crowd yet. The map stayed honest."

    label = energy_label(best.lift_pct, best.verified_arrivals)
    peak = f" at {best.peak_hour_label}" if best.peak_hour_label else ""
    parts = [f"{best.day_label}: your room hit {label}{peak}"]

    # Only claim a comparison when it's honest.
    if best.lift_pct is not None:
        sign = "+" if best.lift_pct >= 0 else ""
        parts.append(f"{sign}{best.lift_pct:g}% vs your 4-week average")

    parts.append(f"{best.verified_arrivals} verified arrivals")
    if best.pre_arrival_taps > 0:
        parts.append(f"{best.pre_arrival_taps} taps in the run-up")
    return " · ".join(parts) + "."


def build_weekly_report(
    venue_name: str,
    week_label: str,
    nights: List[VenueNight],
) -> WeeklyLiftReport:
    best = max(nights, key=lambda n: n.verified_arrivals, default=None)
    if best is not None and best.verified_arrivals <= 0:
        best = None  # no real crowd all week → no "best night"

    return WeeklyLiftReport(
        venue_name=venue_name,
        week_label=week_label,
        nights=nights,
        best_night=best,
        total_arrivals=sum(n.verified_arrivals for n in nights),
        total_revenue_ngn=sum(n.estimated_revenue_ngn for n in nights),
        total_taps=sum(n.pre_arrival_taps for n in nights),
        headline=_make_headline(venue_name, best),
    )


# ─── Render (pure) ────────────────────────────────────────────────────────────

_GOLD = "#E8B84B"
_INK = "#0B0B0F"
_CARD = "#15151C"
_MUTE = "#8A8A99"


def _naira(n: int) -> str:
    return "₦" + format(int(n), ",")


def _lift_chip(lift_pct: Optional[float]) -> str:
    if lift_pct is None:
        return f'<span style="color:{_MUTE}">— no baseline</span>'
    color = _GOLD if lift_pct >= 0 else "#E0556B"
    sign = "+" if lift_pct >= 0 else ""
    return f'<span style="color:{color};font-weight:700">{sign}{lift_pct:g}%</span>'


def render_report_card(report: WeeklyLiftReport) -> str:
    """Self-contained, inline-styled HTML — screenshot-ready, no external assets."""
    rows = ""
    for n in report.nights:
        peak = n.peak_hour_label or "—"
        rows += (
            f'<tr>'
            f'<td style="padding:10px 14px;color:#EDEDF2;font-weight:600">{n.day_label}</td>'
            f'<td style="padding:10px 14px;color:#EDEDF2;text-align:right">{n.verified_arrivals}</td>'
            f'<td style="padding:10px 14px;color:{_MUTE};text-align:right">{n.pre_arrival_taps}</td>'
            f'<td style="padding:10px 14px;text-align:right">{peak}</td>'
            f'<td style="padding:10px 14px;text-align:right">{_lift_chip(n.lift_pct)}</td>'
            f'<td style="padding:10px 14px;color:{_GOLD};text-align:right">{_naira(n.estimated_revenue_ngn)}</td>'
            f'</tr>'
        )

    best_label = energy_label(
        report.best_night.lift_pct if report.best_night else None,
        report.best_night.verified_arrivals if report.best_night else 0,
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VIIBE Lift Report — {report.venue_name}</title></head>
<body style="margin:0;background:{_INK};font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <div style="color:{_GOLD};font-weight:800;letter-spacing:2px;font-size:13px">VIIBE · LIFT REPORT</div>
    <div style="color:{_MUTE};font-size:12px">{report.week_label}</div>
  </div>
  <div style="color:#fff;font-size:26px;font-weight:800;margin:4px 0 2px">{report.venue_name}</div>
  <div style="color:{_GOLD};font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:18px">
    PEAK STATE · {best_label}
  </div>

  <div style="background:{_CARD};border:1px solid #23232E;border-radius:16px;padding:18px 18px 8px">
    <div style="color:#EDEDF2;font-size:15px;line-height:1.5;margin-bottom:16px">{report.headline}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="color:{_MUTE};font-size:11px;text-transform:uppercase;letter-spacing:.5px">
        <th style="text-align:left;padding:0 14px 8px">Night</th>
        <th style="text-align:right;padding:0 14px 8px">Arrivals</th>
        <th style="text-align:right;padding:0 14px 8px">Taps</th>
        <th style="text-align:right;padding:0 14px 8px">Peak</th>
        <th style="text-align:right;padding:0 14px 8px">Lift</th>
        <th style="text-align:right;padding:0 14px 8px">Est. ₦</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>

  <div style="display:flex;gap:12px;margin-top:16px">
    <div style="flex:1;background:{_CARD};border:1px solid #23232E;border-radius:14px;padding:14px">
      <div style="color:{_MUTE};font-size:11px;text-transform:uppercase">Verified arrivals</div>
      <div style="color:#fff;font-size:22px;font-weight:800">{report.total_arrivals}</div>
    </div>
    <div style="flex:1;background:{_CARD};border:1px solid #23232E;border-radius:14px;padding:14px">
      <div style="color:{_MUTE};font-size:11px;text-transform:uppercase">Est. revenue</div>
      <div style="color:{_GOLD};font-size:22px;font-weight:800">{_naira(report.total_revenue_ngn)}</div>
    </div>
    <div style="flex:1;background:{_CARD};border:1px solid #23232E;border-radius:14px;padding:14px">
      <div style="color:{_MUTE};font-size:11px;text-transform:uppercase">Run-up taps</div>
      <div style="color:#fff;font-size:22px;font-weight:800">{report.total_taps}</div>
    </div>
  </div>

  <div style="color:{_MUTE};font-size:11px;margin-top:18px;line-height:1.5">
    Verified arrivals are geofence-confirmed (check-in or in-venue rating).
    Est. revenue assumes {_naira(AVG_SPEND_NGN)} avg spend per visit.
    Lift compares each night to the same night over the prior 4 weeks — shown only
    when there's enough history to be honest.
  </div>
</div>
</body></html>"""
