# VIIBE Launch Audit — strip-down to launch-ready

**Inventory at audit (2026-07-17):** 71 backend route modules (~260 endpoints),
149 frontend components, 26 screens. A pre-launch app with the surface area of
a Series-B product. This document is the R0 knife: what launches, what goes
dark, what gets deleted.

**The rule:** the launch app answers ONE question — *"where is alive right
now, and can I confirm it?"* — plus the two surfaces that earn money (merchant)
and evidence (Big Screen). Anything not serving those is dark until real users
pull it out.

---

## KEEP — the launch surface (ship exactly this)

### Consumer (the five things)
| Surface | Modules / components |
|---|---|
| Live map + city energy | `venues`, `city_energy`, `heat_map`, `orbit` · VibeMap, CityEnergyBar, VenueCard, TonightHero |
| Vibe check (3-sec rating) | `ratings`, `checkins` · RateVibeModal, SwipeRate, GPSLockIndicator, RatePromptFAB |
| Reactor (tap-to-charge) | `surge`, `reactions`, `solo` · VibeReactor, VibeSurgeBar, SurgeFullScreen, FloatingBolt |
| Venue detail | `venue_live`, `oracle` (heuristic only) · venue/[id], EnergyMeter, VibeOracle, TopScoutsCard |
| Identity + streaks (minimum) | `users`, `auth`, `streaks`, `leaderboard` · profile, OnboardingFlow, StreakBadge |

### Merchant (the money)
`merchant`, `pulse_drops`, `analytics`, `campaigns` (lift attribution path only),
Big Screen (`/screen/{id}`), Lift Report, watchers/orbit counts.
Screens: (merchant)/* — keep all four.

### Infrastructure (the thesis)
`agent_api`, `agent_dist` (assistant lanes), `feature_flags`, `alerts`/push,
`privacy`, `admin` (internal), `seed`/`venue_seeder` (ops), ambient_demo.

**Launch total: ~24 route modules, ~35 components.** That is the whole app.

---

## DARK — flag off, keep code (retention machinery for users who don't exist yet)

Social/crew: `crews`, `crew_battles`, `battles`, `rolling_deep`, `lobby`,
`vibe_quest`, `quests`, `quest_timeline`, `moments`, `resonance`, `stories`,
`timeline`, `after_party`.
Economy: `coins`, `reward_pools`, `subscriptions` (Vibe+), `bookings`,
`claims`, `certifications`.
Delight/lore: `cosmic` (zodiac), `dna`, `emoji_pulse`, `insider`,
`prediction`, `pioneer`, `momentum`, `forecast` (keep heuristic oracle only),
`intelligence`, `vibe_intel`, `dwell`, `kinetic` (server-side stays; UI dark).
AI extras: keep Night Planner + Vibe Brief only; dark `roast_toast`,
`dna_narrative`, `night_debrief`, `oracle_premium`.
Components going dark with them: ~90 (Crew*, Quest*, Moment*, Coin*,
Zodiac*, Cosmic*, DNA*, Story*, Booking*, Avatar*, Aura*, Battle*, Wave,
VibeMarket, VibePassport, VariableReward*, etc.)

**Mechanism:** the existing `feature_flags` system + one `LAUNCH_MODE=1` env
that forces the dark set off regardless of DB flags. No deletions — investors
buying the codebase get the full arsenal; users get the knife.

---

## DELETE — dead weight (no flag, just remove)

- `backend/server_legacy.py` — superseded
- `frontend/src/components/MockMap.tsx`, DemoTutorial/demo-data remnants once
  demo_mode flag is retired
- Repo root clutter: `_test.txt`, `_test2.py`, `_test3.txt`, `_ul`,
  `_venue_tabs.py`, `_surge_rewrite.py`, `_write_surge.cjs`,
  `tsc_errors.txt`, `tsc_output.txt`
- `backend_test*.py`, `*_merchant_test.py`, `focused_v3_test.py`,
  `detailed_test.py` at root (superseded by `backend/tests/`)
- Duplicate pitch artifacts (keep one canonical deck)

---

## OPTIMIZE — the launch-quality punch list

1. **First-run time-to-map < 10s**: onboarding = phone number + location grant
   + ONE tutorial card. Kill multi-step tutorials (AppTutorial 4 screens → 1).
2. **The 193 TS errors**: fix the duplicate `Venue` type (one canonical type in
   store/types), then the StyleProp noise — matters for build hygiene pre-sale.
3. **Map is the home**: (public)/index opens on the map with the strata band,
   not a feed. Trending/intel/crew tabs collapse to Map · Tonight · Profile.
4. **Thermal skin everywhere**: app still runs the old blue/purple neon in most
   components; migrate core five surfaces to the coal/ember system (Heat skin
   default for reactor).
5. **Payload diet**: `/api/venues` returns every field including audit trails;
   launch client needs ~12 fields. Add `?fields=map` slim projection.
6. **Error states**: every launch surface needs the honest-empty state ("quiet
   right now" not spinners) per the creed.

---

## Checklist (drives R0)

- [ ] `LAUNCH_MODE` env forces dark-set flags off (backend, one place)
- [ ] Tab bar reduced to Map · Tonight · Profile (+ Merchant for merchants)
- [ ] Onboarding compressed to one screen
- [ ] Dark components excluded from launch bundle (tree-shake via flag gate)
- [ ] Root clutter + legacy files deleted
- [ ] Canonical `Venue` type; TS error count < 20
- [ ] Thermal skin on the five launch surfaces
- [ ] Honest-empty states on map, venue, reactor
