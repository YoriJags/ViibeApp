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
    tester.test_single_venue()
    tester.test_city_pulse()
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