"""
VIIBE API Backend Tests - Iteration 5
Testing: Receipt Generator, Weekly Report, and existing endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndRoot:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint returns correct message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "VIIBE API — Scene Intelligence Terminal"
        assert data["version"] == "1.0.0"


class TestReceiptGenerator:
    """Receipt Generator endpoint tests - POST /api/receipt/generate"""
    
    def test_generate_receipt_success(self):
        """Test successful receipt generation with valid venue_id"""
        response = requests.post(
            f"{BASE_URL}/api/receipt/generate",
            json={"venue_id": "quilox-vi", "username": "TestScout"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields are present
        assert "receipt_id" in data
        assert "venue_name" in data
        assert "vibe_score" in data
        assert "energy_state" in data
        assert "scout_name" in data
        assert "district" in data
        assert "category" in data
        assert "capacity_pct" in data
        assert "checked_out" in data
        assert "peak_hour" in data
        assert "tagline" in data
        
        # Verify specific values
        assert data["venue_name"] == "Quilox"
        assert data["scout_name"] == "TestScout"
        assert isinstance(data["vibe_score"], int)
        assert data["energy_state"] in ["peak", "electric", "warming", "steady", "quiet"]
        assert len(data["receipt_id"]) == 8  # UUID[:8].upper()
        
    def test_generate_receipt_anonymous_scout(self):
        """Test receipt generation with default anonymous scout name"""
        response = requests.post(
            f"{BASE_URL}/api/receipt/generate",
            json={"venue_id": "escape-vi"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scout_name"] == "Anonymous Scout"
        assert data["venue_name"] == "Escape Nightclub"
        
    def test_generate_receipt_invalid_venue(self):
        """Test receipt generation with invalid venue_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/receipt/generate",
            json={"venue_id": "invalid-venue-xyz", "username": "TestScout"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        
    def test_generate_receipt_all_venues(self):
        """Test receipt generation works for all seeded venues"""
        venues = [
            ("quilox-vi", "Quilox"),
            ("shiro-vi", "Shiro Lagos"),
            ("escape-vi", "Escape Nightclub"),
            ("hardrock-vi", "Hard Rock Cafe"),
            ("nok-ikoyi", "NOK by Alara"),
            ("club-joker-vi", "Club Joker"),
            ("circa-lekki", "Circa Lekki"),
            ("sky-lounge-vi", "Sky Lounge"),
            ("rhapsodys-vi", "Rhapsody's"),
            ("eko-hotel", "Eko Hotel & Suites"),
        ]
        
        for venue_id, expected_name in venues:
            response = requests.post(
                f"{BASE_URL}/api/receipt/generate",
                json={"venue_id": venue_id}
            )
            assert response.status_code == 200, f"Failed for venue {venue_id}"
            data = response.json()
            assert data["venue_name"] == expected_name, f"Wrong name for {venue_id}"


class TestWeeklyReport:
    """Weekly Report endpoint tests - GET /api/report/weekly"""
    
    def test_weekly_report_success(self):
        """Test weekly report returns full data structure"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        # Verify top-level fields
        assert "city" in data
        assert "report_week" in data
        assert "generated_at" in data
        assert "summary" in data
        assert "energy_tiers" in data
        assert "top_venues" in data
        assert "coldest_venues" in data
        assert "trending" in data
        assert "category_breakdown" in data
        assert "district_breakdown" in data
        
        # Verify city
        assert data["city"] == "lagos"
        
    def test_weekly_report_summary_fields(self):
        """Test weekly report summary contains all required fields"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        assert "total_venues" in summary
        assert "avg_energy" in summary
        assert "active_scouts" in summary
        assert "waitlist_signups" in summary
        assert "peak_night" in summary
        
        # Verify data types
        assert isinstance(summary["total_venues"], int)
        assert isinstance(summary["avg_energy"], (int, float))
        assert summary["total_venues"] == 10  # 10 seeded venues
        
    def test_weekly_report_energy_tiers(self):
        """Test energy tiers structure"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        tiers = data["energy_tiers"]
        assert "electric" in tiers
        assert "warming" in tiers
        assert "quiet" in tiers
        
        # Sum should equal total venues
        total = tiers["electric"] + tiers["warming"] + tiers["quiet"]
        assert total == data["summary"]["total_venues"]
        
    def test_weekly_report_top_venues(self):
        """Test top venues list structure"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        top_venues = data["top_venues"]
        assert len(top_venues) == 5  # Top 5 venues
        
        for venue in top_venues:
            assert "name" in venue
            assert "score" in venue
            assert "district" in venue
            assert "category" in venue
            
    def test_weekly_report_coldest_venues(self):
        """Test coldest venues list structure"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        coldest = data["coldest_venues"]
        assert len(coldest) == 3  # Bottom 3 venues
        
        for venue in coldest:
            assert "name" in venue
            assert "score" in venue
            assert "district" in venue
            
    def test_weekly_report_district_breakdown(self):
        """Test district breakdown contains expected districts"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        districts = data["district_breakdown"]
        # Should have Victoria Island, Ikoyi, Lekki Phase 1
        assert len(districts) >= 1
        
        for district, avg in districts.items():
            assert isinstance(avg, (int, float))
            assert 0 <= avg <= 100
            
    def test_weekly_report_category_breakdown(self):
        """Test category breakdown contains expected categories"""
        response = requests.get(f"{BASE_URL}/api/report/weekly")
        assert response.status_code == 200
        data = response.json()
        
        categories = data["category_breakdown"]
        expected_cats = ["nightclub", "lounge", "restaurant", "bar", "event_space"]
        
        for cat in expected_cats:
            assert cat in categories, f"Missing category: {cat}"
            assert isinstance(categories[cat], (int, float))


class TestExistingEndpoints:
    """Test existing endpoints still work"""
    
    def test_city_pulse(self):
        """Test city pulse endpoint"""
        response = requests.get(f"{BASE_URL}/api/v1/agent/city/pulse?city=lagos")
        assert response.status_code == 200
        data = response.json()
        assert data["city"] == "lagos"
        assert "avg_vibe_score" in data
        assert "top_venues" in data
        
    def test_venues_live(self):
        """Test venues live endpoint"""
        response = requests.get(f"{BASE_URL}/api/v1/agent/venues/live?city=lagos&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["city"] == "lagos"
        assert len(data["venues"]) <= 5
        
    def test_venue_detail(self):
        """Test venue detail endpoint"""
        response = requests.get(f"{BASE_URL}/api/v1/agent/venues/quilox-vi")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Quilox"
        assert data["id"] == "quilox-vi"
        
    def test_waitlist_stats(self):
        """Test waitlist stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/waitlist/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "by_role" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
