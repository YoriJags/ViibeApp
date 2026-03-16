---
phase: 1
slug: billing-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Note: This phase is documentation + audit only (no new code). Validation is primarily manual.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing: `backend/tests/test_admin_endpoints.py`) |
| **Config file** | none — run from `backend/` directory |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | BILL-01 | manual | Read + document subscriptions.py | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | BILL-02 | manual | Read + document trial state in subscriptions.py | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | BILL-03 | manual | Read + document merchant SaaS routes | ✅ | ⬜ pending |
| 1-01-04 | 01 | 1 | BILL-04 | manual | Read + document pulse_drops.py gating | ✅ | ⬜ pending |
| 1-02-01 | 02 | 2 | BILL-01 | manual | Gap analysis: Vibe+ price, Night Planner gate, feature access | ✅ | ⬜ pending |
| 1-02-02 | 02 | 2 | BILL-02 | manual | Gap analysis: trial_ends_at field, status screen | ✅ | ⬜ pending |
| 1-02-03 | 02 | 2 | BILL-03 | manual | Gap analysis: merchant SaaS subscription + webhook | ✅ | ⬜ pending |
| 1-02-04 | 02 | 2 | BILL-04 | manual | Gap analysis: Pulse Drop SaaS gate | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*This phase is documentation/audit only — no new test files required. Existing test suite provides the baseline.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Billing implementation documented | BILL-01–04 | Documentation task — no automation possible | Read implementation doc artifact, verify all key files listed with accurate descriptions |
| Gap analysis completeness | BILL-01–04 | Requires human judgment on coverage | Read gap analysis, verify each BILL-XX has a clear ✓/⚠/✗ verdict with file+line evidence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
