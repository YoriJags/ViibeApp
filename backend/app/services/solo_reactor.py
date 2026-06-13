"""
Solo-meaningful Reactor — cold-start mechanic #4.

Tapping the Reactor when you're the only scout at a venue should never feel like
shouting into the void. Two ideas:

  1. Solo signature — your taps build your OWN energy fingerprint even alone, so
     a quiet venue still rewards you personally (a label + stats, not a dead ring).
  2. Lindy dividend — the more alone you were when you charged, the more your
     early contribution is retroactively amplified once the venue fills. Being
     first to feel it pays off later.

Pure module: signature + multiplier math. The Reactor reads the signature; the
backend applies the dividend when a venue grows. Tested in test_solo_reactor.py.
"""
from __future__ import annotations

from dataclasses import dataclass

# Cap on how much an early mover is amplified vs a latecomer.
MAX_EARLY_MULT = 3.0


def early_multiplier(scouts_when_active: int, peak_scouts: int) -> float:
    """
    Retroactive multiplier on an early contribution. The fewer scouts present
    when you charged (relative to the venue's eventual peak), the larger it is:
    alone at a venue that later packs out → up to MAX_EARLY_MULT; arriving at the
    peak → 1.0 (no early bonus).
    """
    if peak_scouts <= 0 or scouts_when_active <= 0:
        return 1.0
    ratio = min(1.0, scouts_when_active / peak_scouts)  # 0..1, lower = earlier
    return round(1.0 + (1.0 - ratio) * (MAX_EARLY_MULT - 1.0), 2)


def retro_clout(base_clout: int, scouts_when_active: int, peak_scouts: int) -> int:
    """Bonus clout (the extra *over* base) for having charged early."""
    mult = early_multiplier(scouts_when_active, peak_scouts)
    return max(0, round(base_clout * (mult - 1.0)))


@dataclass(frozen=True)
class SoloSignature:
    taps:    int
    peak_g:  float
    avg_bpm: float
    label:   str


def solo_signature(taps: int, peak_g: float, avg_bpm: float) -> SoloSignature:
    """Personal Reactor fingerprint — meaningful with zero other scouts present."""
    if taps <= 0:
        label = "DORMANT"
    elif avg_bpm >= 128 and peak_g >= 2.0:
        label = "IGNITER"     # high tempo + high force
    elif peak_g >= 2.0:
        label = "HEAVY"       # forceful, body-led taps
    elif avg_bpm >= 110:
        label = "STEADY"      # locked-in rhythm
    else:
        label = "WARMING"
    return SoloSignature(
        taps=taps,
        peak_g=round(peak_g, 2),
        avg_bpm=round(avg_bpm),
        label=label,
    )
