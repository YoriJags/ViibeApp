# VIIBE — Scene Intelligence Platform | PRD

## Original Problem Statement
User (Oluwaseun Oluyori Ajagun, CEO/CTO of VIIBE) has built a full scene intelligence mobile app (React Native + FastAPI + MongoDB) deployed on Railway/Vercel. They requested optimization across codebase, product strategy, pitch, and go-to-market. The VIIBE app has 474+ commits, 16+ algorithms, 8 Reactor Skins, Agent API, and is solo-built.

## Architecture
- **Mobile App**: React Native (Expo 54), FastAPI backend, MongoDB, Socket.IO
- **Web Landing Page** (this build): React (CRA + Tailwind), FastAPI, MongoDB
- **Deployment**: Mobile on Railway + Vercel | Landing page on Emergent

## What's Been Implemented

### Landing Page & Web Presence (March 20, 2026)
- Premium landing page with Bloomberg Terminal x Lagos nightlife aesthetic
- Sections: Hero (Lagos Pulse + live terminal widget), Problem, Product Showcase (Bento grid), Agent API terminal, Waitlist, Footer
- Typography: Unbounded (headlines) + JetBrains Mono (body/data)
- Color: Deep black (#050505), Electric Cyan (#00F0FF), Hot Coral (#FF3366), Gold (#FFD700)

### Investor Pitch Deck (March 20, 2026)
- 9-slide presentation at /pitch route with terminal aesthetic
- Slides: Title, Problem, Breakthrough, Product, Live Data, Business, Market, Moat, Ask
- Keyboard navigation, click zones, progress dots
- Live Data slide fetches real API data during presentation

### Lagos Heat Map (March 20, 2026)
- SVG-based tactical map of Victoria Island, Ikoyi, and Lekki Phase 1
- 10 venue dots positioned by real lat/lng coordinates
- Color-coded by energy state with animated pulsing glow halos

### VibeReactor Full-Screen Modal (March 20, 2026)
- Full-screen Canvas-based animation system with 4 skins
- Energy slider, venue selector, skin navigation
- Live city-wide energy score widget

### Social Sharing Cards / OG Meta Tags (March 20, 2026)
- Open Graph meta tags (og:title, og:description, og:image, og:site_name)
- Twitter Card meta tags (summary_large_image)
- Custom branded OG share image (1536x1024) — deep black + cyan glow + VIIBE branding
- Links shared on social now display premium preview cards

### "I Was There" Receipt Generator (March 20, 2026)
- `/receipt` route with venue selection form
- Backend POST /api/receipt/generate returns styled receipt data
- Receipt card shows: venue name, energy score, energy state, capacity, scout name, checkout time
- Download as PNG (via html2canvas) and Share to Twitter functionality
- Terminal-aesthetic receipt with dashed borders, VIIBE branding, star rating

### Weekly Scene Report (March 20, 2026)
- `/report` route pulling live data from GET /api/report/weekly
- Stats grid: venues tracked, avg energy, active scouts, peak night
- Energy distribution tier bars (electric/warming/quiet)
- Top 5 and coldest 3 venues ranked by score
- District energy breakdown (Victoria Island, Ikoyi, Lekki Phase 1)
- Category breakdown (nightclub, lounge, restaurant, bar, event_space)
- Trending venues list
- Share to X button

### Press Kit Page (March 20, 2026)
- `/press` route with comprehensive brand & media information
- One-liner, key stats (474+ commits, 16+ algorithms, 8 skins)
- Founder bio (Oluwaseun Oluyori Ajagun, CEO/CTO)
- The Story: Problem, Solution, Business sections
- Brand colors palette (6 colors)
- Typography guide (Unbounded + JetBrains Mono)
- Logo on dark/light backgrounds
- Quick links to Pitch Deck, API Docs, Weekly Report
- Media contact information

### Backend (Waitlist + Agent API + New Endpoints)
- POST /api/waitlist — email signup with role, duplicate prevention
- GET /api/waitlist/stats — waitlist analytics
- GET /api/v1/agent/venues/live — top venues by energy score
- GET /api/v1/agent/venues/{id} — single venue snapshot
- GET /api/v1/agent/city/pulse — city-level energy summary
- POST /api/receipt/generate — receipt generator
- GET /api/report/weekly — weekly scene report data
- Auto-seeded 10 real Lagos venues

### API Documentation Portal (March 20, 2026)
- Full /docs page with 3 endpoints documented
- Live "Try it" buttons hitting real backend
- Curl command copy, code snippets

### Testing
- Iteration 5: Backend 100% (16/16), Frontend 100%
- All backend tests: /app/backend/tests/test_viibe_api.py

## User Personas
1. **Scouts** (18-35 Lagos nightlife-goers) — want real-time venue energy data
2. **Venue Owners** — want live analytics and campaigns
3. **Developers/AI Companies** — want to integrate Agent API
4. **Investors** — evaluating pre-seed opportunity

## Core Requirements (Static)
- Real-time crowd energy measurement at venues
- Scout rating system (geofenced, time-decayed)
- Merchant analytics dashboard
- Agent API for AI assistant integration
- Waitlist for go-to-market launch

## Prioritized Backlog

### P0 — Critical for Launch
- [ ] TestFlight build deployed to founding scouts
- [ ] 5 anchor Lagos venue partnerships
- [ ] Waitlist to 100+ signups

### P1 — Near-term
- [x] Landing page SEO + social meta tags
- [ ] 90-second demo video
- [ ] ChatGPT Actions registration for Agent API
- [ ] Mobile app optimizations (lazy skin loading, Android profiling)

### P2 — Growth
- [ ] Backend modularization (split server.py into routes/services/models)
- [ ] MongoDB compound indexes for query performance
- [ ] Redis adapter for Socket.IO horizontal scaling
- [ ] Progressive feature disclosure in mobile app

## Next Tasks
1. Record + post demo video from demo mode
2. Deploy TestFlight build
3. Walk into 3 VI/Lekki venues with phone demo
4. Register Agent API as ChatGPT Action
