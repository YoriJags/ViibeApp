"""Monday merchant report: honest summaries, and never a silently lost send."""
from dataclasses import dataclass
from typing import Optional

from app.services import merchant_report as mr


@dataclass
class FakeNight:
    day_label: str
    verified_arrivals: int
    pre_arrival_taps: int
    peak_hour_label: Optional[str]
    lift_pct: Optional[float]


@dataclass
class FakeReport:
    venue_name: str
    week_label: str
    nights: list


def report(nights):
    return FakeReport("Club Quilox", "Sep 01 to Sep 07, 2026", nights)


# ── the prompt carries the honesty constraint ────────────────────────────────

def test_measured_lift_is_stated_against_its_own_baseline():
    p = mr.summary_prompt(report([FakeNight("Friday", 41, 12, "11pm", 23.0)]))
    assert "+23% against its own 4-week baseline" in p


def test_unproven_lift_is_named_as_unproven():
    p = mr.summary_prompt(report([FakeNight("Friday", 41, 12, "11pm", None)]))
    assert "lift unproven" in p


def test_the_model_is_forbidden_from_sweetening_an_unproven_week():
    p = mr.summary_prompt(report([FakeNight("Friday", 3, 1, None, None)]))
    assert "Do not soften it" in p
    assert "Invent nothing." in p


def test_every_night_reaches_the_prompt():
    p = mr.summary_prompt(report([
        FakeNight("Friday", 41, 12, "11pm", 23.0),
        FakeNight("Saturday", 55, 20, "1am", -8.0),
    ]))
    assert "Friday" in p and "Saturday" in p and "-8%" in p


def test_a_missing_peak_hour_does_not_break_the_prompt():
    p = mr.summary_prompt(report([FakeNight("Tuesday", 0, 0, None, None)]))
    assert "peak unclear" in p


# ── delivery never loses a report ────────────────────────────────────────────

class FakeInsert:
    def __init__(self): self.saved = []
    async def insert_one(self, doc): self.saved.append(doc)


def park_reason(monkeypatch, env, email):
    """Run deliver_or_park with a stubbed collection and read what was stored."""
    import asyncio
    fake = FakeInsert()

    class FakeDB:
        merchant_reports = fake

    import sys, types
    stub = types.ModuleType("app.config")
    stub.db = FakeDB()
    monkeypatch.setitem(sys.modules, "app.config", stub)
    for k, v in env.items():
        monkeypatch.delenv(k, raising=False) if v is None else monkeypatch.setenv(k, v)
    out = asyncio.run(mr.deliver_or_park("v1", "Club Quilox", email, "subj", "<html/>", None))
    return out, fake.saved


def test_missing_merchant_email_parks_with_a_reason(monkeypatch):
    out, saved = park_reason(monkeypatch, {"SENDGRID_API_KEY": "sg-key"}, None)
    assert out["status"] == "parked"
    assert "no merchant email" in out["reason"]
    assert len(saved) == 1          # still recorded, not dropped


def test_missing_mail_credential_parks_with_a_reason(monkeypatch):
    out, saved = park_reason(monkeypatch, {"SENDGRID_API_KEY": None}, "owner@venue.ng")
    assert out["status"] == "parked"
    assert "SENDGRID_API_KEY" in out["reason"]
    assert saved[0]["html"] == "<html/>"   # the report itself is preserved


def test_a_parked_report_keeps_everything_needed_to_send_it_later(monkeypatch):
    _, saved = park_reason(monkeypatch, {"SENDGRID_API_KEY": None}, "owner@venue.ng")
    doc = saved[0]
    for field in ("venue_id", "venue_name", "to_email", "subject", "html", "created_at"):
        assert field in doc
