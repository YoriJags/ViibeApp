"""
Vibe App - Email Notification Service (SendGrid)

Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in environment variables.
"""
import os
import httpx
from app.config import logger

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@vibezapp.com")
SENDGRID_FROM_NAME = "Vibez"
SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"

# Brand colours used in email templates
_PINK = "#FF3366"
_PURPLE = "#9933FF"
_CYAN = "#00D4FF"
_GOLD = "#FFD700"
_BG = "#070710"
_CARD = "#12181F"
_TEXT_MUTED = "#94A3B8"


async def send_email(to_email: str, to_name: str, subject: str, html_content: str, text_content: str = "") -> bool:
    """Low-level email sender. Returns True on success."""
    if not SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — email not sent")
        return False

    payload = {
        "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
        "from": {"email": SENDGRID_FROM_EMAIL, "name": SENDGRID_FROM_NAME},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": text_content or subject},
            {"type": "text/html", "value": html_content},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                SENDGRID_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            success = response.status_code == 202
            if success:
                logger.info(f"Email sent to {to_email}: {subject}")
            else:
                logger.warning(f"Email failed for {to_email}: {response.status_code} {response.text}")
            return success
    except Exception as e:
        logger.error(f"Email error for {to_email}: {e}")
        return False


def _base_template(body_html: str) -> str:
    return f"""
    <div style="background:{_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                padding:0;margin:0;min-height:100vh;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <span style="font-size:28px;font-weight:900;
                       background:linear-gradient(135deg,{_PINK},{_PURPLE});
                       -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            VIBEZ
          </span>
        </div>
        {body_html}
        <div style="text-align:center;margin-top:40px;padding-top:24px;
                    border-top:1px solid #1E3A5F;">
          <p style="font-size:12px;color:{_TEXT_MUTED};margin:0;">
            You're receiving this because you have a Vibez account.
          </p>
        </div>
      </div>
    </div>
    """


async def send_achievement_email(user_email: str, user_name: str, badge_name: str, badge_description: str, badge_emoji: str = "🏆") -> bool:
    """Email sent when a scout unlocks an achievement badge."""
    body = f"""
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:56px;margin-bottom:16px;">{badge_emoji}</div>
      <h1 style="color:{_PINK};font-size:24px;font-weight:900;margin:0;">Badge Unlocked!</h1>
    </div>
    <p style="color:#CBD5E1;font-size:16px;line-height:1.6;margin-bottom:8px;">Hey {user_name},</p>
    <p style="color:#CBD5E1;font-size:16px;line-height:1.6;margin-bottom:24px;">
      You just earned the <strong style="color:{_GOLD};">{badge_name}</strong> badge on Vibez.
    </p>
    <div style="background:{_CARD};border:1px solid {_PINK}40;border-radius:12px;
                padding:20px;margin-bottom:24px;text-align:center;">
      <p style="font-size:14px;color:{_TEXT_MUTED};margin:0;line-height:1.6;">{badge_description}</p>
    </div>
    <p style="color:{_TEXT_MUTED};font-size:14px;text-align:center;margin-bottom:32px;">
      Keep scouting to unlock more badges and climb the leaderboard.
    </p>
    <div style="text-align:center;">
      <a href="#" style="background:{_PINK};color:#fff;padding:14px 36px;border-radius:8px;
                         text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        Open Vibez
      </a>
    </div>
    """
    return await send_email(
        to_email=user_email,
        to_name=user_name,
        subject=f"{badge_emoji} New Badge Unlocked: {badge_name}",
        html_content=_base_template(body),
    )


async def send_weekly_scout_digest(
    user_email: str,
    user_name: str,
    clout_earned: int,
    ratings_count: int,
    streak_days: int,
    top_venue: str,
) -> bool:
    """Weekly summary email for scouts."""
    body = f"""
    <h2 style="color:{_PINK};font-size:22px;font-weight:900;text-align:center;margin-bottom:8px;">
      Your Weekly Vibe Report
    </h2>
    <p style="color:{_TEXT_MUTED};font-size:14px;text-align:center;margin-bottom:32px;">
      Here's what you got up to this week, {user_name}
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:30px;font-weight:900;color:{_GOLD};">+{clout_earned}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Clout Earned</div>
      </div>
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:30px;font-weight:900;color:{_CYAN};">{ratings_count}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Venues Rated</div>
      </div>
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:30px;font-weight:900;color:{_PINK};">{streak_days}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Day Streak</div>
      </div>
    </div>
    <div style="background:{_CARD};border-radius:10px;padding:16px;margin-bottom:32px;">
      <p style="color:{_TEXT_MUTED};font-size:12px;margin:0 0 4px;">Most visited spot this week</p>
      <p style="color:#fff;font-size:16px;font-weight:700;margin:0;">{top_venue}</p>
    </div>
    <div style="text-align:center;">
      <a href="#" style="background:{_PURPLE};color:#fff;padding:14px 36px;border-radius:8px;
                         text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        View Full Stats
      </a>
    </div>
    """
    return await send_email(
        to_email=user_email,
        to_name=user_name,
        subject="Your Weekly Vibe Report is here",
        html_content=_base_template(body),
    )


async def send_merchant_weekly_digest(
    merchant_email: str,
    venue_name: str,
    weekly_spend: int,
    pulse_drops_used: int,
    total_ratings: int,
    peak_hour: str,
) -> bool:
    """Weekly intelligence email for merchant venue owners."""
    body = f"""
    <h2 style="color:#4169E1;font-size:22px;font-weight:900;text-align:center;margin-bottom:8px;">
      {venue_name}
    </h2>
    <p style="color:{_TEXT_MUTED};font-size:14px;text-align:center;margin-bottom:32px;">
      Weekly Intelligence Report
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:#22C55E;">₦{weekly_spend:,}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Campaign Spend</div>
      </div>
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:#FF9800;">{pulse_drops_used}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Pulse Drops Used</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px;">
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:{_CYAN};">{total_ratings}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Scout Ratings</div>
      </div>
      <div style="background:{_CARD};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:16px;font-weight:900;color:{_GOLD};">{peak_hour}</div>
        <div style="font-size:11px;color:{_TEXT_MUTED};margin-top:4px;">Peak Hour</div>
      </div>
    </div>
    <div style="text-align:center;">
      <a href="#" style="background:#4169E1;color:#fff;padding:14px 36px;border-radius:8px;
                         text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        Open Dashboard
      </a>
    </div>
    """
    return await send_email(
        to_email=merchant_email,
        to_name=venue_name,
        subject=f"{venue_name}: Your Weekly Vibe Intelligence",
        html_content=_base_template(body),
    )
