"""
Monday merchant report — the moment money can enter.

The Lift Report has existed as a rendered page for a while, reachable only if
you knew the URL. Nothing ever put it in front of a venue owner, which is the
only event that matters commercially: an owner reading, on Monday morning,
what their Friday was actually worth.

This wires that last hop.

Two rules carried from the rest of the system:

  HONEST OR SILENT. The attribution engine already refuses to claim lift
  without a real baseline. The written summary inherits that: it is told the
  figures and told explicitly when lift is unproven, and it must say so
  rather than fill the gap with encouragement.

  PARK, NEVER DROP. If the mail credential is missing or the send fails, the
  report is stored with its reason instead of vanishing. A report nobody
  received must leave evidence that nobody received it.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import logging

logger = logging.getLogger("vibe_app")

WEEKLY_REPORT_ENABLED = os.environ.get("MERCHANT_REPORT_ENABLED", "0") == "1"
SEND_HOUR_LAGOS = 9          # Monday morning, read with the first coffee
CHECK_INTERVAL_SECONDS = 60 * 30
CLAUDE_MODEL = "claude-sonnet-5"


def _lagos_now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=1)


def summary_prompt(report) -> str:
    """
    The figures, stated plainly, with the honesty constraint made explicit.
    Nothing is inferred here that the engine did not measure.
    """
    lines = []
    for n in report.nights:
        lift = "lift unproven (no reliable baseline yet)" if n.lift_pct is None \
            else f"{n.lift_pct:+.0f}% against its own 4-week baseline"
        lines.append(
            f"- {n.day_label}: {n.verified_arrivals} verified arrivals, "
            f"{n.pre_arrival_taps} direction taps, peak {n.peak_hour_label or 'unclear'}, {lift}"
        )
    return (
        "You are writing three sentences to the owner of a Lagos venue about their week. "
        "You are given measured figures only.\n\n"
        f"Venue: {report.venue_name}\nWeek: {report.week_label}\n" + "\n".join(lines) +
        "\n\nRules:\n"
        "- Use only these numbers. Invent nothing.\n"
        "- Where lift is unproven, say plainly that we cannot yet claim it. Do not soften it "
        "into something that sounds positive.\n"
        "- No greeting, no sign-off, no bullet points. Three sentences of plain English.\n"
        "- Write for a busy owner, not a marketer. No exclamation marks."
    )


async def write_summary(report) -> Optional[str]:
    """Claude writes the plain-English read. Returns None if unavailable."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=350,
            messages=[{"role": "user", "content": summary_prompt(report)}],
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
    except Exception as e:
        logger.warning("merchant_report: summary unavailable: %s", e)
        return None


async def deliver_or_park(venue_id: str, venue_name: str, to_email: Optional[str],
                          subject: str, html: str, summary: Optional[str]) -> dict:
    """
    Send the report, or store it with the reason it could not go. Every
    outcome is recorded, so an undelivered report is visible rather than lost.
    """
    record = {
        "venue_id": venue_id,
        "venue_name": venue_name,
        "to_email": to_email,
        "subject": subject,
        "html": html,
        "summary": summary,
        "created_at": datetime.now(timezone.utc),
    }

    if not to_email:
        record["status"] = "parked"
        record["reason"] = "no merchant email on file"
    elif not os.environ.get("SENDGRID_API_KEY"):
        record["status"] = "parked"
        record["reason"] = "SENDGRID_API_KEY not configured"
    else:
        try:
            from app.services.email import send_email
            ok = await send_email(to_email, venue_name, subject, html)
            record["status"] = "sent" if ok else "parked"
            if not ok:
                record["reason"] = "mail provider rejected the send"
        except Exception as e:
            record["status"] = "parked"
            record["reason"] = f"send failed: {e}"

    from app.config import db
    await db.merchant_reports.insert_one(dict(record))
    return {"venue_id": venue_id, "status": record["status"], "reason": record.get("reason")}


async def run_weekly_reports() -> dict:
    """Build and deliver a report for every venue that has a merchant."""
    from app.config import db
    from app.routes.venue_live import assemble_weekly_report
    from app.services.lift_report import render_report_card

    merchants = await db.users.find(
        {"is_merchant": True, "merchant_venue_id": {"$ne": None}},
        {"_id": 0, "email": 1, "merchant_venue_id": 1},
    ).to_list(500)

    results = []
    for m in merchants:
        venue_id = m.get("merchant_venue_id")
        venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1})
        if not venue:
            continue
        venue_name = venue.get("name", "Your venue")

        report = await assemble_weekly_report(venue_id, venue_name)
        summary = await write_summary(report)

        html = render_report_card(report)
        if summary:
            html = html.replace(
                "</body>",
                f'<div style="max-width:640px;margin:0 auto 28px;padding:0 22px;'
                f'font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#A89B8C;">{summary}</div></body>',
            )

        results.append(await deliver_or_park(
            venue_id, venue_name, m.get("email"),
            f"{venue_name}: what last week was worth", html, summary,
        ))

    summary_line = {"venues": len(results),
                    "sent": sum(1 for r in results if r["status"] == "sent"),
                    "parked": sum(1 for r in results if r["status"] == "parked")}
    logger.info("merchant_report run: %s", summary_line)
    return {**summary_line, "results": results}


async def weekly_report_loop():
    """Fires once on Monday morning, Lagos time. Started when enabled."""
    import asyncio
    logger.info("Merchant weekly report ON (Mondays %02d:00 Lagos)", SEND_HOUR_LAGOS)
    sent_for = None
    while True:
        try:
            now = _lagos_now()
            key = now.date()
            if now.weekday() == 0 and now.hour >= SEND_HOUR_LAGOS and sent_for != key:
                await run_weekly_reports()
                sent_for = key
        except Exception as e:
            logger.warning("merchant_report loop failed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


def weekly_reports_enabled() -> bool:
    return WEEKLY_REPORT_ENABLED
