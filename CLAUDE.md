# CLAUDE.md — VIIBE

This file governs how Claude works in this project. Read it at the start of every session.

---

## Project Identity

VIIBE is the real-time intelligence layer for city experiences. It crowdsources and measures the live energy of venues (clubs, bars, lounges, events) and uses AI to get people to the right moment before it peaks.

**Not a nightlife app. Not a booking app. A scene intelligence app.**
The one-line framing: *"A live sensor network made of people."*

---

## Hard Rules (Never Break)

- **Never describe VIIBE as a nightlife app** — it's a scene app
- **Never suggest livestream or stream ratings** — explicitly ditched, do not revisit
- **Never answer product questions without reading the codebase first** — partial context produces weak answers that waste tokens and time
- **Read `IDEAS.md` at the start of every session** — it tracks all pending tasks, seed milestone items, and deferred ideas
- **Read `MEMORY.md`** at `C:\Users\OAJAGUN\.claude\projects\c--VIIBE\memory\MEMORY.md` for user preferences and prior feedback

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction: update memory with the lesson
- Write rules that prevent the same mistake
- Review memory at session start for relevant lessons
- Never repeat a corrected mistake

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: implement the elegant solution
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

1. **Plan First**: Write plan with checkable items before implementing
2. **Verify Plan**: Check in before starting implementation on large tasks
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each milestone step
5. **Document Results**: Update IDEAS.md after any new task completion or discovery
6. **Capture Lessons**: Update memory after corrections

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. No side effects with new bugs.
- **No Guessing**: If context is missing, read the codebase — don't guess.

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React Native + Expo 54, TypeScript, Reanimated, Skia |
| Backend | FastAPI, Python, MongoDB Atlas, Socket.IO |
| Auth | Firebase Auth |
| Payments | RevenueCat (iOS/Android IAP), Paystack (web/merchant) |
| Infra | Railway (backend), Vercel (web), EAS (mobile builds) |
| Analytics | PostHog (planned) |

**Reanimated note:** Peer dep for react-native-reanimated v4.1.x (Expo SDK 54) is `react-native-worklets`, NOT `react-native-worklets-core`.

---

## Key Files

| File | Purpose |
|------|---------|
| `.planning/IDEAS.md` | Running tracker — ALL pending tasks, seed milestone, deferred ideas |
| `.planning/PROJECT.md` | Product definition, requirements, roadmap |
| `.planning/ideas/VIBE_SCORE_FORMULA.md` | Complete scoring formula documentation |
| `backend/app/services/vibe.py` | Core score calculation — multi-signal weighted blend |
| `frontend/src/components/VibeReactor.tsx` | Main reactor UI — Skia canvas, kinetic tap, G-force |
| `frontend/app/venue/[id].tsx` | Venue detail screen — dwell, ambient, transparency pill |
| `frontend/src/hooks/useDwellTracker.ts` | Dwell time heartbeat tracking |
| `frontend/src/hooks/useAmbientMeter.ts` | Ambient audio dB sampling (opt-in, no recording) |

---

## Seed Milestone (Blocking for Fundraise)

These must ship before investor conversations. Check IDEAS.md for current status.

- BILL-01–04: Vibe+ subscription, merchant SaaS, Pulse Drop boosts
- DIST-01–02: EAS Build, TestFlight
- NOTF-01–04: Push notifications, in-app centre
- GROW-01–03: Referral links, deep links, Vibe Moment share cards
- ANAL-01–03: Merchant analytics, admin dashboard, investor demo kit
- INVT-01–04: War Room, pitch deck, strategy blueprint, financial model

---

*Last updated: 2026-03-17*
