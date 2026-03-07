"""
Heat Map — city venue heat intensity for the map overlay.

Returns venues grouped by area with aggregated vibe score + live bolt velocity.
Frontend renders this as a heat overlay on the city map or as an area grid.

Routes:
  GET /heat-map/{city}   — all venue heat points for a city
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter
from app.config import db

router = APIRouter(tags=["heat_map"])


@router.get("/heat-map/{city}")
async def get_heat_map(city: str):
    """Returns venue heat points with bolt velocity for the city."""
    city_lower = city.lower()
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

    venues = await db.venues.find(
        {"city": {"$regex": city_lower, "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "lat": 1, "lng": 1,
         "current_vibe_score": 1, "energy_level": 1, "capacity_level": 1},
    ).to_list(200)

    # Enrich with bolt velocity (last 1 hour) per venue
    heat_points = []
    for v in venues:
        bolt_1h = await db.venue_bolts.count_documents({
            "venue_id": v["id"],
            "created_at": {"$gte": one_hour_ago},
        })
        heat_points.append({
            "venue_id": v["id"],
            "name": v["name"],
            "area": v.get("area", ""),
            "lat": v.get("lat"),
            "lng": v.get("lng"),
            "vibe_score": v.get("current_vibe_score", 0),
            "energy_level": v.get("energy_level", "quiet"),
            "capacity_level": v.get("capacity_level", "sparse"),
            "bolt_velocity_1h": bolt_1h,
            # Heat intensity 0-100: blend of vibe score + bolt activity
            "heat_intensity": min(100, v.get("current_vibe_score", 0) + min(bolt_1h * 2, 30)),
        })

    # Area-level aggregation for the grid view
    area_map: dict = {}
    for p in heat_points:
        area = p["area"] or "Other"
        if area not in area_map:
            area_map[area] = {"venues": [], "total_heat": 0, "bolt_total": 0}
        area_map[area]["venues"].append(p)
        area_map[area]["total_heat"] += p["heat_intensity"]
        area_map[area]["bolt_total"] += p["bolt_velocity_1h"]

    areas = sorted([
        {
            "area": area,
            "venue_count": len(info["venues"]),
            "avg_heat": round(info["total_heat"] / len(info["venues"])),
            "bolt_total_1h": info["bolt_total"],
            "top_venue": max(info["venues"], key=lambda x: x["heat_intensity"])["name"],
        }
        for area, info in area_map.items()
    ], key=lambda x: x["avg_heat"], reverse=True)

    return {
        "city": city,
        "heat_points": heat_points,
        "areas": areas,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
