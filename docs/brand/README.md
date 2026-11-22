# VIIBE Certified emblem

Picked 22 Nov 2026 (option B, "double-I check"): a tick whose long stroke is the
double I of VIIBE, on brand pink.

| File | Use |
|---|---|
| `viibe-certified-mark.svg` | The mark. App, web, next to a host's name, on a venue. Drawn in code by `frontend/src/components/CertifiedMark.tsx`. |
| `viibe-certified-sticker.svg` | Door sticker and certificate: the mark inside a ring reading "VIIBE Certified · Checked by people". Not for screens under 64px; the ring text cannot be read. |

Colours: pink `#FF3366`, tick `#FFF5DE`, sticker ground `#0A090D`.

What it means: a person at VIIBE checked who this organiser or venue is, through
the contact their own ticketing page or website lists (`backend/app/routes/certification.py`).
It lasts a year.

Not to be confused with **Vibe Certified**, the automatic energy badge a venue
earns by holding a high score (`frontend/src/components/CertifiedBadge.tsx`).
The two names stay separate by founder decision.

Rules:
- Only on organisers and venues with a current certification. Never on community listings.
- Never recolour it to an energy colour; those mean a reading.
- Minimum size 14px on screen, 20mm printed.
