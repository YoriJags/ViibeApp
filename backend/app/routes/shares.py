from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse
from app.config import db
from datetime import datetime, timezone

router = APIRouter(prefix="/shares", tags=["shares"])


@router.get("/receipt/{venue_id}", response_class=HTMLResponse)
async def receipt_card(
    venue_id: str,
    score: int = Query(default=0),
    ts: str = Query(default=""),
):
    venue = await db.venues.find_one({"id": venue_id})
    name = venue.get("name", "Unknown Venue") if venue else "Unknown Venue"
    area = venue.get("area", "") if venue else ""

    try:
        dt = datetime.fromisoformat(ts)
    except Exception:
        dt = datetime.now(timezone.utc)

    formatted_time = dt.strftime("%A, %b %d · %I:%M %p").replace(" 0", " ")

    if score >= 80:
        score_color = "#00F0FF"
        score_glow = "rgba(0,240,255,0.25)"
        state = "PEAK"
        state_color = "#00F0FF"
    elif score >= 60:
        score_color = "#C9A84C"
        score_glow = "rgba(201,168,76,0.3)"
        state = "ELECTRIC"
        state_color = "#C9A84C"
    else:
        score_color = "#E8E4DA"
        score_glow = "rgba(232,228,218,0.1)"
        state = "WARMING"
        state_color = "rgba(232,228,218,0.5)"

    location = f"{area} · Lagos" if area else "Lagos"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta property="og:title" content="I was at {name} when it hit {score}">
<meta property="og:description" content="VIIBE Scene Intelligence · {location}">
<meta property="og:image" content="/api/shares/receipt/{venue_id}?score={score}&ts={ts}">
<title>I Was There — VIIBE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

:root {{
  --bg: #08070F;
  --surface: #0F0E1A;
  --gold: #C9A84C;
  --gold-dim: rgba(201,168,76,0.12);
  --gold-border: rgba(201,168,76,0.2);
  --text: #E8E4DA;
  --muted: rgba(232,228,218,0.4);
  --faint: rgba(232,228,218,0.08);
}}

body {{
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}}

.card {{
  width: 380px;
  background: var(--surface);
  border: 1px solid var(--gold-border);
  padding: 40px 36px 32px;
  display: flex; flex-direction: column; justify-content: space-between;
  position: relative; overflow: hidden;
  min-height: 380px;
}}

/* Top-right glow */
.card::before {{
  content: '';
  position: absolute; top: -120px; right: -120px;
  width: 320px; height: 320px;
  background: radial-gradient(circle, {score_glow} 0%, transparent 65%);
  pointer-events: none;
}}

/* Bottom decorative line */
.card::after {{
  content: '';
  position: absolute; bottom: 0; left: 36px; right: 36px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-border), transparent);
}}

.brand {{
  font-size: 9px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 600;
  opacity: 0.7;
}}

.body {{
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 28px 0 20px;
}}

.eyebrow {{
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
  margin-bottom: 8px;
}}

.venue-name {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 30px;
  font-weight: 900;
  color: var(--text);
  line-height: 1.1;
  margin-bottom: 28px;
  letter-spacing: -0.01em;
}}

.score-block {{
  display: flex;
  align-items: flex-end;
  gap: 14px;
}}

.score-num {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 88px;
  font-weight: 900;
  color: {score_color};
  line-height: 1;
  letter-spacing: -0.03em;
  text-shadow: 0 0 60px {score_glow};
}}

.score-meta {{
  padding-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}}

.when-label {{
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
}}

.state-label {{
  font-size: 12px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: {state_color};
  font-weight: 600;
}}

.divider {{
  height: 1px;
  background: var(--faint);
  margin: 20px 0 16px;
}}

.footer {{
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}}

.footer-text {{
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
  line-height: 1.6;
  opacity: 0.7;
}}

.watermark {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 11px;
  font-style: italic;
  color: var(--gold);
  opacity: 0.5;
  letter-spacing: 0.05em;
}}
</style>
</head>
<body>
<div class="card">
  <div class="brand">V I I B E</div>

  <div class="body">
    <p class="eyebrow">I was at</p>
    <p class="venue-name">{name}</p>
    <div class="score-block">
      <div class="score-num">{score}</div>
      <div class="score-meta">
        <span class="when-label">when it hit</span>
        <span class="state-label">{state}</span>
      </div>
    </div>
  </div>

  <div>
    <div class="divider"></div>
    <div class="footer">
      <div class="footer-text">
        <div>{formatted_time}</div>
        <div>{location} · Scene Intelligence</div>
      </div>
      <div class="watermark">viibe.app</div>
    </div>
  </div>
</div>
</body>
</html>"""
    return HTMLResponse(content=html)
