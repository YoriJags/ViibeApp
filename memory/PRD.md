# Vibe Scout - Nightlife Intelligence App

## Product Overview
A nightlife intelligence platform connecting nightlife enthusiasts ("Scouts") with venues in Lagos and other Nigerian cities. The app provides real-time crowd data, venue discovery, and a merit-based reputation system.

## Core Features

### B2C (Public Floor)
- **Live Map**: Custom "Midnight Premium" themed map with venue markers showing energy scores
- **Trending Page**: Top venues list with "Top 3 Podium" design, sponsored venues section
- **Venue Detail Cards**: Glassmorphism UI with stats (Entry Fee, Music Genre, Table Availability), "Live Look" thumbnails, "GET DIRECTIONS" button
- **Rating System**: "Rate the Vibe" modal with 50m geofence enforcement, confetti success animation
- **Scout Trust System**: Clout-based reputation system, verified scout badges, tier progression (newbie/regular/scout/elite)

### B2B (Merchant Floor)
- **Merchant Dashboard**: Private dashboard for venue owners to manage venue content and trigger Pulse Drops
- **Pulse Drop System**: Tiered promotion system (Spark/Flare/Supernova) with 2x clout bonus for check-ins

### Admin Floor
- **Treasury Ledger**: Pulse Drop revenue tracking with Most Purchased Tiers chart
- **User Analytics**: Active vs Ghost users, tier distribution
- **Integrity Monitor**: Sponsored vs organic venue comparison, health status alerts
- **Clout Economy**: Total circulation, top scouts leaderboard, airdrop functionality
- **Demo Mode Toggle**: Pre-populated mock data for showcasing platform to merchants
- **Demo Walkthrough**: Auto-highlighting tour with tooltips for first-time visitors
- **Theme**: Royal Blue and Slate (Professional/Power aesthetic)

## Tech Stack
- **Frontend**: React Native (Expo), TypeScript, Zustand (state management), React Native Reanimated
- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: MongoDB
- **UI Libraries**: expo-blur, react-native-confetti-cannon, Ionicons

## What's Been Implemented (As of Feb 6, 2026)

### Completed Features
- [x] Trending Page UI with "Top 3 Podium" and sponsored venue separation
- [x] Live Map with custom markers, "Midnight Premium" theme
- [x] "Pull Up" button navigation from Trending to Map
- [x] Venue Detail Card with glassmorphism UI, stats, "GET DIRECTIONS"
- [x] Rate Vibe Modal with geofence check
- [x] Post-rating success animation and map glow effect
- [x] Merchant Dashboard (frontend + backend)
- [x] Admin Analytics Dashboard with Treasury/Venues/Users/Logs tabs
- [x] **Demo Mode Toggle** for admin dashboard with realistic mock data
- [x] **Demo Walkthrough** - 6-step guided tour with spotlight and tooltips
- [x] Backend endpoints for all admin features
- [x] Auth persistence using Zustand persist middleware
- [x] Scrolling fixes for Trending and Venue Detail pages

### Demo Mode Data
Demo mode showcases the platform potential with sample data:
- **Revenue**: ₦2.8M total, ₦185K today
- **Users**: 8,432 total, 2,156 active (24h), 15% ghost users
- **Venues**: 156 total, 89 verified, 23 sponsored
- **Top Scouts**: NightOwlKing (12,450 clout), LagosVibeCheck (9,870 clout), etc.
- **Pulse Drops**: Recent transactions from Quilox, Club 57, Skybar Lagos

### Backend API Endpoints
- `GET /api/admin/treasury` - Treasury analytics
- `GET /api/admin/user-analytics` - User statistics
- `GET /api/admin/integrity-monitor` - Sponsored vs organic comparison
- `GET /api/admin/clout-economy` - Clout circulation data
- `GET /api/admin/pulse-ledger` - Transaction history
- `POST /api/admin/clout-airdrop` - Distribute bonus clout

## Known Limitations
- Web preview has limited functionality due to Expo/React Native browser constraints
- Full testing requires mobile device or emulator

## Architecture

```
/app
├── backend/
│   └── server.py          # FastAPI backend with all endpoints
├── frontend/
│   ├── app/
│   │   ├── (admin)/
│   │   │   └── index.tsx  # Admin Analytics Dashboard with Demo Mode
│   │   ├── (merchant)/
│   │   │   └── dashboard.tsx
│   │   ├── (public)/
│   │   │   └── trending.tsx
│   │   └── venue/
│   │       └── [id].tsx
│   └── src/
│       ├── store/
│       │   └── vibeStore.ts  # Zustand with persist
│       └── theme/
│           └── floors.ts     # 3-floor theme system
```

## Credentials for Testing
- Admin User ID: `b4903974-2ed8-4c15-8273-cc7f2a2dab4f`
- Test User ID: `01752f93-e11a-4753-8a26-8a9b03efdb77`
- Backend URL: `https://venue-pulse-13.preview.emergentagent.com`
