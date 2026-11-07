"""
When to leave: the promise VIIBE makes for ticketed concerts and festivals.

Someone holding a festival ticket has already decided to go. What they need on
the night is timing: is the gate a mess, has it filled up, has the energy
picked up. That is a different question from "is it worth going", which is
the promise for door-entry nights. See IDENTITY.md, "Two promises".

What this can honestly answer, and what it cannot:

  It knows the GATE (from readings in the last 30 minutes), the FLOW (verified
  arrivals and departures from auto check-in) and the ENERGY inside (only when
  real scouts produced it).

  It does not know how far away the person is, what traffic is like, set
  times, or whether a headliner has started. So it never says "leave in 20
  minutes" or "the headliner is on". It describes the gate and the room, and
  the person decides. Advice it cannot back is advice it does not give.
"""
from collections import Counter

# Evidence floors. Below them, the honest answer is "we don't know yet".
MIN_GATE_READINGS = 2
MIN_FLOW = 3

GATE_ORDER = {"clear": 0, "slow": 1, "blocked": 2}

HOT_STATES = ("lit", "peak")
BUILDING_STATES = ("warming", "charged")


def gate_consensus(gate_readings: list[str]) -> str | None:
    """
    The gate as most recent readers saw it. A tie resolves to the WORSE state:
    telling someone the gate is slower than it is costs them a little time;
    telling them it is clear when it is jammed costs them an hour in a queue.
    """
    readings = [g for g in (gate_readings or []) if g in GATE_ORDER]
    if len(readings) < MIN_GATE_READINGS:
        return None
    counts = Counter(readings)
    top = max(counts.values())
    tied = [g for g, c in counts.items() if c == top]
    return max(tied, key=lambda g: GATE_ORDER[g])


def advise(phase: str,
           gate_readings: list[str] | None = None,
           arrivals_30m: int = 0,
           departures_30m: int = 0,
           energy_state: str | None = None,
           energy_source: str | None = None,
           starts_at_label: str | None = None) -> dict:
    """
    The advice for one ticketed event right now.

    Returns {advice, headline, detail, gate, flow}. `advice` is a stable key
    the app styles by; headline and detail are the words people read.
    """
    gate = gate_consensus(gate_readings or [])
    try:
        arrivals = max(0, int(arrivals_30m or 0))
        departures = max(0, int(departures_30m or 0))
    except (TypeError, ValueError):
        arrivals = departures = 0
    flow = {"arrivals_30m": arrivals, "departures_30m": departures}

    # Demo energy never informs advice. Only a real reading can say "it's going".
    energy = energy_state if energy_source == "scouts" else None

    def out(advice, headline, detail):
        return {"advice": advice, "headline": headline, "detail": detail,
                "gate": gate, "flow": flow, "energy": energy}

    if phase == "ended":
        return out("ended", "This event has finished.", "")

    if phase == "upcoming":
        when = f" at {starts_at_label}" if starts_at_label else ""
        return out("upcoming", f"Starts{when}.",
                   "We'll have a read from the gate once people start arriving.")

    has_flow = arrivals >= MIN_FLOW or departures >= MIN_FLOW
    if gate is None and not has_flow:
        return out("no_data", "No one has reported from the gate yet.",
                   "If you're there, one reading tells everyone else what it's like.")

    if gate == "blocked":
        return out("wait", "The gate is jammed right now.",
                   "Getting there later could save you the queue.")

    if phase == "live" and departures >= MIN_FLOW and departures > arrivals:
        return out("winding_down", "More people are leaving than arriving.",
                   f"{departures} left in the last 30 minutes, {arrivals} arrived.")

    if gate in ("clear", "slow"):
        moving = "The gate is clear" if gate == "clear" else "The gate is slow but moving"
        if energy in HOT_STATES:
            return out("go_now", f"{moving} and it's going inside.",
                       "A good time to head in.")
        if energy in BUILDING_STATES:
            return out("go_soon", f"{moving} and it's filling up.",
                       "The room is building.")
        return out("no_rush", f"{moving} and it's still early inside.",
                   "No rush yet." if not energy else "It hasn't picked up yet.")

    # No gate reading, but real arrivals: say only what the flow shows.
    return out("filling", "People are arriving.",
               f"{arrivals} arrived in the last 30 minutes. No gate reading yet.")
