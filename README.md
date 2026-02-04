# Vibe App - Nigeria's Real-Time Nightlife Platform

<p align="center">
  <img src="./docs/vibe-logo.png" alt="Vibe Logo" width="120" />
</p>

**Vibe** is a high-velocity, real-time nightlife "Stock Market" for Nigeria. Users can discover trending venues, rate the vibe, and receive flash deals. Venue owners can boost visibility through Pulse Drops and track ROI metrics.

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Quick Start](#quick-start)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Paystack Integration](#paystack-integration)
7. [Socket.IO Events](#socketio-events)
8. [API Documentation](#api-documentation)
9. [Contributing](#contributing)

---

## Features

### Consumer Features
- **Dark-Mode Heatmap**: Venues glow based on real-time vibe scores (Blue → Purple → Orange → Red)
- **3-Second Vibe Check**: Geofenced (50m) rating system for Energy, Capacity, and Gate status
- **2-Rate Limit**: Maximum 2 ratings per venue per 24 hours (second overwrites first)
- **Live Leaderboard**: Real-time trending with 15-minute time-decay algorithm
- **Multi-City Support**: Lagos, Abuja, Port Harcourt, Ibadan
- **Scout System**: Earn Clout points for accurate ratings

### Merchant Features
- **Merchant Wallet**: Pre-fund account via Paystack for instant purchases
- **Pulse Drop Tiers**:
  - **Spark** (₦5,000): 2km radius + 20% glow boost, 2 hours
  - **Flare** (₦15,000): 5km radius + Top 3 chart placement, 4 hours
  - **Supernova** (₦50,000): City-wide + #1 Trending, 8 hours
- **ROI Metrics**: Profile Views, Direction Clicks, Heatmap Delta
- **Competition Tracking**: Compare against district average

### Admin Features
- **Revenue Heatmap**: Track ad-spend by city
- **Network Health**: Monitor Socket.IO connections
- **Data Freshness**: % of ratings <15 minutes old
- **Venue Verification**: Approve/deny merchant status
- **Vibe Override**: Anti-spam manual controls

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native (Expo) |
| Backend | FastAPI (Python) |
| Database | MongoDB |
| Real-time | Socket.IO |
| Payments | Paystack |
| Auth | Emergent Google OAuth |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/vibe-app.git
cd vibe-app

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# In another terminal, install frontend dependencies
cd ../frontend
yarn install

# Start Expo
yarn start
```

---

## Backend Setup

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure the following:

```env
# MongoDB Connection
MONGO_URL=mongodb://localhost:27017
DB_NAME=vibe_app

# Paystack Integration
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
```

### Running the Server

```bash
cd backend

# Development (with auto-reload)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Production
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
```

### Seeding Data

```bash
curl -X POST http://localhost:8001/api/seed
```

This creates 10 Lagos venues with starting wallet balances for testing.

---

## Frontend Setup

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
```

### Running Expo

```bash
cd frontend

# Start Metro bundler
yarn start

# Or run on specific platform
yarn ios     # iOS Simulator
yarn android # Android Emulator
yarn web     # Web browser
```

### Theme Customization

All design tokens are in `src/theme/index.ts`:

```typescript
// Change brand colors
export const colors = {
  primary: '#FF3366',      // Main accent
  secondary: '#9933FF',    // Secondary accent
  // ...
};

// Update typography
export const typography = {
  fontFamily: {
    regular: 'YourCustomFont',
    bold: 'YourCustomFont-Bold',
  },
  // ...
};
```

---

## Paystack Integration

### Wallet Top-Up Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Merchant App   │────>│  /topup/initialize│────>│ Paystack WebView│
│  (Top Up Btn)   │     │  Returns auth_url │     │  Payment Form   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          v
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Wallet Updated │<────│  /wallet/verify  │<────│  Redirect Back  │
│  Balance Shows  │     │  Credits Balance │     │  with Reference │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### API Flow:

1. **Initialize Payment**:
   ```bash
   POST /api/merchant/wallet/{venue_id}/topup/initialize
   {
     "amount": 50000,
     "email": "merchant@venue.com"
   }
   ```
   Returns: `{ "authorization_url": "https://checkout.paystack.com/...", "reference": "VIBE-TOPUP-..." }`

2. **Open WebView** with `authorization_url`

3. **Verify on Redirect**:
   ```bash
   POST /api/merchant/wallet/verify/{reference}
   ```
   Returns: `{ "success": true, "new_balance": 75000 }`

### Webhook Handler

Set your Paystack webhook URL to:
```
https://your-domain.com/api/webhook/paystack
```

The webhook automatically verifies and credits wallets.

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_city` | `{ city: "lagos" }` | Join city room for updates |
| `join_venue` | `{ venue_id: "..." }` | Join specific venue room |
| `subscribe_leaderboard` | `{ city: "lagos" }` | Subscribe to leaderboard updates |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `venue_update` | Venue object | Real-time venue data change |
| `leaderboard_update` | Leaderboard array | Updated rankings |
| `pulse_drop` | `{ drop, venue, tier }` | New Pulse Drop notification |
| `connection_status` | `{ status, total_connections }` | Connection info |

### Example: Binding Live Chart to State

```typescript
import { io } from 'socket.io-client';
import { useVibeStore } from './store/vibeStore';

const socket = io(API_URL);

// Subscribe to leaderboard
socket.emit('subscribe_leaderboard', { city: 'lagos' });

// Listen for updates
socket.on('venue_update', (venue) => {
  useVibeStore.getState().updateVenue(venue);
});

socket.on('leaderboard_update', (leaderboard) => {
  const venues = leaderboard.map(entry => entry.venue);
  useVibeStore.getState().setVenues(venues);
});

socket.on('pulse_drop', (data) => {
  // Show notification
  Alert.alert(
    `🔥 ${data.tier.name} Drop!`,
    `${data.venue.name}: ${data.drop.message}`
  );
});
```

---

## API Documentation

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/venues` | List all venues (filter by `?city=lagos`) |
| GET | `/api/venues/{id}` | Get venue details |
| POST | `/api/ratings` | Submit a rating (geofence required) |
| GET | `/api/leaderboard` | Get live leaderboard |
| GET | `/api/cities` | Get available cities |

### Merchant Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchant/wallet/{venue_id}` | Get wallet balance |
| POST | `/api/merchant/wallet/{venue_id}/topup/initialize` | Start Paystack payment |
| POST | `/api/merchant/wallet/verify/{reference}` | Verify payment |
| POST | `/api/pulse-drops/purchase` | Buy Pulse Drop from wallet |
| GET | `/api/merchant/venue/{venue_id}/stats` | Get ROI metrics |

### Admin Endpoints (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/treasury` | Global revenue stats |
| GET | `/api/admin/venues` | Manage all venues |
| POST | `/api/admin/venue/{id}/verify` | Verify/unverify venue |
| POST | `/api/admin/venue/{id}/override` | Apply vibe override |
| PUT | `/api/admin/pulse-drop-pricing` | Update tier prices |

---

## Project Structure

```
vibe-app/
├── backend/
│   ├── server.py           # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   ├── .env               # Environment variables
│   └── .env.example       # Template
│
├── frontend/
│   ├── app/               # Expo Router screens
│   │   ├── (tabs)/       # Tab navigation
│   │   │   ├── index.tsx # Map/Home
│   │   │   ├── leaderboard.tsx
│   │   │   ├── pulse.tsx
│   │   │   └── profile.tsx
│   │   ├── venue/[id].tsx # Venue detail
│   │   └── rate/[id].tsx  # Rating screen
│   │
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   │   ├── PulseDropSelector.tsx
│   │   │   ├── VibeMeter.tsx
│   │   │   └── GPSLockIndicator.tsx
│   │   ├── store/         # Zustand state
│   │   │   └── vibeStore.ts
│   │   └── theme/         # Design system
│   │       ├── index.ts   # Tokens
│   │       └── styles.ts  # Common styles
│   │
│   ├── .env              # Environment variables
│   └── .env.example      # Template
│
└── README.md
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

MIT License - see LICENSE file for details.

---

## Support

For issues or questions, please open a GitHub issue or contact the team.

**Built with ❤️ for Lagos nightlife**
