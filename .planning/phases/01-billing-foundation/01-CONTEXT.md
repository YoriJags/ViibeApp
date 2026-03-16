# Phase 1: Billing Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning
**Source:** User instruction (manual implementation ~90% complete)

<domain>
## Phase Boundary

The billing foundation has already been implemented manually (~90% done). Paystack + Flutterwave integrations and core ledger logic are in place. This phase is primarily about:
1. Documenting what was built (both Paystack and Flutterwave paths)
2. Auditing the implementation against requirements BILL-01 through BILL-04
3. Filling minor gaps ONLY: error handling, logging, small defensive checks

</domain>

<decisions>
## Implementation Decisions

### Implementation Status (LOCKED)
- Phase 1 is ~90% complete — Paystack + Flutterwave integrations and core ledger logic are already implemented
- Plans must NOT rewrite existing logic or propose architectural changes

### Allowed Scope (UPDATED)
- Document the existing implementation (inventory of what was built)
- Audit against BILL-01 through BILL-04 requirements
- Fill minor gaps ONLY: error handling improvements, logging additions, small defensive checks
- DO NOT build new features or refactor working code

### Plan Structure (LOCKED)
- Plan 1: Document existing billing implementation (file inventory — both Paystack and Flutterwave)
- Plan 2: Audit against BILL-01–BILL-04 + resilience checks + minor gap fixes

### What to Document
- All billing-related files and their roles (Paystack AND Flutterwave paths)
- How both payment providers are integrated and when each is used
- RevenueCat integration status (if any)
- Merchant SaaS subscription state
- Pulse Drop purchase gating
- Free trial logic
- Webhook handler coverage for both providers

### Verification Approach — Required Audit Items
- Read actual code, compare against each BILL-XX requirement (✓/⚠/✗ verdicts with file:line evidence)
- **REQUIRED: Naira fluctuation handling** — Check how the codebase handles NGN amount volatility in transactions. Does it store amounts at charge time? Are hard-coded kobo values a problem if pricing changes? Does the webhook verify the amount received matches what was expected?
- **REQUIRED: Failed network request handling in transactions** — During vibe-check transactions (Paystack/Flutterwave API calls), check what happens when the payment provider is unreachable. Does the code have timeouts? Retry logic? Graceful error responses? Or will it hang/crash?
- Minor gap filling allowed: add try/except blocks, error logging, and defensive checks where clearly missing

### Claude's Discretion
- Exactly which files to inspect and in what order
- Format of the documentation output
- Where to add simple error handling / logging (minor gaps only)

</decisions>

<specifics>
## Specific Ideas

- The research doc (`01-RESEARCH.md`) already contains a thorough codebase audit — use it as a starting point, verify against actual current code (which may have changed since audit)
- Payment providers in use: **Paystack** (primary) + **Flutterwave** (also implemented) — audit must cover BOTH
- Key files to inspect: `backend/app/routes/subscriptions.py`, `backend/app/routes/webhooks.py`, `backend/app/services/payments.py`, `backend/app/routes/planner.py`, `backend/app/routes/pulse_drops.py`, `backend/app/routes/oracle.py`, `frontend/src/components/VibePlusModal.tsx`
- Also check for Flutterwave-specific files: `backend/app/services/flutterwave.py` or similar
- Requirements to verify: BILL-01 (Vibe+ subscribe + feature gates), BILL-02 (free trial), BILL-03 (merchant SaaS), BILL-04 (Pulse Drop gate)
- Special audit focus: Naira fluctuation resilience + network failure handling in payment calls

</specifics>

<deferred>
## Deferred Ideas

- RevenueCat iOS/Android native integration — deferred to Phase 2 (EAS builds)
- Major refactors or architectural changes — out of scope

</deferred>

---

*Phase: 01-billing-foundation*
*Context updated: 2026-03-13 — scope expanded: Flutterwave audit added, Naira fluctuation + network failure checks required, minor gap filling (error handling/logging) now in scope*
