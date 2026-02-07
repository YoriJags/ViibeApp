# Vibe Scout Backend API

FastAPI backend for the Vibe Scout nightlife intelligence app.

## Vercel Deployment

This backend is configured for Vercel serverless deployment.

### Environment Variables Required

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `DB_NAME` | Database name | `vibe_app` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (optional) | `sk_test_xxx` |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key (optional) | `pk_test_xxx` |

### Deployment Steps

1. Push code to GitHub
2. Connect repository to Vercel
3. Set **Base Directory** to `backend`
4. Add environment variables
5. Deploy!

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/venues` - List venues
- `GET /api/venues/{id}` - Get venue details
- `GET /api/trending/{city}` - Get trending venues
- `GET /api/top-scouts/{city}` - Get top scouts
- `POST /api/users` - Create user
- `POST /api/ratings` - Submit rating
- `GET /api/cities` - List supported cities

### Admin Endpoints (requires X-User-Id header with super admin)

- `GET /api/admin/treasury` - Revenue analytics
- `GET /api/admin/user-analytics` - User statistics
- `GET /api/admin/integrity-monitor` - Sponsored vs organic comparison
- `GET /api/admin/clout-economy` - Clout circulation data
- `POST /api/admin/clout-airdrop` - Distribute bonus clout
