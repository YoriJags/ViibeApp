#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Vibe App
Tests all core API endpoints focusing on multi-city support, ratings, fast pass, pulse drops
"""

import asyncio
import json
import sys
from datetime import datetime, timezone, timedelta
import aiohttp
import time

# Use the actual backend URL from environment
BASE_URL = "https://pulse-drop.preview.emergentagent.com/api"

class VibeAppTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = None
        self.test_user_id = None
        self.test_venues = []
        self.results = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "critical_failures": [],
            "test_details": []
        }

    async def setup(self):
        """Initialize HTTP session and seed data"""
        self.session = aiohttp.ClientSession()
        print(f"🔧 Setting up tests for {self.base_url}")
        
        # Seed test data
        try:
            async with self.session.post(f"{self.base_url}/seed") as resp:
                if resp.status == 200:
                    seed_data = await resp.json()
                    self.test_user_id = seed_data.get("test_user_id")
                    print(f"✅ Test data seeded - User ID: {self.test_user_id}")
                    return True
                else:
                    print(f"❌ Failed to seed data: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Seed setup failed: {e}")
            return False

    async def cleanup(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()

    def log_test(self, name, passed, details=None, critical=False):
        """Log test result"""
        self.results["total_tests"] += 1
        if passed:
            self.results["passed"] += 1
            print(f"✅ {name}")
        else:
            self.results["failed"] += 1
            print(f"❌ {name}")
            if details:
                print(f"   Details: {details}")
            if critical:
                self.results["critical_failures"].append(f"{name}: {details}")
        
        self.results["test_details"].append({
            "test": name,
            "passed": passed,
            "details": details,
            "critical": critical
        })

    async def test_api_health(self):
        """Test basic API connectivity"""
        try:
            async with self.session.get(f"{self.base_url}/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.log_test("API Health Check", True, f"Status: {data.get('status')}")
                    return True
                else:
                    self.log_test("API Health Check", False, f"HTTP {resp.status}", critical=True)
                    return False
        except Exception as e:
            self.log_test("API Health Check", False, str(e), critical=True)
            return False

    async def test_multi_city_support(self):
        """Test multi-city functionality"""
        print("\n🏙️ Testing Multi-City Support")
        
        # Test cities endpoint
        try:
            async with self.session.get(f"{self.base_url}/cities") as resp:
                if resp.status == 200:
                    cities = await resp.json()
                    expected_cities = ["lagos", "abuja", "port_harcourt", "ibadan"]
                    city_codes = [city.get("code") for city in cities]
                    
                    all_present = all(code in city_codes for code in expected_cities)
                    self.log_test("Cities Endpoint", all_present, 
                                f"Found cities: {city_codes}")
                    
                    # Test individual city endpoint
                    async with self.session.get(f"{self.base_url}/cities/lagos") as resp2:
                        if resp2.status == 200:
                            lagos_data = await resp2.json()
                            has_coords = "center" in lagos_data and "lat" in lagos_data["center"]
                            self.log_test("Individual City Endpoint", has_coords,
                                        f"Lagos center: {lagos_data.get('center')}")
                        else:
                            self.log_test("Individual City Endpoint", False, f"HTTP {resp2.status}")
                else:
                    self.log_test("Cities Endpoint", False, f"HTTP {resp.status}", critical=True)
        except Exception as e:
            self.log_test("Cities Endpoint", False, str(e), critical=True)

    async def test_venue_apis(self):
        """Test venue management and filtering"""
        print("\n🏢 Testing Venue Management")
        
        # Test venues endpoint
        try:
            async with self.session.get(f"{self.base_url}/venues") as resp:
                if resp.status == 200:
                    all_venues = await resp.json()
                    self.test_venues = all_venues[:3]  # Store first 3 for other tests
                    self.log_test("All Venues Endpoint", len(all_venues) > 0, 
                                f"Found {len(all_venues)} venues")
                else:
                    self.log_test("All Venues Endpoint", False, f"HTTP {resp.status}", critical=True)
                    return
        except Exception as e:
            self.log_test("All Venues Endpoint", False, str(e), critical=True)
            return

        # Test venue filtering by city
        try:
            async with self.session.get(f"{self.base_url}/venues?city=lagos") as resp:
                if resp.status == 200:
                    lagos_venues = await resp.json()
                    all_lagos = all(venue.get("city") == "lagos" for venue in lagos_venues)
                    self.log_test("Venue City Filter", all_lagos,
                                f"Lagos venues: {len(lagos_venues)}")
                else:
                    self.log_test("Venue City Filter", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("Venue City Filter", False, str(e))

        # Test individual venue endpoint
        if self.test_venues:
            try:
                venue_id = self.test_venues[0]["id"]
                async with self.session.get(f"{self.base_url}/venues/{venue_id}") as resp:
                    if resp.status == 200:
                        venue_data = await resp.json()
                        has_required = all(key in venue_data for key in ["name", "coordinates", "current_vibe_score"])
                        self.log_test("Individual Venue Endpoint", has_required,
                                    f"Venue: {venue_data.get('name')}")
                    else:
                        self.log_test("Individual Venue Endpoint", False, f"HTTP {resp.status}")
            except Exception as e:
                self.log_test("Individual Venue Endpoint", False, str(e))

    async def test_leaderboard_apis(self):
        """Test leaderboard functionality"""
        print("\n🏆 Testing Leaderboard APIs")
        
        # Test city leaderboard
        try:
            async with self.session.get(f"{self.base_url}/leaderboard?city=lagos") as resp:
                if resp.status == 200:
                    leaderboard = await resp.json()
                    has_rankings = len(leaderboard) > 0 and all("rank" in item for item in leaderboard)
                    sorted_correctly = all(
                        leaderboard[i]["venue"]["current_vibe_score"] >= leaderboard[i+1]["venue"]["current_vibe_score"]
                        for i in range(len(leaderboard)-1)
                    ) if len(leaderboard) > 1 else True
                    
                    self.log_test("City Leaderboard", has_rankings and sorted_correctly,
                                f"Entries: {len(leaderboard)}, Top venue score: {leaderboard[0]['venue']['current_vibe_score'] if leaderboard else 'N/A'}")
                else:
                    self.log_test("City Leaderboard", False, f"HTTP {resp.status}", critical=True)
        except Exception as e:
            self.log_test("City Leaderboard", False, str(e), critical=True)

        # Test national leaderboard
        try:
            async with self.session.get(f"{self.base_url}/leaderboard/national") as resp:
                if resp.status == 200:
                    national = await resp.json()
                    has_cities = len(national) > 0 and all("city" in item["venue"] for item in national)
                    self.log_test("National Leaderboard", has_cities,
                                f"National entries: {len(national)}")
                else:
                    self.log_test("National Leaderboard", False, f"HTTP {resp.status}", critical=True)
        except Exception as e:
            self.log_test("National Leaderboard", False, str(e), critical=True)

    async def test_rating_system(self):
        """Test rating creation with geofence and rate limiting"""
        print("\n⭐ Testing Rating System")
        
        if not self.test_venues or not self.test_user_id:
            self.log_test("Rating System Prerequisites", False, "Missing venues or user ID", critical=True)
            return

        venue = self.test_venues[0]
        venue_id = venue["id"]
        venue_coords = venue["coordinates"]

        # Test geofence validation (should fail - too far from venue)
        try:
            rating_data = {
                "user_id": self.test_user_id,
                "venue_id": venue_id,
                "energy": "popping",
                "capacity": "vibrant", 
                "gate": "clear",
                "coordinates": {
                    "lat": venue_coords["lat"] + 0.001,  # ~100m away
                    "lng": venue_coords["lng"] + 0.001
                }
            }

            async with self.session.post(f"{self.base_url}/ratings", json=rating_data) as resp:
                if resp.status == 403:
                    self.log_test("Geofence Validation (Reject)", True, "Correctly rejected rating from distance")
                else:
                    self.log_test("Geofence Validation (Reject)", False, f"Expected 403, got {resp.status}")
        except Exception as e:
            self.log_test("Geofence Validation (Reject)", False, str(e))

        # Test successful rating (within geofence)
        try:
            rating_data = {
                "user_id": self.test_user_id,
                "venue_id": venue_id,
                "energy": "electric",
                "capacity": "full",
                "gate": "slow",
                "coordinates": {
                    "lat": venue_coords["lat"],  # Exact venue location
                    "lng": venue_coords["lng"]
                }
            }

            async with self.session.post(f"{self.base_url}/ratings", json=rating_data) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    has_rating = "rating" in result and "venue_vibe_score" in result
                    remaining = result.get("remaining_ratings", 0)
                    self.log_test("Valid Rating Creation", has_rating,
                                f"Rating created, remaining: {remaining}")
                else:
                    error_text = await resp.text()
                    self.log_test("Valid Rating Creation", False, f"HTTP {resp.status}: {error_text}", critical=True)
        except Exception as e:
            self.log_test("Valid Rating Creation", False, str(e), critical=True)

        # Test rate limiting (should allow 1 more, then block)
        try:
            async with self.session.post(f"{self.base_url}/ratings", json=rating_data) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    is_correction = result.get("is_correction", False)
                    self.log_test("Second Rating (Correction)", is_correction,
                                f"Correction allowed: {is_correction}")
                else:
                    self.log_test("Second Rating (Correction)", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("Second Rating (Correction)", False, str(e))

        # Test rate limit enforcement (third attempt should fail)
        try:
            async with self.session.post(f"{self.base_url}/ratings", json=rating_data) as resp:
                if resp.status == 429:
                    self.log_test("Rate Limit Enforcement", True, "Correctly blocked third rating")
                else:
                    self.log_test("Rate Limit Enforcement", False, f"Expected 429, got {resp.status}")
        except Exception as e:
            self.log_test("Rate Limit Enforcement", False, str(e))

        # Test rating status endpoint
        try:
            async with self.session.get(f"{self.base_url}/ratings/user/{self.test_user_id}/venue/{venue_id}") as resp:
                if resp.status == 200:
                    status = await resp.json()
                    has_status = "ratings_count" in status and "can_rate" in status
                    self.log_test("Rating Status Check", has_status,
                                f"Count: {status.get('ratings_count')}, Can rate: {status.get('can_rate')}")
                else:
                    self.log_test("Rating Status Check", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("Rating Status Check", False, str(e))

    async def test_fast_pass_system(self):
        """Test Fast Pass purchase and fee split"""
        print("\n🎫 Testing Fast Pass System")

        # Test fast pass venues endpoint
        try:
            async with self.session.get(f"{self.base_url}/fast-pass/venues") as resp:
                if resp.status == 200:
                    fp_venues = await resp.json()
                    all_enabled = all(venue.get("fast_pass_enabled") for venue in fp_venues)
                    self.log_test("Fast Pass Venues Endpoint", all_enabled,
                                f"Found {len(fp_venues)} fast pass venues")
                else:
                    self.log_test("Fast Pass Venues Endpoint", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("Fast Pass Venues Endpoint", False, str(e))

        # Test fast pass purchase
        if not self.test_user_id or not self.test_venues:
            self.log_test("Fast Pass Purchase", False, "Missing test data", critical=True)
            return

        # Find a venue with fast pass enabled
        fp_venue = next((v for v in self.test_venues if v.get("fast_pass_enabled")), None)
        if not fp_venue:
            self.log_test("Fast Pass Purchase", False, "No fast pass enabled venues", critical=True)
            return

        try:
            purchase_data = {
                "user_id": self.test_user_id,
                "venue_id": fp_venue["id"]
            }

            async with self.session.post(f"{self.base_url}/fast-pass/purchase", json=purchase_data) as resp:
                if resp.status == 200:
                    purchase = await resp.json()
                    
                    # Verify fee split (10% platform, 90% venue)
                    price = purchase.get("price", 0)
                    platform_fee = purchase.get("platform_fee", 0)
                    venue_share = purchase.get("venue_share", 0)
                    
                    expected_platform = price * 0.1
                    expected_venue = price * 0.9
                    
                    fee_split_correct = (
                        abs(platform_fee - expected_platform) < 0.01 and
                        abs(venue_share - expected_venue) < 0.01
                    )
                    
                    has_qr = "qr_code" in purchase and purchase["qr_code"]
                    
                    self.log_test("Fast Pass Purchase", fee_split_correct and has_qr,
                                f"Price: ₦{price}, Platform: ₦{platform_fee}, Venue: ₦{venue_share}, QR: {purchase.get('qr_code', 'Missing')}")
                else:
                    error_text = await resp.text()
                    self.log_test("Fast Pass Purchase", False, f"HTTP {resp.status}: {error_text}", critical=True)
        except Exception as e:
            self.log_test("Fast Pass Purchase", False, str(e), critical=True)

        # Test user fast passes endpoint
        try:
            async with self.session.get(f"{self.base_url}/fast-pass/user/{self.test_user_id}") as resp:
                if resp.status == 200:
                    user_passes = await resp.json()
                    has_passes = len(user_passes) > 0
                    self.log_test("User Fast Passes", has_passes,
                                f"User has {len(user_passes)} active passes")
                else:
                    self.log_test("User Fast Passes", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("User Fast Passes", False, str(e))

    async def test_pulse_drop_system(self):
        """Test Pulse Drop tiers and purchase"""
        print("\n💫 Testing Pulse Drop System")

        # Test pulse drop tiers endpoint
        try:
            async with self.session.get(f"{self.base_url}/pulse-drops/tiers") as resp:
                if resp.status == 200:
                    tiers = await resp.json()
                    expected_tiers = ["spark", "flare", "supernova"]
                    has_all_tiers = all(tier in tiers for tier in expected_tiers)
                    
                    # Check tier structure
                    spark_valid = "spark" in tiers and all(
                        key in tiers["spark"] for key in ["price", "glow_boost", "duration_hours"]
                    )
                    
                    self.log_test("Pulse Drop Tiers", has_all_tiers and spark_valid,
                                f"Tiers: {list(tiers.keys())}, Spark price: ₦{tiers.get('spark', {}).get('price', 'N/A')}")
                else:
                    self.log_test("Pulse Drop Tiers", False, f"HTTP {resp.status}", critical=True)
        except Exception as e:
            self.log_test("Pulse Drop Tiers", False, str(e), critical=True)

        # Test pulse drop purchase
        if not self.test_venues:
            self.log_test("Pulse Drop Purchase", False, "No test venues available", critical=True)
            return

        try:
            venue_id = self.test_venues[0]["id"]
            pulse_data = {
                "venue_id": venue_id,
                "tier": "spark",
                "message": "Test pulse drop activation!"
            }

            async with self.session.post(f"{self.base_url}/pulse-drops/purchase", json=pulse_data) as resp:
                if resp.status == 200:
                    pulse_drop = await resp.json()
                    
                    # Verify tier effects applied
                    has_boost = pulse_drop.get("glow_boost", 0) > 0
                    has_radius = pulse_drop.get("radius_km", 0) > 0
                    has_expiry = "expires_at" in pulse_drop
                    
                    # Verify fee split
                    price = pulse_drop.get("price_paid", 0)
                    platform_fee = pulse_drop.get("platform_fee", 0)
                    venue_share = pulse_drop.get("venue_share", 0)
                    
                    fee_split_correct = (
                        abs(platform_fee - (price * 0.1)) < 0.01 and
                        abs(venue_share - (price * 0.9)) < 0.01
                    )
                    
                    self.log_test("Pulse Drop Purchase", has_boost and has_radius and has_expiry and fee_split_correct,
                                f"Boost: {pulse_drop.get('glow_boost')}, Radius: {pulse_drop.get('radius_km')}km, Fee split OK: {fee_split_correct}")
                else:
                    error_text = await resp.text()
                    self.log_test("Pulse Drop Purchase", False, f"HTTP {resp.status}: {error_text}", critical=True)
        except Exception as e:
            self.log_test("Pulse Drop Purchase", False, str(e), critical=True)

        # Test nearby pulse drops
        try:
            # Use Lagos coordinates
            lat, lng = 6.4281, 3.4219
            async with self.session.get(f"{self.base_url}/pulse-drops/nearby/{lat}/{lng}") as resp:
                if resp.status == 200:
                    nearby = await resp.json()
                    self.log_test("Nearby Pulse Drops", True,
                                f"Found {len(nearby)} active pulse drops nearby")
                else:
                    self.log_test("Nearby Pulse Drops", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("Nearby Pulse Drops", False, str(e))

    async def test_merchant_dashboard(self):
        """Test merchant dashboard stats"""
        print("\n📊 Testing Merchant Dashboard")
        
        if not self.test_venues:
            self.log_test("Merchant Dashboard", False, "No test venues", critical=True)
            return

        venue_id = self.test_venues[0]["id"]
        try:
            async with self.session.get(f"{self.base_url}/merchant/venue/{venue_id}/stats") as resp:
                if resp.status == 200:
                    stats = await resp.json()
                    
                    required_sections = ["venue", "stats", "revenue", "hourly_trend", "competitors"]
                    has_all_sections = all(section in stats for section in required_sections)
                    
                    has_rating_stats = all(
                        key in stats.get("stats", {}) 
                        for key in ["ratings_1h", "ratings_24h", "current_rank"]
                    )
                    
                    has_revenue_stats = all(
                        key in stats.get("revenue", {})
                        for key in ["fast_pass_30d", "pulse_drop_30d"]
                    )
                    
                    self.log_test("Merchant Dashboard Stats", has_all_sections and has_rating_stats and has_revenue_stats,
                                f"Sections present: {list(stats.keys())}, Current rank: {stats.get('stats', {}).get('current_rank', 'N/A')}")
                else:
                    self.log_test("Merchant Dashboard Stats", False, f"HTTP {resp.status}", critical=True)
        except Exception as e:
            self.log_test("Merchant Dashboard Stats", False, str(e), critical=True)

    async def run_all_tests(self):
        """Execute all test suites"""
        print("🚀 Starting Vibe App Backend API Testing")
        print("=" * 60)
        
        # Setup
        if not await self.setup():
            print("❌ Setup failed, aborting tests")
            return False

        # Core API tests
        if not await self.test_api_health():
            print("❌ API health check failed, aborting tests")
            return False

        # Feature tests
        await self.test_multi_city_support()
        await self.test_venue_apis()
        await self.test_leaderboard_apis()
        await self.test_rating_system()
        await self.test_fast_pass_system()
        await self.test_pulse_drop_system()
        await self.test_merchant_dashboard()

        # Results summary
        print("\n" + "=" * 60)
        print("🏁 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total = self.results["total_tests"]
        passed = self.results["passed"]
        failed = self.results["failed"]
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        if self.results["critical_failures"]:
            print(f"\n🚨 CRITICAL FAILURES ({len(self.results['critical_failures'])}):")
            for failure in self.results["critical_failures"]:
                print(f"   - {failure}")
        
        print(f"\n📍 Tested against: {self.base_url}")
        
        # Cleanup
        await self.cleanup()
        
        return len(self.results["critical_failures"]) == 0


async def main():
    """Main test runner"""
    tester = VibeAppTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())