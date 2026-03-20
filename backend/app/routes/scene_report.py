from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse
from app.config import db
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/scene-report", tags=["scene-report"])


@router.get("/weekly", response_class=HTMLResponse)
async def weekly_scene_report(city: str = Query(default="lagos")):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    snapshots = await db.vibe_snapshots.find(
        {"ts": {"$gte": week_ago.isoformat()}}
    ).to_list(length=5000)

    venue_scores: dict[str, list[int]] = {}
    venue_names: dict[str, str] = {}
    hour_buckets: dict[int, list[int]] = {}

    for snap in snapshots:
        vid = snap.get("venue_id") or snap.get("id", "")
        score = snap.get("score", 0)
        name = snap.get("venue_name") or snap.get("name", vid)
        ts_raw = snap.get("ts", "")

        if vid:
            venue_scores.setdefault(vid, []).append(score)
            venue_names[vid] = name

        try:
            dt = datetime.fromisoformat(ts_raw)
            hour_buckets.setdefault(dt.hour, []).append(score)
        except Exception:
            pass

    venue_avgs = {
        vid: sum(scores) / len(scores)
        for vid, scores in venue_scores.items()
        if scores
    }
    top3 = sorted(venue_avgs, key=lambda v: venue_avgs[v], reverse=True)[:3]

    peak_hour = max(
        hour_buckets,
        key=lambda h: sum(hour_buckets[h]) / len(hour_buckets[h]),
        default=22,
    )
    peak_label = f"{peak_hour % 12 or 12}{'AM' if peak_hour < 12 else 'PM'}"

    movers = {
        vid: max(scores) - min(scores)
        for vid, scores in venue_scores.items()
        if len(scores) >= 3
    }
    biggest_mover_id = max(movers, key=lambda v: movers[v], default=None)
    biggest_mover_name = venue_names.get(biggest_mover_id, "—") if biggest_mover_id else "—"
    biggest_mover_swing = movers.get(biggest_mover_id, 0) if biggest_mover_id else 0

    scene_of_week_id = max(
        venue_scores, key=lambda v: max(venue_scores[v]), default=None
    )
    scene_of_week_name = venue_names.get(scene_of_week_id, "—") if scene_of_week_id else "—"
    scene_peak = max(venue_scores[scene_of_week_id]) if scene_of_week_id else 0

    week_label = f"{week_ago.strftime('%b %d')} – {now.strftime('%b %d, %Y')}"

    def score_color(s: int) -> str:
        if s >= 80:
            return "#00F0FF"
        if s >= 60:
            return "#C9A84C"
        return "#E8E4DA"

    top3_rows = ""
    medals = ["I", "II", "III"]
    for i, vid in enumerate(top3):
        avg = int(venue_avgs[vid])
        col = score_color(avg)
        top3_rows += f"""
        <div class="venue-row">
          <span class="medal">{medals[i]}</span>
          <span class="vname">{venue_names[vid]}</span>
          <span class="vscore" style="color:{col};">{avg}</span>
        </div>"""

    if not top3_rows:
        top3_rows = "<p class='empty'>Insufficient data this week</p>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta property="og:title" content="Lagos Scene Report — {week_label}">
<meta property="og:description" content="Top venues, peak hour &amp; scene moments. VIIBE Scene Intelligence.">
<title>Lagos Scene Report — VIIBE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

:root {{
  --bg: #08070F;
  --surface: #0F0E1A;
  --surface2: #141320;
  --gold: #C9A84C;
  --gold-dim: rgba(201,168,76,0.1);
  --gold-border: rgba(201,168,76,0.2);
  --gold-glow: rgba(201,168,76,0.18);
  --text: #E8E4DA;
  --muted: rgba(232,228,218,0.45);
  --faint: rgba(232,228,218,0.06);
  --line: rgba(201,168,76,0.15);
}}

body {{
  background: var(--bg);
  display: flex; align-items: flex-start; justify-content: center;
  min-height: 100vh; padding: 48px 24px;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}}

.card {{
  width: 100%; max-width: 520px;
  background: var(--surface);
  border: 1px solid var(--gold-border);
  position: relative; overflow: hidden;
}}

/* ambient top-right glow */
.card::before {{
  content: '';
  position: absolute; top: -150px; right: -150px;
  width: 400px; height: 400px;
  background: radial-gradient(circle, var(--gold-glow) 0%, transparent 65%);
  pointer-events: none; z-index: 0;
}}

.inner {{ position: relative; z-index: 1; }}

/* ── header ── */
.header {{
  padding: 36px 40px 32px;
  border-bottom: 1px solid var(--line);
}}

.brand-row {{
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px;
}}

