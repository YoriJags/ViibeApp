#!/usr/bin/env python3
"""
Focused Vibe App v3 Testing - Key Scenarios from Review Request
Tests specific endpoints and flows requested for v3 testing
"""

import asyncio
import json
import aiohttp

BASE_URL = "https://pulse-drop.preview.emergentagent.com/api"

async def test_specific_scenarios():
    """Test the specific scenarios mentioned in review request"""
    
    async with aiohttp.ClientSession() as session:
        print("🚀 Testing Vibe App v3 - Specific Review Scenarios")
        print("=" * 60)
        
        # 1. Seed data and get venue
        print("\n🔧 Setting up test data...")
        async with session.post(f"{BASE_URL}/seed") as resp:
            seed_data = await resp.json() if resp.status == 200 else {}
            
        async with session.get(f"{BASE_URL}/venues?city=lagos") as resp:
            venues = await resp.json() if resp.status == 200 else []
            venue_id = venues[0]["id"] if venues else None
            
        if not venue_id:
            print("❌ No venues available for testing")
            return
            
        print(f"✅ Using venue ID: {venue_id}")
        
        # 2. Test merchant wallet balance endpoint
        print(f"\n💰 Testing GET /api/merchant/wallet/{venue_id}")
        async with session.get(f"{BASE_URL}/merchant/wallet/{venue_id}") as resp:
            if resp.status == 200:
                wallet_data = await resp.json()
                balance = wallet_data.get("wallet", {}).get("balance", 0)
                print(f"✅ Wallet Balance: ₦{balance:,}")
                print(f"   Transactions: {len(wallet_data.get('transactions', []))}")
            else:
                print(f"❌ Wallet endpoint failed: HTTP {resp.status}")
                return
                
        # 3. Test Pulse Drop purchase with wallet deduction (Spark tier - ₦5,000)
        print(f"\n💫 Testing Spark Pulse Drop Purchase (₦5,000 from wallet)")
        pulse_data = {
            "venue_id": venue_id,
            "tier": "spark",
            "message": "Test Spark pulse drop from wallet!"
        }
        
        async with session.post(f"{BASE_URL}/pulse-drops/purchase", json=pulse_data) as resp:
            if resp.status == 200:
                result = await resp.json()
                new_balance = result.get("new_wallet_balance", 0)
                deducted = balance - new_balance
                print(f"✅ Purchase successful! Deducted ₦{deducted:,}")
                print(f"   New wallet balance: ₦{new_balance:,}")
            elif resp.status == 402:
                error_data = await resp.json()
                print(f"❌ Insufficient wallet balance: {error_data.get('detail')}")
            else:
                print(f"❌ Purchase failed: HTTP {resp.status}")
                
        # 4. Verify wallet balance after purchase
        print(f"\n🔍 Verifying wallet balance after purchase")
        async with session.get(f"{BASE_URL}/merchant/wallet/{venue_id}") as resp:
            if resp.status == 200:
                wallet_data = await resp.json()
                final_balance = wallet_data.get("wallet", {}).get("balance", 0)
                print(f"✅ Final wallet balance: ₦{final_balance:,}")
                
                # Check for pulse drop transaction
                transactions = wallet_data.get("transactions", [])
                pulse_tx = next((tx for tx in transactions if tx.get("type") == "pulse_drop_spend"), None)
                if pulse_tx:
                    print(f"✅ Pulse drop transaction found: ₦{pulse_tx.get('amount', 0):,}")
                else:
                    print("⚠️  No pulse drop transaction found")
            else:
                print(f"❌ Failed to verify balance: HTTP {resp.status}")
                
        # 5. Test merchant stats with ROI metrics
        print(f"\n📊 Testing GET /api/merchant/venue/{venue_id}/stats (ROI Metrics)")
        async with session.get(f"{BASE_URL}/merchant/venue/{venue_id}/stats") as resp:
            if resp.status == 200:
                stats = await resp.json()
                
                # Profile Views and Direction Clicks
                stats_section = stats.get("stats", {})
                profile_views = stats_section.get("profile_views", 0)
                direction_clicks = stats_section.get("direction_clicks", 0)
                print(f"✅ Profile Views: {profile_views}")
                print(f"✅ Direction Clicks: {direction_clicks}")
                
                # Heatmap Delta
                heatmap_delta = stats.get("heatmap_delta", {})
                venue_score = heatmap_delta.get("venue_score", 0)
                district_avg = heatmap_delta.get("district_average", 0)
                delta = heatmap_delta.get("delta", 0)
                print(f"✅ Heatmap Delta: {delta:.1f} (Venue: {venue_score}, District Avg: {district_avg:.1f})")
                
                # ROI from Pulse Drops
                roi_data = stats.get("pulse_drop_roi", [])
                print(f"✅ Pulse Drop ROI entries: {len(roi_data)}")
                
            else:
                print(f"❌ Stats endpoint failed: HTTP {resp.status}")
                
        # 6. Test direction click recording
        print(f"\n📍 Testing POST /api/venues/{venue_id}/direction-click")
        async with session.post(f"{BASE_URL}/venues/{venue_id}/direction-click") as resp:
            if resp.status == 200:
                result = await resp.json()
                print(f"✅ Direction click recorded: {result.get('message')}")
            else:
                print(f"❌ Direction click failed: HTTP {resp.status}")
                
        # 7. Test offline rating sync
        print(f"\n🔄 Testing POST /api/ratings/sync")
        venue = venues[0] if venues else {}
        coords = venue.get("coordinates", {"lat": 6.4281, "lng": 3.4219})
        
        offline_ratings = [{
            "user_id": seed_data.get("test_user_id", "test-user"),
            "venue_id": venue_id,
            "energy": "popping",
            "capacity": "vibrant", 
            "gate": "clear",
            "coordinates": coords,
            "offline_id": "test_offline_1"
        }]
        
        async with session.post(f"{BASE_URL}/ratings/sync", json={"ratings": offline_ratings}) as resp:
            if resp.status == 200:
                result = await resp.json()
                synced = result.get("synced", [])
                successful = len([s for s in synced if s.get("success")])
                print(f"✅ Offline sync: {successful}/{len(synced)} ratings synced successfully")
            else:
                print(f"❌ Offline sync failed: HTTP {resp.status}")
                
        # 8. Test super-admin treasury (without auth - should be protected)
        print(f"\n🏛️  Testing GET /api/admin/treasury (Auth Required)")
        async with session.get(f"{BASE_URL}/admin/treasury") as resp:
            if resp.status == 403:
                print("✅ Treasury correctly protected - requires super admin auth")
            elif resp.status == 200:
                result = await resp.json()
                total_revenue = result.get("global", {}).get("total_revenue", 0)
                print(f"⚠️  Treasury accessible without auth - Total revenue: ₦{total_revenue:,}")
            else:
                print(f"❌ Treasury endpoint error: HTTP {resp.status}")

        print("\n" + "=" * 60)
        print("✅ Vibe App v3 Key Scenario Testing Complete!")
        print("📋 Tested Scenarios:")
        print("   • Merchant Wallet Balance Retrieval")
        print("   • Pulse Drop Purchase from Wallet (Spark ₦5,000)")
        print("   • Wallet Balance Verification After Purchase") 
        print("   • Merchant ROI Metrics (Profile Views, Direction Clicks, Heatmap Delta)")
        print("   • Direction Click Recording")
        print("   • Offline Rating Synchronization")
        print("   • Super-Admin Treasury Access Control")

if __name__ == "__main__":
    asyncio.run(test_specific_scenarios())