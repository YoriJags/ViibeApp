# VIIBE — Scene Intelligence Platform | PRD

## Original Problem Statement
User (Oluwaseun Oluyori Ajagun, CEO/CTO of VIIBE) has built a full scene intelligence mobile app (React Native + FastAPI + MongoDB) deployed on Railway/Vercel. They requested optimization across codebase, product strategy, pitch, and go-to-market. The VIIBE app has 474+ commits, 16+ algorithms, 8 Reactor Skins, Agent API, and is solo-built.

## Architecture
- **Mobile App**: React Native (Expo 54), FastAPI backend, MongoDB, Socket.IO
- **Web Landing Page** (this build): React (CRA + Tailwind), FastAPI, MongoDB
- **Deployment**: Mobile on Railway + Vercel | Landing page on Emergent
- **Production site**: https://vibe-app-theta.vercel.app

## What's Been Implemented

### Landing Page (Matches Vercel Design — March 20, 2026)
- Exact replica of Vercel production design with all buttons WORKING
- Hero: "The city has a pulse." with live feed terminal + stat boxes
- Problem: "Going out is a gamble." with Google Maps/Social Media/WhatsApp comparison cards
- Product: Scout Floor + Merchant Floor + Agent API bento grid, Demo Reactor button
- Agent API terminal: Live curl request/response (actually returns real data)
- Waitlist: Role selector (Scout/Venue Owner/Developer) + email + Join button → MongoDB
- Footer: Brand + Product links + Connect (email + Vercel URL)
- All navigation scroll links work, all buttons click

### Social Sharing Cards / OG Meta Tags (March 20, 2026)
- Open Graph + Twitter Card meta tags in index.html
- Custom branded OG share image

### "I Was There" Receipt Generator (March 20, 2026)
- `/receipt` route, POST /api/receipt/generate endpoint
- Downloadable + shareable venue checkout cards

### Weekly Scene Report (March 20, 2026)
- `/report` route, GET /api/report/weekly endpoint
- Auto-generated Lagos scene report with stats, rankings, trends

### Press Kit Page (March 20, 2026)
- `/press` route with brand assets, stats, founder bio, story, colors, typography

### Investor Pitch Deck (March 20, 2026)
- `/pitch` 9-slide interactive presentation

### VibeReactor Full-Screen Modal (March 20, 2026)
- 4 skins, energy slider, venue selector, Canvas animations

### Backend
- POST /api/waitlist, GET /api/waitlist/stats
- GET /api/v1/agent/venues/live, GET /api/v1/agent/venues/{id}, GET /api/v1/agent/city/pulse
- POST /api/receipt/generate, GET /api/report/weekly
- 10 seeded Lagos venues

## Key Design Note
VIIBE is **scene-centric** (not nightlife-only). Measures energy wherever people gather: clubs, restaurants, events, markets, beaches, festivals — any scene.

## Prioritized Backlog

### P0 — Critical
- [ ] TestFlight build for founding scouts
- [ ] 5 anchor Lagos venue partnerships
- [ ] Waitlist to 100+ signups

### P1 — Near-term
- [x] Landing page SEO + social meta tags
- [x] Landing page design match with Vercel production
- [ ] 90-second demo video
- [ ] ChatGPT Actions registration for Agent API

### P2 — Growth
- [ ] Backend modularization
- [ ] MongoDB compound indexes
- [ ] Redis adapter for Socket.IO scaling
