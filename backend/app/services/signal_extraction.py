"""
Signal Extraction Layer — AI-02

Async NLP pipeline that runs on every scout text submission.
Uses Claude Haiku to extract structured intelligence from free-text vibe notes.

Output per rating:
  - vibe_dimension: what aspect the text is about (energy/crowd/music/space/door)
  - intensity_modifier: amplifier extracted from text (packed/dead/popping/etc)
  - contradiction_flag: True if text sentiment conflicts with numeric rating
  - named_entities: list of DJs, event names, or notable items mentioned
  - enriched_signal: short normalised description (max 8 words)

Cost: < $0.001 per call at GPT-4o-mini / Claude Haiku pricing.
Run async post-submission — zero latency impact on the rating endpoint.
"""
import os
import json
import re
from datetime import datetime, timezone
from app.config import db, logger


_HIGH_ENERGY_WORDS = {
    "packed", "popping", "lit", "fire", "peak", "crazy", "madness",
    "loud", "electric", "banging", "vibing", "e don burst", "everywhere full",
    "everywhere dey shake", "no space", "turn up", "going off", "going crazy",
}
_LOW_ENERGY_WORDS = {
    "dead", "empty", "boring", "slow", "quiet", "nobody", "no one",
    "ghost town", "dry", "flat", "mellow", "chill", "low key",
    "nothing dey happen", "e don die", "scatter",
}


def _rule_based_extract(text: str, numeric_score: float) -> dict:
    """
    Fast rule-based fallback when no API key is present or call fails.
    Handles common English + Nigerian pidgin phrases.
    """
    text_lower = text.lower()

    # Dimension detection
    dimension = "energy"
    if any(w in text_lower for w in ["dj", "music", "song", "set", "beat", "sound"]):
        dimension = "music"
    elif any(w in text_lower for w in ["crowd", "people", "everyone", "everybody", "person"]):
        dimension = "crowd"
    elif any(w in text_lower for w in ["queue", "door", "bouncer", "line", "wait", "gate"]):
        dimension = "door"
    elif any(w in text_lower for w in ["space", "room", "floor", "table", "seat"]):
        dimension = "space"

    # Intensity
    high_hit = any(w in text_lower for w in _HIGH_ENERGY_WORDS)
    low_hit = any(w in text_lower for w in _LOW_ENERGY_WORDS)

    if high_hit:
        intensity = "high"
    elif low_hit:
        intensity = "low"
    else:
        intensity = "neutral"

    # Contradiction: text says low but score is 70+ (or text says high but score < 30)
    contradiction = False
    if low_hit and numeric_score >= 70:
        contradiction = True
    elif high_hit and numeric_score <= 30:
        contradiction = True

    return {
        "vibe_dimension": dimension,
        "intensity_modifier": intensity,
        "contradiction_flag": contradiction,
        "named_entities": [],
        "enriched_signal": text[:50].strip() if text else "",
        "source": "rule_based",
    }


async def extract_signal(rating_id: str, text: str, numeric_score: float) -> dict:
    """
    Extract structured signal from scout text note.
    Tries Claude Haiku first; falls back to rule-based if unavailable.

    Stores result on the rating document and returns the extraction.
    """
    if not text or not text.strip():
        return {}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    extraction = None

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)

            prompt = f"""You are analysing a scout's live report from a venue. The scout gave a numeric energy score of {numeric_score}/100 and wrote this text note:

"{text}"

Extract the following in JSON (no markdown, no explanation, just the JSON object):
{{
  "vibe_dimension": one of: energy, crowd, music, space, door,
  "intensity_modifier": single word describing intensity (e.g. packed, dead, popping, quiet, electric, flat),
  "contradiction_flag": true if the text sentiment strongly conflicts with the numeric score of {numeric_score},
  "named_entities": array of any DJ names, event names, artist names mentioned (empty array if none),
  "enriched_signal": max 8 words summarising the vibe in plain English
}}"""

            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text.strip()
            raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=re.DOTALL).strip()
            extraction = json.loads(raw)
            extraction["source"] = "claude_haiku"
        except Exception as e:
            logger.warning(f"Signal extraction AI call failed for rating {rating_id}: {e}")

    if extraction is None:
        extraction = _rule_based_extract(text, numeric_score)

    # Stamp on the rating document
    update_fields = {
        "nlp_vibe_dimension": extraction.get("vibe_dimension"),
        "nlp_intensity_modifier": extraction.get("intensity_modifier"),
        "text_contradiction": extraction.get("contradiction_flag", False),
        "nlp_named_entities": extraction.get("named_entities", []),
        "nlp_enriched_signal": extraction.get("enriched_signal", ""),
        "nlp_extracted_at": datetime.now(timezone.utc),
        "nlp_source": extraction.get("source", "unknown"),
    }

    try:
        await db.ratings.update_one(
            {"id": rating_id},
            {"$set": update_fields},
        )
    except Exception as e:
        logger.warning(f"Failed to store signal extraction for rating {rating_id}: {e}")

    return extraction
