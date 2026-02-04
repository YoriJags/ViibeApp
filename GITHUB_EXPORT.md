# Vibe App - GitHub Export Guide

## Pre-Export Checklist

Before pushing to GitHub, ensure:

1. ✅ Remove any hardcoded API keys (none present)
2. ✅ `.env.example` files created for both backend and frontend
3. ✅ `README.md` with comprehensive documentation
4. ✅ Theme system modularized in `src/theme/`
5. ✅ Components isolated and documented

## Git Commands for Export

### Initialize Git Repository (if not already done)

```bash
cd /app

# Initialize git
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Environment files
.env
.env.local
.env.*.local

# Dependencies
node_modules/
__pycache__/
*.pyc
venv/
.venv/

# Build outputs
.expo/
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/

# Misc
*.local
EOF

# Add all files
git add .

# Create initial commit
git commit -m "feat: Vibe App v3 - Operationalized Nightlife Platform

Features:
- Dark-mode Lagos Heatmap with WebSocket updates
- 3-second Vibe Check with 50m geofence verification
- 2-rate limit per venue per 24h
- Multi-city support (Lagos, Abuja, Port Harcourt, Ibadan)
- Merchant Wallet with Paystack integration
- Pulse Drop tiers (Spark/Flare/Supernova)
- ROI metrics (Profile Views, Direction Clicks, Heatmap Delta)
- Offline-first rating sync
- GPS Lock verification animation
- Super-Admin Treasury dashboard
- Google OAuth via Emergent Auth

Tech Stack:
- Frontend: React Native (Expo)
- Backend: FastAPI (Python)
- Database: MongoDB
- Real-time: Socket.IO
- Payments: Paystack"
```

### Push to GitHub

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/vibe-app.git

# Push to main branch
git push -u origin main

# Or push to a new branch
git checkout -b v3-release
git push -u origin v3-release
```

### Using GitHub CLI (if installed)

```bash
# Create a new private repository and push
gh repo create vibe-app --private --source=. --push

# Or create a public repository
gh repo create vibe-app --public --source=. --push
```

## Post-Export Setup for Collaborators

After cloning, collaborators should:

### Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with actual values
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env
# Edit .env with actual values
yarn install
yarn start
```

## Branch Strategy (Recommended)

```
main          - Production-ready code
├── develop   - Integration branch
│   ├── feature/merchant-dashboard
│   ├── feature/admin-panel
│   └── feature/ui-animations
└── hotfix/*  - Emergency fixes
```

## Collaborator Permissions

For UI collaboration, grant access to:
- `src/theme/` - Design tokens and styles
- `src/components/` - Reusable components
- `app/` - Screen implementations

Keep protected:
- `server.py` - Backend logic
- `.env*` files - Sensitive data

---

Generated: $(date)
Version: 3.0
