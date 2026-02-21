"""
Admin Endpoints Test Suite for Vibe App
Tests admin-only features:
- Treasury analytics
- User analytics (Active vs Ghost)
- Integrity Monitor (Sponsored vs Organic)
- Clout Economy
- Pulse Ledger
- Clout Airdrop
"""
import pytest
import requests
import os

# Use the public backend URL
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://venue-pulse-13.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Provided test credentials
ADMIN_USER_ID = "b4903974-2ed8-4c15-8273-cc7f2a2dab4f"
TEST_USER_ID = "01752f93-e11a-4753-8a26-8a9b03efdb77"


class TestHealthAndBasics:
    """Test basic endpoints to ensure backend is working"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")

    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root failed: {response.text}"
        data = response.json()
        assert "Vibe App API" in data.get("message", "")
        print(f"✓ API root passed: {data}")


class TestAdminAuthorization:
    """Test admin authorization - should reject non-admin users"""

    def test_treasury_requires_admin(self):
        """Treasury endpoint should reject non-admin users"""
        # Try without any auth header
        response = requests.get(f"{BASE_URL}/api/admin/treasury")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Treasury correctly rejected unauthenticated request: {response.json()}")
    
    def test_treasury_rejects_non_admin_user(self):
        """Treasury endpoint should reject non-admin users with X-User-Id header"""
        headers = {"X-User-Id": TEST_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/treasury", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Treasury correctly rejected non-admin user: {response.json()}")
    
    def test_user_analytics_requires_admin(self):
        """User analytics endpoint should reject non-admin users"""
        response = requests.get(f"{BASE_URL}/api/admin/user-analytics")
        assert response.status_code == 403
        
        headers = {"X-User-Id": TEST_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/user-analytics", headers=headers)
        assert response.status_code == 403
        print(f"✓ User analytics correctly rejected non-admin user")
    
    def test_integrity_monitor_requires_admin(self):
        """Integrity monitor should reject non-admin users"""
        headers = {"X-User-Id": TEST_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/integrity-monitor", headers=headers)
        assert response.status_code == 403
        print(f"✓ Integrity monitor correctly rejected non-admin user")
    
    def test_clout_economy_requires_admin(self):
        """Clout economy endpoint should reject non-admin users"""
        headers = {"X-User-Id": TEST_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/clout-economy", headers=headers)
        assert response.status_code == 403
        print(f"✓ Clout economy correctly rejected non-admin user")
    
    def test_pulse_ledger_requires_admin(self):
        """Pulse ledger endpoint should reject non-admin users"""
        headers = {"X-User-Id": TEST_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/pulse-ledger", headers=headers)
        assert response.status_code == 403
        print(f"✓ Pulse ledger correctly rejected non-admin user")
    
    def test_clout_airdrop_requires_admin(self):
        """Clout airdrop should reject non-admin users"""
        headers = {"X-User-Id": TEST_USER_ID}
        payload = {"user_ids": [TEST_USER_ID], "amount": 100, "reason": "Test"}
        response = requests.post(f"{BASE_URL}/api/admin/clout-airdrop", json=payload, headers=headers)
        assert response.status_code == 403
        print(f"✓ Clout airdrop correctly rejected non-admin user")


class TestTreasuryEndpoint:
    """Test /api/admin/treasury endpoint with admin auth"""
    
    def test_treasury_with_admin_auth(self):
        """Treasury endpoint should return analytics for admin users"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/treasury", headers=headers)
        assert response.status_code == 200, f"Treasury failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "global" in data, "Missing 'global' field in treasury response"
        assert "revenue_by_city" in data, "Missing 'revenue_by_city' field"
        assert "revenue_by_tier" in data, "Missing 'revenue_by_tier' field"
        assert "network_health" in data, "Missing 'network_health' field"
        assert "data_freshness_percent" in data, "Missing 'data_freshness_percent' field"
        
        # Verify global structure
        assert "total_revenue" in data["global"]
        assert "today_revenue" in data["global"]
        
        # Verify network health structure
        network = data["network_health"]
        assert "total_venues" in network
        assert "total_users" in network
        assert "verified_venues" in network
        assert "active_users_24h" in network
        
        print(f"✓ Treasury endpoint passed with data:")
        print(f"  - Total revenue: {data['global']['total_revenue']}")
        print(f"  - Total users: {network['total_users']}")
        print(f"  - Total venues: {network['total_venues']}")


