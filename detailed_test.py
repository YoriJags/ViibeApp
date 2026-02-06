#!/usr/bin/env python3
"""
Detailed scenario testing for specific Vibe App features
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://vibe-scout.preview.emergentagent.com/api"

async def test_specific_scenarios():
    """Test specific scenarios from the review request"""
    
    async with aiohttp.ClientSession() as session:
        print("🔍 Running Detailed Scenario Tests")
        print("=" * 50)
        
        # Get fresh test data
        async with session.post(f"{BASE_URL}/seed") as resp:
            if resp.status == 200:
                seed_data = await resp.json()
                test_user_id = seed_data.get("test_user_id")
                print(f"✅ Fresh test data seeded - User ID: {test_user_id}")
            else:
                print(f"❌ Failed to seed data: {resp.status}")
                return
        
        # Get test venues
        async with session.get(f"{BASE_URL}/venues?city=lagos") as resp:
            venues = await resp.json()
            test_venue = venues[0] if venues else None
        
        if not test_venue:
            print("❌ No test venues available")
            return
        
        # 1. Test Fast Pass 10%/90% split verification
        print("\n💰 Verifying Fast Pass Fee Split")
        fp_venue = next((v for v in venues if v.get("fast_pass_enabled")), None)
        if fp_venue:
            purchase_data = {
                "user_id": test_user_id,
                "venue_id": fp_venue["id"]
            }
            
            async with session.post(f"{BASE_URL}/fast-pass/purchase", json=purchase_data) as resp:
                if resp.status == 200:
                    purchase = await resp.json()
                    price = purchase.get("price", 0)
                    platform_fee = purchase.get("platform_fee", 0) 
                    venue_share = purchase.get("venue_share", 0)
                    
                    platform_pct = (platform_fee / price * 100) if price > 0 else 0
                    venue_pct = (venue_share / price * 100) if price > 0 else 0
                    
                    print(f"   Price: ₦{price:,.0f}")
                    print(f"   Platform Fee: ₦{platform_fee:,.0f} ({platform_pct:.1f}%)")
                    print(f"   Venue Share: ₦{venue_share:,.0f} ({venue_pct:.1f}%)")
                    print(f"   ✅ Fee split correct: {abs(platform_pct - 10) < 0.1 and abs(venue_pct - 90) < 0.1}")
        
        # 2. Test Pulse Drop tier effects
        print("\n✨ Verifying Pulse Drop Tier Effects")
        async with session.get(f"{BASE_URL}/pulse-drops/tiers") as resp:
            tiers = await resp.json()
            
            for tier_name, tier_config in tiers.items():
                print(f"   {tier_name.upper()}:")
                print(f"     Price: ₦{tier_config.get('price', 0):,}")
                print(f"     Glow Boost: +{tier_config.get('glow_boost', 0)}")
                print(f"     Radius: {tier_config.get('radius_km', 0)}km") 
                print(f"     Duration: {tier_config.get('duration_hours', 0)}h")
                if tier_config.get('chart_placement'):
                    print(f"     Chart Placement: #{tier_config.get('chart_placement')}")
        
        # Test pulse drop purchase with tier effects
        pulse_data = {
            "venue_id": test_venue["id"],
            "tier": "flare",
            "message": "Testing Flare tier effects"
        }
        
        async with session.post(f"{BASE_URL}/pulse-drops/purchase", json=pulse_data) as resp:
            if resp.status == 200:
                result = await resp.json()
                print(f"\n   FLARE Pulse Drop Activated:")
                print(f"     Glow Boost Applied: +{result.get('glow_boost', 0)}")
                print(f"     Chart Placement: #{result.get('chart_placement', 'None')}")
                print(f"     Radius: {result.get('radius_km', 0)}km")
        
        # 3. Test rating geofence precision
        print("\n📍 Testing 50m Geofence Precision")
        venue_coords = test_venue["coordinates"]
        
        # Test distances: 25m (pass), 75m (fail)
        test_distances = [
            (0.0002, "~25m", True),   # Should pass
            (0.0007, "~75m", False)   # Should fail
        ]
        
        for offset, distance_desc, should_pass in test_distances:
            rating_data = {
                "user_id": test_user_id,
                "venue_id": test_venue["id"],
                "energy": "popping",
                "capacity": "vibrant",
                "gate": "clear",
                "coordinates": {
                    "lat": venue_coords["lat"] + offset,
                    "lng": venue_coords["lng"] + offset
                }
            }
            
            async with session.post(f"{BASE_URL}/ratings", json=rating_data) as resp:
                success = resp.status == 200
                expected = should_pass
                result = "✅" if success == expected else "❌"
                print(f"   {distance_desc} from venue: {result} {'Allowed' if success else 'Blocked'}")
        
        # 4. Test multi-city venue isolation
        print("\n🏙️ Testing Multi-City Venue Isolation")
        cities = ["lagos", "abuja", "port_harcourt", "ibadan"]
        
        for city in cities:
            async with session.get(f"{BASE_URL}/venues?city={city}") as resp:
                city_venues = await resp.json()
                all_correct_city = all(v.get("city") == city for v in city_venues)
                print(f"   {city.upper()}: {len(city_venues)} venues, isolation: {'✅' if all_correct_city else '❌'}")
        
        # 5. Test leaderboard with pulse drops
        print("\n🏆 Testing Leaderboard with Pulse Drop Priority")
        async with session.get(f"{BASE_URL}/leaderboard?city=lagos") as resp:
            if resp.status == 200:
                leaderboard = await resp.json()
                
                # Check if venues with active pulse drops are prioritized
                pulse_boosted = []
                regular_venues = []
                
                for item in leaderboard:
                    if item["venue"].get("active_pulse_tier"):
                        pulse_boosted.append(item)
                    else:
                        regular_venues.append(item)
                
                print(f"   Pulse-boosted venues: {len(pulse_boosted)}")
                print(f"   Regular venues: {len(regular_venues)}")
                
                if pulse_boosted:
                    top_venue = leaderboard[0]["venue"]
                    print(f"   Top venue has pulse: {'✅' if top_venue.get('active_pulse_tier') else '❌'}")
        
        print("\n✨ Detailed scenario testing complete!")

if __name__ == "__main__":
    asyncio.run(test_specific_scenarios())