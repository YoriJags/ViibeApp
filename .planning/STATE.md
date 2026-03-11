# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** The city's energy, visible in real-time — so anyone knows where the night is peaking before they get there, and scouts who report it earn clout for being first.
**Current focus:** Phase 1 — Billing Foundation

## Current Position

Phase: 1 of 6 (Billing Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-11 — Roadmap created (6 phases, 20 v1 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Billing]: Use RevenueCat + Apple IAP on iOS as primary path (not Paystack on iOS); Paystack on Android and web. Apple Guideline 3.1.1 is ambiguous for venue intelligence — research before iOS submission.
- [Distribution]: EAS Build required before push notifications can be tested on real devices. Mapbox token must be moved to EAS Secrets before first EAS Build (currently exposed in app.json).
- [Calendar]: App Store submission must occur by mid-October 2026 for Detty December. Phase 1 + Phase 2 must complete by early October.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Apple external payment policy (Guideline 3.1.1) is ambiguous for venue intelligence apps. Research before iOS submission; prepare RevenueCat IAP fallback in parallel with Paystack flow. Launch Android first.
- [Phase 2]: `app.json` has placeholder `"projectId": "your-eas-project-id"` — run `eas init` at the start of Phase 2. Mapbox `RNMapboxMapsDownloadToken` is exposed in committed `app.json` — move to EAS Secrets immediately.
- [Phase 5]: Merchant SaaS pricing (₦150,000/month) has no research validation for Nigerian venue owner price sensitivity. Conduct 3–5 merchant interviews before locking Phase 5 scope.

## Session Continuity

Last session: 2026-03-11
Stopped at: Roadmap created — ready to begin Phase 1 planning
Resume file: None
