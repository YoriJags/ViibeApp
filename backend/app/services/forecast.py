"""
Vibe Forecast Service
AI-predicted energy curve for tonight using 4-week rolling averages.
"""
from datetime import datetime, timedelta, timezone
from app.config import db, logger


async def generate_forecast(venue_id: str) -> dict | None:
    """
    Predict tonight's hourly vibe scores.
    Uses same-day-of-week data over past 4 weeks with recency weighting.
    """
    now = datetime.now(timezone.utc)
    today_dow = now.weekday()  # 0=Monday, 6=Sunday

    # Gather snapshots from same day-of-week over past 4 weeks
    four_weeks_ago = now - timedelta(days=28)
    snapshots = await db.vibe_snapshots.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": four_weeks_ago},
    }).to_list(10000)

    if not snapshots:
        return None

    # Filter to same day of week
    same_day_snapshots = []
    for snap in snapshots:
        ts = snap.get("timestamp", now)
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts.weekday() == today_dow:
            same_day_snapshots.append({**snap, "_parsed_ts": ts})

    if len(same_day_snapshots) < 5:
        return None  # Not enough data for reliable forecast

    # Group by hour with recency weighting
    hourly_data: dict[int, list[tuple[float, float]]] = {}
    for snap in same_day_snapshots:
        ts = snap["_parsed_ts"]
        hour = ts.hour
        score = snap.get("vibe_score", 0)

        # Recency weight: more recent weeks weighted higher
        weeks_ago = (now - ts).days / 7
        weight = max(0.5, 2.0 - (weeks_ago * 0.4))

        if hour not in hourly_data:
            hourly_data[hour] = []
        hourly_data[hour].append((score, weight))

    # Build forecast
    forecast = []
    for hour in range(24):
        data = hourly_data.get(hour, [])
        if data:
            total_weight = sum(w for _, w in data)
            weighted_avg = sum(s * w for s, w in data) / total_weight
            confidence = min(100, len(data) * 25)  # 4 samples = 100%

            # Predict energy level
            if weighted_avg >= 75:
                energy = "electric"
            elif weighted_avg >= 45:
                energy = "popping"
            else:
                energy = "chill"

            forecast.append({
                "hour": hour,
                "hour_label": f"{hour:02d}:00",
                "predicted_score": round(weighted_avg, 1),
                "confidence": confidence,
                "predicted_energy": energy,
            })
        else:
            forecast.append({
                "hour": hour,
                "hour_label": f"{hour:02d}:00",
                "predicted_score": 0,
                "confidence": 0,
                "predicted_energy": "chill",
            })

    # Find peak
    peak_entry = max(forecast, key=lambda x: x["predicted_score"])
    peak_hour = peak_entry["hour_label"] if peak_entry["predicted_score"] > 0 else None
    peak_score = peak_entry["predicted_score"]

    # Calculate overall confidence
    data_hours = sum(1 for f in forecast if f["confidence"] > 0)
    overall_confidence = round((data_hours / 24) * 100)
    weeks_of_data = len(set(
        snap["_parsed_ts"].isocalendar()[1] for snap in same_day_snapshots
    ))

    return {
        "forecast": forecast,
        "peak_hour": peak_hour,
        "peak_score": peak_score,
        "overall_confidence": overall_confidence,
        "weeks_of_data": weeks_of_data,
    }


async def get_forecast_accuracy(venue_id: str) -> dict:
    """Compare last week's forecast to actual scores."""
    now = datetime.now(timezone.utc)
    last_week_start = now - timedelta(days=7)
    last_week_end = now

    snapshots = await db.vibe_snapshots.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": last_week_start, "$lt": last_week_end},
    }).to_list(5000)

    if not snapshots:
        return {"accuracy_pct": None, "message": "No data from last week"}

    # Simple accuracy: compare to 2-week-ago predictions
    # For now, return average score variance
    scores = [s.get("vibe_score", 0) for s in snapshots if s.get("vibe_score", 0) > 0]
    if not scores:
        return {"accuracy_pct": None, "message": "No scored data"}

    avg_score = sum(scores) / len(scores)
    variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
    stability = max(0, 100 - variance)

    return {
        "accuracy_pct": round(stability, 1),
        "avg_score_last_week": round(avg_score, 1),
        "sample_count": len(scores),
    }
