#!/usr/bin/env python3

import requests
import json
import sys
import uuid
from datetime import datetime, timezone

# Use the correct backend URL from frontend environment
BASE_URL = "https://trending-night.preview.emergentagent.com/api"

class B2CNightlifeIntelligenceTests:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        
    def log_result(self, test_name, status, details=""):
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.test_results.append(result)
        status_emoji = "✅" if status == "PASS" else "❌"
        print(f"{status_emoji} {test_name}: {details}")

    def test_venues_api_with_b2c_fields(self, city="lagos"):
        """Test GET /api/venues?city=lagos - Verify new B2C fields exist"""
        try:
            url = f"{self.base_url}/venues"
            params = {"city": city}
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code != 200:
                self.log_result("Venues API", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return None
                
            venues = response.json()
            if not venues:
                self.log_result("Venues API", "FAIL", f"No venues found for city: {city}")
                return None
            
            # Check first venue for B2C fields
            first_venue = venues[0]
            required_fields = ["entry_fee", "music_genre", "tables_available", "last_snapshot_time"]
            missing_fields = []
            
            for field in required_fields:
                if field not in first_venue:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Venues B2C Fields", "FAIL", f"Missing fields: {missing_fields}")
            else:
                # Check field values
                example_values = {
                    "name": first_venue.get("name"),
                    "entry_fee": first_venue.get("entry_fee"),
                    "music_genre": first_venue.get("music_genre"),
                    "tables_available": first_venue.get("tables_available")
                }
                self.log_result("Venues B2C Fields", "PASS", f"All B2C fields present: {example_values}")
            
            return venues[0] if venues else None
            
        except requests.exceptions.RequestException as e:
            self.log_result("Venues API", "FAIL", f"Request error: {str(e)}")
            return None

    def test_individual_venue_detail(self, venue_id):
        """Test GET /api/venues/{venue_id} - Individual venue detail"""
        try:
            url = f"{self.base_url}/venues/{venue_id}"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                self.log_result("Individual Venue API", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return None
                
            venue = response.json()
            
            # Verify complete venue data with B2C fields
            required_fields = ["id", "name", "entry_fee", "music_genre", "tables_available", "last_snapshot_time"]
            missing_fields = []
            
            for field in required_fields:
                if field not in venue:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Individual Venue B2C Data", "FAIL", f"Missing fields: {missing_fields}")
            else:
                self.log_result("Individual Venue B2C Data", "PASS", f"Complete venue data returned for {venue.get('name')}")
            
            return venue
            
        except requests.exceptions.RequestException as e:
            self.log_result("Individual Venue API", "FAIL", f"Request error: {str(e)}")
            return None

    def test_trending_intelligence_api(self, city="lagos"):
        """Test GET /api/trending/{city} - Trending Intelligence with Vibe Density"""
        try:
            url = f"{self.base_url}/trending/{city}"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                self.log_result("Trending Intelligence API", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return None
                
            trending_data = response.json()
            
            # Verify structure
            if "venues" not in trending_data:
                self.log_result("Trending Intelligence Structure", "FAIL", "Missing 'venues' key in response")
                return None
                
            venues = trending_data["venues"]
            if not venues:
                self.log_result("Trending Intelligence Data", "FAIL", f"No trending venues found for {city}")
                return None
            
            # Verify first venue has trending fields
            first_venue = venues[0]
            required_trending_fields = ["rank", "trending_score", "energy_percent"]
            missing_fields = []
            
            for field in required_trending_fields:
                if field not in first_venue:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Trending Intelligence Fields", "FAIL", f"Missing trending fields: {missing_fields}")
            else:
                trending_info = {
                    "venue": first_venue.get("venue", {}).get("name"),
                    "rank": first_venue.get("rank"),
                    "trending_score": first_venue.get("trending_score"),
                    "energy_percent": first_venue.get("energy_percent")
                }
                self.log_result("Trending Intelligence Fields", "PASS", f"Trending data: {trending_info}")
            
            # Verify Vibe Density formula (energy + scout activity)
            if len(venues) >= 2:
                first_score = venues[0]["trending_score"]
                second_score = venues[1]["trending_score"]
                if first_score >= second_score:
                    self.log_result("Trending Intelligence Ranking", "PASS", f"Venues ranked by Vibe Density: #{1}:{first_score} > #{2}:{second_score}")
                else:
                    self.log_result("Trending Intelligence Ranking", "FAIL", f"Incorrect ranking: #{1}:{first_score} < #{2}:{second_score}")
            
            return trending_data
            
        except requests.exceptions.RequestException as e:
            self.log_result("Trending Intelligence API", "FAIL", f"Request error: {str(e)}")
            return None

    def test_direction_click_tracking(self, venue_id):
        """Test POST /api/venues/{venue_id}/direction-click - Direction tracking for ROI"""
        try:
            url = f"{self.base_url}/venues/{venue_id}/direction-click"
            response = requests.post(url, timeout=10)
            
            if response.status_code != 200:
                self.log_result("Direction Click Tracking", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
            result = response.json()
            
            if "message" in result and "recorded" in result["message"].lower():
                self.log_result("Direction Click Tracking", "PASS", f"Direction click recorded: {result['message']}")
                return True
            else:
                self.log_result("Direction Click Tracking", "FAIL", f"Unexpected response: {result}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Direction Click Tracking", "FAIL", f"Request error: {str(e)}")
            return False

    def verify_b2c_expected_results(self, venue_data):
        """Verify the expected B2C results as specified in the review request"""
        checks = []
        
        # Check entry_fee format
        entry_fee = venue_data.get("entry_fee")
        if entry_fee and ("₦" in str(entry_fee) or "Free" in str(entry_fee)):
            checks.append(("Entry Fee Format", "PASS", f"Valid format: {entry_fee}"))
        else:
            checks.append(("Entry Fee Format", "FAIL", f"Invalid format: {entry_fee}"))
        
        # Check music_genre
        music_genre = venue_data.get("music_genre")
        if music_genre and any(genre in str(music_genre) for genre in ["Amapiano", "Afrobeats", "House", "R&B"]):
            checks.append(("Music Genre", "PASS", f"Valid genre: {music_genre}"))
        else:
            checks.append(("Music Genre", "FAIL", f"Invalid/missing genre: {music_genre}"))
        
        # Check tables_available (boolean)
        tables_available = venue_data.get("tables_available")
        if isinstance(tables_available, bool):
            checks.append(("Tables Available Type", "PASS", f"Boolean value: {tables_available}"))
        else:
            checks.append(("Tables Available Type", "FAIL", f"Not boolean: {tables_available} (type: {type(tables_available)})"))
        
        # Check last_snapshot_time
        last_snapshot_time = venue_data.get("last_snapshot_time")
        if last_snapshot_time:
            checks.append(("Last Snapshot Time", "PASS", f"Timestamp present: {last_snapshot_time}"))
        else:
            checks.append(("Last Snapshot Time", "FAIL", "Missing last_snapshot_time for 'Verified X ago' feature"))
        
        for check_name, status, details in checks:
            self.log_result(check_name, status, details)

    def run_all_tests(self):
        """Run all B2C Nightlife Intelligence tests"""
        print("🚀 Starting B2C Nightlife Intelligence Backend Tests")
        print("=" * 60)
        
        # Test 1: GET /api/venues?city=lagos with new B2C fields
        print("\n📍 Testing Venues API with B2C Fields...")
        sample_venue = self.test_venues_api_with_b2c_fields("lagos")
        
        if sample_venue and "id" in sample_venue:
            venue_id = sample_venue["id"]
            
            # Test 2: GET /api/venues/{venue_id} - Individual venue detail
            print(f"\n🏢 Testing Individual Venue Detail for {venue_id}...")
            venue_detail = self.test_individual_venue_detail(venue_id)
            
            # Test 4: POST /api/venues/{venue_id}/direction-click
            print(f"\n📍 Testing Direction Click Tracking for {venue_id}...")
            self.test_direction_click_tracking(venue_id)
            
            # Verify expected B2C results
            print(f"\n✅ Verifying B2C Expected Results...")
            if venue_detail:
                self.verify_b2c_expected_results(venue_detail)
            elif sample_venue:
                self.verify_b2c_expected_results(sample_venue)
        
        # Test 3: GET /api/trending/{city} - Trending Intelligence
        print(f"\n📈 Testing Trending Intelligence API...")
        self.test_trending_intelligence_api("lagos")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"   • {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = B2CNightlifeIntelligenceTests()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)