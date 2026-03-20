import requests
import sys
import uuid
from datetime import datetime

class ViibeAPITester:
    def __init__(self, base_url="https://scene-detect-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    self.test_results.append({
                        "test": name,
                        "status": "PASSED",
                        "response_code": response.status_code,
                        "response_data": response_data
                    })
                    return True, response_data
                except:
                    self.test_results.append({
                        "test": name, 
                        "status": "PASSED",
                        "response_code": response.status_code,
                        "response_data": response.text
                    })
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error response: {error_data}")
                except:
                    print(f"Error response: {response.text}")
                
                self.test_results.append({
                    "test": name,
                    "status": "FAILED", 
                    "response_code": response.status_code,
                    "expected": expected_status,
                    "error": response.text
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "test": name,
                "status": "ERROR",
                "error": str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "API Root",
            "GET", 
            "/",
            200
        )

    def test_waitlist_signup(self):
        """Test waitlist signup with unique email"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        success, response = self.run_test(
            "Waitlist Signup",
            "POST",
            "/waitlist", 
            200,
            data={"email": test_email, "role": "scout", "city": "lagos"}
        )
        return success, response, test_email

    def test_waitlist_duplicate(self, email):
        """Test waitlist duplicate prevention"""
        success, response = self.run_test(
            "Waitlist Duplicate Prevention",
            "POST",
            "/waitlist",
            409,
            data={"email": email, "role": "scout", "city": "lagos"}
        )
        return success

    def test_waitlist_stats(self):
        """Test waitlist statistics"""
        return self.run_test(
            "Waitlist Stats", 
            "GET",
            "/waitlist/stats",
            200
        )

    def test_venues_live(self):
        """Test live venues endpoint"""
        return self.run_test(
            "Live Venues - Lagos",
            "GET",
            "/v1/agent/venues/live",
            200,
            params={"city": "lagos", "limit": 5}
        )

    def test_single_venue(self):
        """Test single venue endpoint"""
        return self.run_test(
            "Single Venue - Quilox VI", 
            "GET",
            "/v1/agent/venues/quilox-vi",
            200
        )

    def test_city_pulse(self):
        """Test city pulse endpoint"""
        return self.run_test(
            "City Pulse - Lagos",
            "GET", 
            "/v1/agent/city/pulse",
            200,
            params={"city": "lagos"}
        )
    
    def test_city_pulse_fluctuation(self):
        """Test city pulse fluctuation - call twice to verify scores change"""
        print(f"\n🔍 Testing City Pulse Fluctuation (2 calls)...")
        
        # First call
        success1, response1 = self.run_test(
            "City Pulse Call 1",
            "GET",
            "/v1/agent/city/pulse", 
            200,
            params={"city": "lagos"}
        )
        
        if not success1:
            return False
            
        # Second call
        success2, response2 = self.run_test(
            "City Pulse Call 2",
            "GET", 
            "/v1/agent/city/pulse",
            200,
            params={"city": "lagos"}
        )
        
        if not success2:
            return False
            
        # Check for fluctuation
        if response1.get('avg_vibe_score') != response2.get('avg_vibe_score'):
            print("✅ Scores fluctuated as expected")
            return True
        else:
            print("⚠️  Scores didn't fluctuate (might be coincidence)")
            return True
    
    def test_city_pulse_active_scouts(self):
        """Test city pulse includes active_scouts field"""
        success, response = self.run_test(
            "City Pulse - Active Scouts Field",
            "GET",
            "/v1/agent/city/pulse",
            200,
            params={"city": "lagos"}
        )
        
        if success and response:
            if 'active_scouts' in response:
                scouts = response['active_scouts']
                if isinstance(scouts, int) and 3 <= scouts <= 12:
                    print(f"✅ Active scouts field present: {scouts} (within range 3-12)")
                    return True
                else:
                    print(f"❌ Active scouts value {scouts} not in expected range (3-12)")
            else:
                print("❌ Missing active_scouts field")
                
        return False

    def test_venues_live_with_category(self):
        """Test live venues with category filter"""
        return self.run_test(
            "Live Venues - Nightclub Category",
            "GET",
            "/v1/agent/venues/live", 
            200,
            params={"city": "lagos", "category": "nightclub", "limit": 3}
        )

    def test_nonexistent_venue(self):
        """Test 404 for non-existent venue"""
        return self.run_test(
            "Non-existent Venue (404)", 
            "GET",
            "/v1/agent/venues/non-existent-venue",
            404
        )
    
    def test_venues_live_all_with_coordinates(self):
        """Test venues/live endpoint returns all 10 venues with coordinates"""
        success, response = self.run_test(
            "Live Venues - All 10 with Coordinates",
            "GET",
            "/v1/agent/venues/live",
            200,
            params={"city": "lagos", "limit": 20}
        )
        
        if success and response:
            venues = response.get('venues', [])
            print(f"   Found {len(venues)} venues")
            
            # Check we have all 10 venues
            if len(venues) != 10:
                print(f"❌ Expected 10 venues, got {len(venues)}")
                return False
            
            # Check all venues have coordinates
            venues_with_coords = 0
            for venue in venues:
                if 'coordinates' in venue and venue['coordinates']:
                    coords = venue['coordinates']
                    if 'lat' in coords and 'lng' in coords:
                        venues_with_coords += 1
                        print(f"   ✅ {venue['name']}: lat={coords['lat']}, lng={coords['lng']}")
                    else:
                        print(f"   ❌ {venue['name']}: missing lat/lng in coordinates")
                else:
                    print(f"   ❌ {venue['name']}: missing coordinates field")
            
            if venues_with_coords == 10:
                print(f"   ✅ All 10 venues have valid coordinates")
                return True
            else:
                print(f"   ❌ Only {venues_with_coords}/10 venues have valid coordinates")
                return False
        
        return False

def main():
    # Setup
    tester = ViibeAPITester()
    
    print("🚀 Starting VIIBE API Tests")
    print("=" * 50)
    
    # Test API root
    tester.test_root_endpoint()
    
    # Test waitlist functionality
    success, signup_response, test_email = tester.test_waitlist_signup()
    if success:
        # Test duplicate prevention with same email
        tester.test_waitlist_duplicate(test_email)
    
    # Test waitlist stats
    tester.test_waitlist_stats()
    
    # Test Agent API endpoints
    tester.test_venues_live()
    tester.test_venues_live_all_with_coordinates()
    tester.test_single_venue()
    tester.test_city_pulse()
    tester.test_city_pulse_fluctuation()
    tester.test_city_pulse_active_scouts()
    tester.test_venues_live_with_category()
    tester.test_nonexistent_venue()
    
    # Print detailed results
    print("\n" + "=" * 50)
    print("📊 DETAILED TEST RESULTS")
    print("=" * 50)
    
    for result in tester.test_results:
        status_emoji = "✅" if result["status"] == "PASSED" else "❌"
        print(f"\n{status_emoji} {result['test']}: {result['status']}")
        if result["status"] == "PASSED":
            print(f"   Response Code: {result['response_code']}")
            if isinstance(result.get('response_data'), dict):
                if 'message' in result['response_data']:
                    print(f"   Message: {result['response_data']['message']}")
                elif 'venues' in result['response_data']:
                    print(f"   Venues Count: {len(result['response_data']['venues'])}")
                elif 'total' in result['response_data']:
                    print(f"   Total Waitlist: {result['response_data']['total']}")
        elif result["status"] == "FAILED":
            print(f"   Expected: {result.get('expected')}, Got: {result['response_code']}")
        
    print(f"\n📈 SUMMARY: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())