.brand {{
  font-size: 9px; letter-spacing: 0.45em; text-transform: uppercase;
  color: var(--gold); font-weight: 600; opacity: 0.8;
}}

.issue-tag {{
  font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted); font-weight: 500;
  border: 1px solid var(--faint);
  padding: 4px 10px;
}}

.report-title {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 34px; font-weight: 900;
  line-height: 1.1; color: var(--text);
  letter-spacing: -0.01em;
  margin-bottom: 8px;
}}

.report-sub {{
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted);
}}

/* ── section ── */
.section {{
  padding: 28px 40px;
  border-bottom: 1px solid var(--line);
}}

.section:last-child {{ border-bottom: none; }}

.section-label {{
  font-size: 9px; letter-spacing: 0.35em; text-transform: uppercase;
  color: var(--gold); font-weight: 600; opacity: 0.6;
  margin-bottom: 20px;
}}

/* ── top venues ── */
.venue-row {{
  display: flex; align-items: center; gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--faint);
}}
.venue-row:last-child {{ border-bottom: none; }}

.medal {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 11px; font-style: italic;
  color: var(--gold); opacity: 0.5;
  width: 20px; flex-shrink: 0;
  letter-spacing: 0.05em;
}}

.vname {{
  flex: 1;
  font-size: 15px; font-weight: 500;
  color: var(--text);
  letter-spacing: -0.01em;
}}

.vscore {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 26px; font-weight: 900;
  letter-spacing: -0.02em;
}}

/* ── stat grid ── */
.stat-grid {{
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}}

.stat {{
  background: var(--surface2);
  border: 1px solid var(--faint);
  padding: 20px 18px;
}}

.stat-val {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 28px; font-weight: 900;
  color: var(--gold);
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}}

.stat-label {{
  font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--muted); font-weight: 500;
}}

/* ── scene of the week ── */
.sotw-card {{
  background: var(--gold-dim);
  border: 1px solid var(--gold-border);
  padding: 24px;
  position: relative; overflow: hidden;
}}

.sotw-card::before {{
  content: '';
  position: absolute; bottom: -40px; right: -40px;
  width: 120px; height: 120px;
  background: radial-gradient(circle, rgba(201,168,76,0.2) 0%, transparent 70%);
  pointer-events: none;
}}

.sotw-tag {{
  font-size: 9px; letter-spacing: 0.35em; text-transform: uppercase;
  color: var(--gold); font-weight: 600; opacity: 0.8;
  margin-bottom: 10px;
}}

.sotw-name {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 22px; font-weight: 900;
  color: var(--text); margin-bottom: 8px;
}}

.sotw-desc {{
  font-size: 12px; color: var(--muted); line-height: 1.5;
}}

.sotw-score {{
  font-family: 'Playfair Display', Georgia, serif;
  font-style: italic;
  color: var(--gold);
}}

/* ── footer ── */
.footer {{
  padding: 20px 40px;
  border-top: 1px solid var(--line);
  display: flex; justify-content: space-between; align-items: center;
}}

.footer-text {{
  font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--muted); opacity: 0.6;
}}

.footer-brand {{
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 11px; font-style: italic;
  color: var(--gold); opacity: 0.5;
}}

.empty {{
  font-size: 13px; color: var(--muted); padding: 8px 0;
  font-style: italic;
}}
</style>
</head>
<body>
<div class="card">
  <div class="inner">

    <div class="header">
      <div class="brand-row">
        <span class="brand">V I I B E</span>
        <span class="issue-tag">Weekly · {city.title()}</span>
      </div>
      <div class="report-title">Lagos Scene<br>Report</div>
      <div class="report-sub">{week_label}</div>
    </div>

    <div class="section">
      <div class="section-label">Top Venues This Week</div>
      {top3_rows}
    </div>

    <div class="section">
      <div class="section-label">City Pulse</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-val">{peak_label}</div>
          <div class="stat-label">Peak Hour</div>
        </div>
        <div class="stat">
          <div class="stat-val">+{biggest_mover_swing}</div>
          <div class="stat-label">Biggest Swing</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">Scene of the Week</div>
      <div class="sotw-card">
        <div class="sotw-tag">Moment</div>
        <div class="sotw-name">{scene_of_week_name}</div>
        <div class="sotw-desc">
          Peaked at <span class="sotw-score">{scene_peak}</span> energy.
          {biggest_mover_name} had the wildest ride — a <span class="sotw-score">+{biggest_mover_swing}</span> point swing across the week.
        </div>
      </div>
    </div>

    <div class="footer">
      <span class="footer-text">VIIBE · Scene Intelligence · Lagos</span>
      <span class="footer-brand">viibe.app</span>
    </div>

  </div>
</div>
</body>
</html>"""
    return HTMLResponse(content=html)
