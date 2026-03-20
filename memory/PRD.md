# VIIBE — Scene Intelligence Platform | PRD

## Original Problem Statement
User (Oluwaseun Oluyori Ajagun, CEO/CTO of VIIBE) has built a full scene intelligence mobile app (React Native + FastAPI + MongoDB) deployed on Railway/Vercel. They requested optimization across codebase, product strategy, pitch, and go-to-market. The VIIBE app has 474+ commits, 16+ algorithms, 8 Reactor Skins, Agent API, and is solo-built.

## Architecture
- **Mobile App**: React Native (Expo 54), FastAPI backend, MongoDB, Socket.IO
- **Web Landing Page** (this build): React (CRA + Tailwind), FastAPI, MongoDB
- **Deployment**: Mobile on Railway + Vercel | Landing page on Emergent

## What's Been Implemented (March 20, 2026)

### Landing Page & Web Presence
- Premium landing page with Bloomberg Terminal × Lagos nightlife aesthetic
- Sections: Hero (live terminal widget), Problem, Product Showcase (Bento grid), Agent API terminal, Waitlist, Footer
- Typography: Unbounded (headlines) + JetBrains Mono (body/data)
- Color: Deep black (#050505), Electric Cyan (#00F0FF), Hot Coral (#FF3366), Gold (#FFD700)

### Backend (Waitlist + Agent API)
- POST /api/waitlist — email signup with role (scout/venue_owner/developer), duplicate prevention
- GET /api/waitlist/stats — waitlist analytics
- GET /api/v1/agent/venues/live — top venues by energy score
- GET /api/v1/agent/venues/{id} — single venue snapshot
- GET /api/v1/agent/city/pulse — city-level energy summary
- Auto-seeded 10 real Lagos venues (Quilox, Escape, Shiro, etc.)

### API Documentation Portal
- Full /docs page with 3 endpoints documented
- Live "Try it" buttons hitting real backend
- Curl command copy, code snippets

### Testing
- All backend tests: 100% (9/9 endpoints)
- All frontend tests: 100% (14/14 features)

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
- [ ] Landing page SEO + social meta tags
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