class TestUserAnalyticsEndpoint:
    """Test /api/admin/user-analytics endpoint"""
    
    def test_user_analytics_returns_correct_structure(self):
        """User analytics should return ghost count and tier distribution"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/user-analytics", headers=headers)
        assert response.status_code == 200, f"User analytics failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "total_users" in data, "Missing 'total_users' field"
        assert "active_users_24h" in data, "Missing 'active_users_24h' field"
        assert "active_users_7d" in data, "Missing 'active_users_7d' field"
        assert "ghost_users" in data, "Missing 'ghost_users' field"
        assert "ghost_percentage" in data, "Missing 'ghost_percentage' field"
        assert "new_users_today" in data, "Missing 'new_users_today' field"
        assert "tier_distribution" in data, "Missing 'tier_distribution' field"
        
        # Verify tier distribution has expected keys
        tier_dist = data["tier_distribution"]
        assert "elite" in tier_dist, "Missing 'elite' in tier distribution"
        assert "scout" in tier_dist, "Missing 'scout' in tier distribution"
        assert "regular" in tier_dist, "Missing 'regular' in tier distribution"
        assert "newbie" in tier_dist, "Missing 'newbie' in tier distribution"
        
        # Verify data types
        assert isinstance(data["total_users"], int)
        assert isinstance(data["ghost_users"], int)
        assert isinstance(data["ghost_percentage"], (int, float))
        
        print(f"✓ User analytics endpoint passed with data:")
        print(f"  - Total users: {data['total_users']}")
        print(f"  - Ghost users: {data['ghost_users']} ({data['ghost_percentage']}%)")
        print(f"  - Tier distribution: {tier_dist}")


class TestIntegrityMonitorEndpoint:
    """Test /api/admin/integrity-monitor endpoint"""
    
    def test_integrity_monitor_returns_sponsored_vs_organic(self):
        """Integrity monitor should return sponsored vs organic comparison"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/integrity-monitor", headers=headers)
        assert response.status_code == 200, f"Integrity monitor failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "sponsored" in data, "Missing 'sponsored' field"
        assert "organic" in data, "Missing 'organic' field"
        assert "delta" in data, "Missing 'delta' field"
        assert "integrity_warnings" in data, "Missing 'integrity_warnings' field"
        assert "health_status" in data, "Missing 'health_status' field"
        
        # Verify sponsored structure
        sponsored = data["sponsored"]
        assert "count" in sponsored, "Missing 'count' in sponsored"
        assert "average_energy" in sponsored, "Missing 'average_energy' in sponsored"
        assert "distribution" in sponsored, "Missing 'distribution' in sponsored"
        
        # Verify organic structure
        organic = data["organic"]
        assert "count" in organic, "Missing 'count' in organic"
        assert "average_energy" in organic, "Missing 'average_energy' in organic"
        assert "distribution" in organic, "Missing 'distribution' in organic"
        
        # Verify distribution has expected keys
        if sponsored["count"] > 0:
            dist = sponsored["distribution"]
            assert "electric" in dist
            assert "popping" in dist
            assert "moderate" in dist
            assert "quiet" in dist
        
        # Verify health status is one of expected values
        assert data["health_status"] in ["healthy", "warning", "critical"]
        
        print(f"✓ Integrity monitor endpoint passed with data:")
        print(f"  - Sponsored venues: {sponsored['count']} (avg energy: {sponsored['average_energy']})")
        print(f"  - Organic venues: {organic['count']} (avg energy: {organic['average_energy']})")
        print(f"  - Delta: {data['delta']}")
        print(f"  - Health status: {data['health_status']}")


class TestCloutEconomyEndpoint:
    """Test /api/admin/clout-economy endpoint"""
    
    def test_clout_economy_returns_top_scouts_and_circulation(self):
        """Clout economy should return top scouts and total circulation"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/clout-economy", headers=headers)
        assert response.status_code == 200, f"Clout economy failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "total_clout_circulation" in data, "Missing 'total_clout_circulation' field"
        assert "total_users" in data, "Missing 'total_users' field"
        assert "average_clout" in data, "Missing 'average_clout' field"
        assert "top_scouts" in data, "Missing 'top_scouts' field"
        assert "tier_distribution" in data, "Missing 'tier_distribution' field"
        
        # Verify data types
        assert isinstance(data["total_clout_circulation"], (int, float))
        assert isinstance(data["total_users"], int)
        assert isinstance(data["top_scouts"], list)
        
        # Verify top scouts structure if any exist
        if data["top_scouts"]:
            scout = data["top_scouts"][0]
            assert "rank" in scout, "Missing 'rank' in scout"
            assert "username" in scout, "Missing 'username' in scout"
            assert "clout_points" in scout, "Missing 'clout_points' in scout"
            assert "scout_status" in scout, "Missing 'scout_status' in scout"
            assert "tier_color" in scout, "Missing 'tier_color' in scout"
        
        print(f"✓ Clout economy endpoint passed with data:")
        print(f"  - Total clout circulation: {data['total_clout_circulation']}")
        print(f"  - Total users: {data['total_users']}")
        print(f"  - Top scouts count: {len(data['top_scouts'])}")
        if data["top_scouts"]:
            print(f"  - Top scout: {data['top_scouts'][0]['username']} with {data['top_scouts'][0]['clout_points']} clout")


class TestPulseLedgerEndpoint:
    """Test /api/admin/pulse-ledger endpoint"""
    
    def test_pulse_ledger_returns_transaction_history(self):
        """Pulse ledger should return transaction history"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/pulse-ledger", headers=headers)
        assert response.status_code == 200, f"Pulse ledger failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "ledger" in data, "Missing 'ledger' field"
        assert "total_drops" in data, "Missing 'total_drops' field"
        assert "total_revenue" in data, "Missing 'total_revenue' field"
        
        # Verify data types
        assert isinstance(data["ledger"], list)
        assert isinstance(data["total_drops"], int)
        assert isinstance(data["total_revenue"], (int, float))
        
        # Verify ledger item structure if any exist
        if data["ledger"]:
            item = data["ledger"][0]
            assert "drop_id" in item, "Missing 'drop_id' in ledger item"
            assert "venue_name" in item, "Missing 'venue_name' in ledger item"
            assert "tier" in item, "Missing 'tier' in ledger item"
            assert "amount" in item, "Missing 'amount' in ledger item"
            assert "created_at" in item, "Missing 'created_at' in ledger item"
            assert "scout_activity" in item, "Missing 'scout_activity' in ledger item"
        
        print(f"✓ Pulse ledger endpoint passed with data:")
        print(f"  - Total drops: {data['total_drops']}")
        print(f"  - Total revenue: {data['total_revenue']}")
        print(f"  - Ledger entries: {len(data['ledger'])}")


