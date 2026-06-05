"""
Weekly Lift Report tests — assembly, headline honesty, render.

The headline is the thing a venue owner reads first, so its honesty (no "%
vs average" claim without a real baseline) is verified explicitly.
"""
from app.services.lift_report import (
    VenueNight,
    build_weekly_report,
    render_report_card,
    energy_label,
    AVG_SPEND_NGN as _UNUSED,  # noqa: F401  (kept to assert import wiring)
)
from app.services.attribution import AVG_SPEND_NGN


def _night(day, arrivals, taps=0, peak=None, lift=None):
    return VenueNight(
        day_label=day,
        verified_arrivals=arrivals,
        pre_arrival_taps=taps,
        peak_hour_label=peak,
        lift_pct=lift,
        estimated_revenue_ngn=arrivals * AVG_SPEND_NGN,
    )


# ─── Energy label bands ───────────────────────────────────────────────────────

def test_energy_label_bands():
    assert energy_label(None, 0) == "DORMANT"
    assert energy_label(None, 12) == "BUZZING"     # real crowd, no baseline
    assert energy_label(60, 30) == "ELECTRIC"
    assert energy_label(20, 30) == "POPPING"
    assert energy_label(5, 30) == "BUZZING"
    assert energy_label(-10, 30) == "STIRRING"


# ─── Assembly ─────────────────────────────────────────────────────────────────

def test_best_night_is_max_arrivals():
    nights = [_night("Friday", 12, lift=10), _night("Saturday", 31, peak="1am", lift=40)]
    report = build_weekly_report("Quilox", "Jun 01 – Jun 07, 2026", nights)
    assert report.best_night.day_label == "Saturday"
    assert report.total_arrivals == 43
    assert report.total_revenue_ngn == 43 * AVG_SPEND_NGN


def test_empty_week_has_no_best_night():
    nights = [_night("Friday", 0), _night("Saturday", 0)]
    report = build_weekly_report("Shiro", "wk", nights)
    assert report.best_night is None
    assert "quiet week" in report.headline.lower()


# ─── Headline honesty ─────────────────────────────────────────────────────────

def test_headline_claims_lift_only_when_present():
    nights = [_night("Saturday", 31, taps=47, peak="1am", lift=23.0)]
    report = build_weekly_report("Quilox", "wk", nights)
    assert "ELECTRIC" not in report.headline  # 23% is POPPING, not ELECTRIC
    assert "+23% vs your 4-week average" in report.headline
    assert "31 verified arrivals" in report.headline
    assert "47 taps" in report.headline


def test_headline_omits_lift_when_no_baseline():
    nights = [_night("Saturday", 20, taps=10, peak="12am", lift=None)]
    report = build_weekly_report("Escape", "wk", nights)
    assert "vs your 4-week average" not in report.headline
    assert "BUZZING" in report.headline  # real crowd, unranked
    assert "20 verified arrivals" in report.headline


def test_headline_electric_at_high_lift():
    nights = [_night("Saturday", 80, taps=60, peak="1am", lift=75.0)]
    report = build_weekly_report("DNA", "wk", nights)
    assert "ELECTRIC" in report.headline
    assert "+75% vs your 4-week average" in report.headline


# ─── Render ───────────────────────────────────────────────────────────────────

def test_render_is_self_contained_html():
    nights = [_night("Friday", 12, taps=8, peak="11pm", lift=5.0),
              _night("Saturday", 31, taps=47, peak="1am", lift=23.0)]
    report = build_weekly_report("Quilox", "Jun 01 – Jun 07, 2026", nights)
    html = render_report_card(report)
    assert html.startswith("<!doctype html>")
    assert "Quilox" in html
    assert "VIIBE · LIFT REPORT" in html
    assert "http://" not in html and "https://" not in html  # no external assets
    assert "₦" in html  # naira formatting present


def test_render_shows_no_baseline_chip_when_lift_none():
    nights = [_night("Saturday", 20, lift=None)]
    report = build_weekly_report("Escape", "wk", nights)
    html = render_report_card(report)
    assert "no baseline" in html
