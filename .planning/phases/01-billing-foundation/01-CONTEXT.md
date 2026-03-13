# Phase 1: Billing Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning
**Source:** User instruction (manual implementation already complete)

<domain>
## Phase Boundary

The billing foundation has already been implemented manually. This phase is NOT about writing new code. It is about:
1. Documenting what was built
2. Auditing the implementation against requirements BILL-01 through BILL-04
3. Identifying any gaps without fixing them in these plans

</domain>

<decisions>
## Implementation Decisions

### Planning Constraint (LOCKED)
- **No new code in this phase** — The user has already implemented billing manually
- Plans must focus exclusively on documentation and verification tasks

### Plan Structure (LOCKED)
- Plan 1: Document existing billing implementation (what exists, how it works, file paths)
- Plan 2: Verify implementation against BILL-01 through BILL-04 (gap analysis)

### What to Document
- All billing-related files and their roles
- How Paystack subscriptions work in the current codebase
- RevenueCat integration status (if any)
- Merchant SaaS subscription state
- Pulse Drop purchase gating
- Free trial logic
- Webhook handler coverage

### Verification Approach
- Read actual code, compare against each BILL-XX requirement
- Mark each requirement as: ✓ Implemented / ⚠ Partial / ✗ Missing
- Note specific file + line references for each finding
- Do NOT implement fixes — only report gaps

### Claude's Discretion
- Exactly which files to inspect and in what order
- Format of the documentation output
- Whether to create markdown files, update STATE.md, or use comments

</decisions>

<specifics>
## Specific Ideas

- The research doc (`01-RESEARCH.md`) already contains a thorough codebase audit — use it as a starting point, verify against actual current code
- Key files to inspect: `backend/app/routes/subscriptions.py`, `backend/app/routes/webhooks.py`, `backend/app/services/payments.py`, `backend/app/routes/planner.py`, `backend/app/routes/pulse_drops.py`, `frontend/src/components/VibePlusModal.tsx`
- Requirements to verify: BILL-01 (Vibe+ subscribe + feature gates), BILL-02 (free trial), BILL-03 (merchant SaaS), BILL-04 (Pulse Drop gate)

</specifics>

<deferred>
## Deferred Ideas

- RevenueCat iOS/Android native integration — deferred to Phase 2 (EAS builds)
- Fixing any identified gaps — out of scope for this phase

</deferred>

---

*Phase: 01-billing-foundation*
*Context gathered: 2026-03-13 — user confirmed manual implementation complete, documentation+verification only*