class TestCloutAirdropEndpoint:
    """Test /api/admin/clout-airdrop endpoint"""
    
    def test_airdrop_validation_rejects_invalid_amount(self):
        """Airdrop should reject zero or negative amounts"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        payload = {"user_ids": [TEST_USER_ID], "amount": 0, "reason": "Test"}
        response = requests.post(f"{BASE_URL}/api/admin/clout-airdrop", json=payload, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Airdrop correctly rejected zero amount: {response.json()}")
    
    def test_airdrop_validation_rejects_empty_users(self):
        """Airdrop should reject empty user list"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        payload = {"user_ids": [], "amount": 100, "reason": "Test"}
        response = requests.post(f"{BASE_URL}/api/admin/clout-airdrop", json=payload, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Airdrop correctly rejected empty user list: {response.json()}")
    
    def test_airdrop_success(self):
        """Airdrop should successfully distribute clout"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        payload = {
            "user_ids": [TEST_USER_ID],
            "amount": 50,
            "reason": "Test airdrop from automated tests"
        }
        response = requests.post(f"{BASE_URL}/api/admin/clout-airdrop", json=payload, headers=headers)
        assert response.status_code == 200, f"Airdrop failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Airdrop should return success=True"
        assert "users_updated" in data, "Missing 'users_updated' in response"
        assert "total_clout_distributed" in data, "Missing 'total_clout_distributed' in response"
        
        print(f"✓ Airdrop endpoint passed:")
        print(f"  - Users updated: {data['users_updated']}")
        print(f"  - Total clout distributed: {data['total_clout_distributed']}")


class TestAirdropHistoryEndpoint:
    """Test /api/admin/airdrop-history endpoint"""
    
    def test_airdrop_history_returns_list(self):
        """Airdrop history should return a list of past airdrops"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/airdrop-history", headers=headers)
        assert response.status_code == 200, f"Airdrop history failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "history" in data, "Missing 'history' field"
        assert isinstance(data["history"], list), "History should be a list"
        
        # After running test_airdrop_success, there should be at least one entry
        if data["history"]:
            entry = data["history"][0]
            assert "amount_per_user" in entry, "Missing 'amount_per_user'"
            assert "reason" in entry, "Missing 'reason'"
            assert "timestamp" in entry, "Missing 'timestamp'"
        
        print(f"✓ Airdrop history endpoint passed with {len(data['history'])} entries")


class TestAdminVenuesEndpoint:
    """Test /api/admin/venues endpoint"""
    
    def test_admin_venues_returns_list(self):
        """Admin venues should return list of all venues"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/venues", headers=headers)
        assert response.status_code == 200, f"Admin venues failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if data:
            venue = data[0]
            assert "id" in venue, "Missing 'id' in venue"
            assert "name" in venue, "Missing 'name' in venue"
            assert "city" in venue, "Missing 'city' in venue"
        
        print(f"✓ Admin venues endpoint passed with {len(data)} venues")
    
    def test_admin_venues_filter_by_city(self):
        """Admin venues should filter by city"""
        headers = {"X-User-Id": ADMIN_USER_ID}
        response = requests.get(f"{BASE_URL}/api/admin/venues?city=lagos", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        for venue in data:
            assert venue.get("city") == "lagos", f"Venue {venue.get('name')} has wrong city: {venue.get('city')}"
        
        print(f"✓ Admin venues city filter works - {len(data)} Lagos venues")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
