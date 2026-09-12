# Documentation map

The story was living in twelve files with six competing pitch decks, two of them
still branded VIBEZ. That is why the pitch stopped landing. This index says which
file is authoritative for what, so there is exactly one place to look and one
place to edit.

## Canonical (edit these)

| File | Owns |
|---|---|
| [`IDENTITY.md`](../IDENTITY.md) | **What VIIBE is.** The one line, the three layers, what to say to whom. Everything defers to this. |
| [`PLAN.md`](../PLAN.md) | Build plan, phases, and the Friday Corridor rollout to the 10/10 milestone. |
| [`docs/LAUNCH_AUDIT.md`](LAUNCH_AUDIT.md) | What ships at launch, what stays dark, what gets deleted. |
| [`docs/PITCH_DECK.md`](PITCH_DECK.md) | The investor deck. |
| [`docs/FINANCIAL_MODEL.md`](FINANCIAL_MODEL.md) | The numbers. |
| [`docs/ENERGY.md`](ENERGY.md) | **What Energy means.** The definition, the scale, the blend, decay, and the honest limits. Every score and slide defers to it. |
| [`docs/ASSISTANTS.md`](ASSISTANTS.md) | Siri / ChatGPT / Claude / Gemini integration state and steps. |
| [`APP_FEATURES.md`](../APP_FEATURES.md) | Feature reference for what exists in the app. |

## Superseded (do not cite, do not edit)

| File | Why |
|---|---|
| `PITCH_DECK.md` (repo root) | Older deck, still branded **VIBEZ**. Replaced by `docs/PITCH_DECK.md`. |
| `PITCH_DECK*.html`, `PITCH_DECK_EMERGENT.html`, `PITCH_DECK_INVESTOR.html` | Exported snapshots of earlier decks. Historical only. |
| `CLOUT_SPEC.md` | Still branded **VIBEZ**. Needs a rewrite or retirement before it is quoted anywhere. |
| `GITHUB_EXPORT.md` | Setup notes from the original export. Stale. |
| `test_result.md` | Machine-written test log, not documentation. |

## Aspirational (label it as such when sharing)

| File | Note |
|---|---|
| `VIBEAPP_STRATEGY_BLUEPRINT.md` | The $250M exit thesis. A destination, not evidence. Never hand it to an investor in place of the corridor numbers. |
| `DEMO_VIDEO_SCRIPT.md` | Script for the 2 minute demo video. |

## Live surfaces (not files)

| Surface | URL |
|---|---|
| Public site | https://landing-site-nu-five.vercel.app |
| Investor brief | https://landing-site-nu-five.vercel.app/investors |
| Venue Big Screen | `{API}/screen/{venue_id}` |
| API | https://vibeapp-production-1835.up.railway.app |

## Rule

New doc? It either replaces something in the canonical table or it does not get
written. The reason the pitch was hard to say out loud was that it had twelve
authors and no editor.
