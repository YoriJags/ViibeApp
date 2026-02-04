#!/usr/bin/env python3
"""
Vibe App v3 Backend Testing - Focus on NEW v3 Features
Tests: Merchant Wallet System, Wallet-based Pulse Drop Purchase, ROI Metrics, Offline Rating Sync, Super-Admin Treasury
NOTE: Fast Pass has been REMOVED from v3 - only Pulse Drops remain
"""

import asyncio
import json
import sys
from datetime import datetime, timezone, timedelta
import aiohttp
import uuid

# Backend URL from environment
BASE_URL = "https://pulse-drop.preview.emergentagent.com/api"

class VibeAppV3Tester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = None
        self.test_user_id = None
        self.admin_user_id = None
        self.admin_token = None
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
        print(f"🔧 Setting up Vibe App v3 tests for {self.base_url}")
        
        # Seed test data
        try:
            async with self.session.post(f"{self.base_url}/seed") as resp:
                if resp.status == 200:
                    seed_data = await resp.json()
                    self.test_user_id = seed_data.get("test_user_id")
                    self.admin_user_id = seed_data.get("admin_user_id")
                    print(f"✅ Test data seeded - User ID: {self.test_user_id}, Admin ID: {self.admin_user_id}")
                    
                    # Get venues for testing
                    async with self.session.get(f"{self.base_url}/venues?city=lagos") as venues_resp:
                        if venues_resp.status == 200:
                            self.test_venues = await venues_resp.json()
                            print(f"✅ Retrieved {len(self.test_venues)} test venues")
                        else:
                            print(f"❌ Failed to get venues: {venues_resp.status}")
                            return False
                    
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

    async def test_merchant_wallet_system(self):
        """Test merchant wallet balance and top-up flow"""
        print("\n💰 Testing Merchant Wallet System")
        
        if not self.test_venues:
            self.log_test("Wallet System Prerequisites", False, "No test venues available", critical=True)
            return
        
        venue_id = self.test_venues[0]["id"]
        
        # Test wallet balance endpoint
        try:
            async with self.session.get(f"{self.base_url}/merchant/wallet/{venue_id}") as resp:
                if resp.status == 200:
                    wallet_data = await resp.json()
                    
                    has_wallet = "wallet" in wallet_data
                    has_transactions = "transactions" in wallet_data
                    balance = wallet_data.get("wallet", {}).get("balance", 0)
                    
                    self.log_test("Get Merchant Wallet Balance", has_wallet and has_transactions,
                                f"Balance: ₦{balance:,}, Transactions: {len(wallet_data.get('transactions', []))}")
                    
                    # Store initial balance for later tests
                    self.initial_balance = balance
                else:
                    error_text = await resp.text()
                    self.log_test("Get Merchant Wallet Balance", False, f"HTTP {resp.status}: {error_text}", critical=True)
                    return
        except Exception as e:
            self.log_test("Get Merchant Wallet Balance", False, str(e), critical=True)
            return

        # Test wallet top-up initialization
        try:
            topup_data = {
                "amount": 10000,
                "email": "merchant@test.com"
            }
            
            async with self.session.post(f"{self.base_url}/merchant/wallet/{venue_id}/topup/initialize", json=topup_data) as resp:
                if resp.status == 200:
                    topup_response = await resp.json()
                    
                    has_url = "authorization_url" in topup_response
                    has_ref = "reference" in topup_response
                    is_mock = topup_response.get("mock", False)
                    
                    self.log_test("Wallet Top-up Initialization", has_url and has_ref,
                                f"Auth URL present: {has_url}, Reference: {topup_response.get('reference')}, Mock: {is_mock}")
                    
                    # Store reference for verification test
                    self.topup_reference = topup_response.get("reference")
                else:
                    error_text = await resp.text()
                    self.log_test("Wallet Top-up Initialization", False, f"HTTP {resp.status}: {error_text}")
        except Exception as e:
            self.log_test("Wallet Top-up Initialization", False, str(e))

        # Test wallet top-up verification (simulated)
        if hasattr(self, 'topup_reference'):
            try:
                async with self.session.post(f"{self.base_url}/merchant/wallet/verify/{self.topup_reference}") as resp:
                    if resp.status == 200:
                        verify_response = await resp.json()
                        success = verify_response.get("success", False)
                        new_balance = verify_response.get("new_balance", 0)
                        
                        self.log_test("Wallet Top-up Verification", success,
                                    f"Success: {success}, New balance: ₦{new_balance:,}")
                        
                        # Update balance for pulse drop test
                        self.current_balance = new_balance
                    else:
                        error_text = await resp.text()
                        self.log_test("Wallet Top-up Verification", False, f"HTTP {resp.status}: {error_text}")
            except Exception as e:
                self.log_test("Wallet Top-up Verification", False, str(e))

    async def test_pulse_drop_wallet_purchase(self):
        """Test purchasing pulse drops using wallet balance (not credit card)"""
        print("\n💫 Testing Pulse Drop Purchase from Wallet")
        
        if not self.test_venues:
            self.log_test("Pulse Drop Purchase Prerequisites", False, "No test venues available", critical=True)
            return
        
        venue_id = self.test_venues[0]["id"]
        
        # Get initial wallet balance
        try:
            async with self.session.get(f"{self.base_url}/merchant/wallet/{venue_id}") as resp:
                if resp.status == 200:
                    wallet_data = await resp.json()
                    initial_balance = wallet_data.get("wallet", {}).get("balance", 0)
                else:
                    self.log_test("Pre-purchase Wallet Check", False, f"HTTP {resp.status}", critical=True)
                    return
        except Exception as e:
            self.log_test("Pre-purchase Wallet Check", False, str(e), critical=True)
            return

        # Test Spark tier purchase (₦5,000)
        try:
            pulse_data = {
                "venue_id": venue_id,
                "tier": "spark",
                "message": "Test Spark pulse drop from wallet!"
            }
            
            async with self.session.post(f"{self.base_url}/pulse-drops/purchase", json=pulse_data) as resp:
                if resp.status == 200:
                    purchase_response = await resp.json()
                    
                    has_pulse_drop = "pulse_drop" in purchase_response
                    new_wallet_balance = purchase_response.get("new_wallet_balance", 0)
                    pulse_drop = purchase_response.get("pulse_drop", {})
                    
                    # Verify wallet deduction (should be ₦5,000 less)
                    expected_balance = initial_balance - 5000
                    balance_correct = abs(new_wallet_balance - expected_balance) < 1
                    
                    # Verify pulse drop details
                    tier_correct = pulse_drop.get("tier") == "spark"
                    price_correct = pulse_drop.get("price_paid") == 5000
                    
                    self.log_test("Spark Tier Purchase from Wallet", 
                                has_pulse_drop and balance_correct and tier_correct and price_correct,
                                f"Initial: ₦{initial_balance:,} → New: ₦{new_wallet_balance:,} (deducted ₦{initial_balance - new_wallet_balance:,})")
                    
                elif resp.status == 402:  # Insufficient balance
                    error_data = await resp.json()
                    self.log_test("Spark Tier Purchase from Wallet", False, 
                                f"Insufficient balance: {error_data.get('detail', 'No details')}", critical=True)
                else:
                    error_text = await resp.text()
                    self.log_test("Spark Tier Purchase from Wallet", False, f"HTTP {resp.status}: {error_text}", critical=True)
        except Exception as e:
            self.log_test("Spark Tier Purchase from Wallet", False, str(e), critical=True)

        # Verify wallet balance after purchase
        try:
            async with self.session.get(f"{self.base_url}/merchant/wallet/{venue_id}") as resp:
                if resp.status == 200:
                    wallet_data = await resp.json()
                    final_balance = wallet_data.get("wallet", {}).get("balance", 0)
                    transactions = wallet_data.get("transactions", [])
                    
                    # Check for pulse drop transaction
                    pulse_tx = next((tx for tx in transactions if tx.get("type") == "pulse_drop_spend"), None)
                    has_pulse_tx = pulse_tx is not None
                    
                    self.log_test("Post-purchase Wallet Verification", has_pulse_tx,
                                f"Final balance: ₦{final_balance:,}, Pulse drop transaction found: {has_pulse_tx}")
                else:
                    self.log_test("Post-purchase Wallet Verification", False, f"HTTP {resp.status}")
        except Exception as e:
            self.log_test("Post-purchase Wallet Verification", False, str(e))

    async def test_merchant_roi_metrics(self):
        """Test merchant ROI metrics including heatmap delta, profile views, direction clicks"""
        print("\n📊 Testing Merchant ROI Metrics")
        
        if not self.test_venues:
            self.log_test("ROI Metrics Prerequisites", False, "No test venues available", critical=True)
            return
        
        venue_id = self.test_venues[0]["id"]
        
        # Test direction click recording
        try:
            async with self.session.post(f"{self.base_url}/venues/{venue_id}/direction-click") as resp:
                if resp.status == 200:
                    click_response = await resp.json()
                    message_correct = "Direction click recorded" in click_response.get("message", "")
                    self.log_test("Direction Click Recording", message_correct, f"Response: {click_response}")
                else:
                    error_text = await resp.text()
                    self.log_test("Direction Click Recording", False, f"HTTP {resp.status}: {error_text}")
        except Exception as e:
            self.log_test("Direction Click Recording", False, str(e))

        # Test venue stats with ROI metrics
        try:
            async with self.session.get(f"{self.base_url}/merchant/venue/{venue_id}/stats") as resp:
                if resp.status == 200:
                    stats = await resp.json()
                    
                    # Check required sections
                    required_sections = ["venue", "stats", "heatmap_delta", "pulse_drop_roi", "hourly_trend", "competitors"]
                    has_all_sections = all(section in stats for section in required_sections)
                    
                    # Check ROI-specific metrics
                    stats_section = stats.get("stats", {})
                    has_profile_views = "profile_views" in stats_section
                    has_direction_clicks = "direction_clicks" in stats_section
                    
                    # Check heatmap delta calculation
                    heatmap_delta = stats.get("heatmap_delta", {})
                    has_venue_score = "venue_score" in heatmap_delta
                    has_district_avg = "district_average" in heatmap_delta
                    has_delta = "delta" in heatmap_delta
                    
                    heatmap_valid = has_venue_score and has_district_avg and has_delta
                    
                    # Check pulse drop ROI tracking
                    pulse_roi = stats.get("pulse_drop_roi", [])
                    roi_structure_valid = True
                    if pulse_roi:
                        first_roi = pulse_roi[0]
                        roi_structure_valid = all(key in first_roi for key in 
                                                ["tier", "price", "profile_views_gained", "direction_clicks_gained"])
                    
                    self.log_test("Merchant ROI Metrics Endpoint", 
                                has_all_sections and has_profile_views and has_direction_clicks and heatmap_valid,
                                f"Profile views: {stats_section.get('profile_views', 'N/A')}, "
                                f"Direction clicks: {stats_section.get('direction_clicks', 'N/A')}, "
                                f"Heatmap delta: {heatmap_delta.get('delta', 'N/A')}")
                    
                    # Verify wallet balance is included
                    wallet_balance = stats.get("wallet_balance", None)
                    has_wallet_balance = wallet_balance is not None
                    
                    self.log_test("Wallet Balance in Stats", has_wallet_balance,
                                f"Wallet balance: ₦{wallet_balance:,}" if wallet_balance else "Wallet balance missing")
                    
                else:
                    error_text = await resp.text()
                    self.log_test("Merchant ROI Metrics Endpoint", False, f"HTTP {resp.status}: {error_text}", critical=True)
        except Exception as e:
            self.log_test("Merchant ROI Metrics Endpoint", False, str(e), critical=True)

    async def test_offline_rating_sync(self):
        """Test offline rating synchronization endpoint"""
        print("\n🔄 Testing Offline Rating Sync")
        
        if not self.test_venues or not self.test_user_id:
            self.log_test("Offline Sync Prerequisites", False, "Missing venues or user ID", critical=True)
            return
        
        venue = self.test_venues[0]
        venue_id = venue["id"]
        venue_coords = venue["coordinates"]
        
        # Prepare offline ratings data
        offline_ratings = [
            {
                "user_id": self.test_user_id,
                "venue_id": venue_id,
                "energy": "popping",
                "capacity": "vibrant",
                "gate": "clear",
                "coordinates": {
                    "lat": venue_coords["lat"],
                    "lng": venue_coords["lng"]
                },
                "offline_id": f"offline_{uuid.uuid4().hex[:8]}"
            },
            {
                "user_id": self.test_user_id,
                "venue_id": venue_id,
                "energy": "electric", 
                "capacity": "full",
                "gate": "slow",
                "coordinates": {
                    "lat": venue_coords["lat"],
                    "lng": venue_coords["lng"]
                },
                "offline_id": f"offline_{uuid.uuid4().hex[:8]}"
            }
        ]
        
        try:
            sync_data = {"ratings": offline_ratings}
            
            async with self.session.post(f"{self.base_url}/ratings/sync", json=sync_data) as resp:
                if resp.status == 200:
                    sync_response = await resp.json()
                    synced = sync_response.get("synced", [])
                    
                    # Check sync results
                    total_synced = len(synced)
                    successful_syncs = len([s for s in synced if s.get("success")])
                    failed_syncs = len([s for s in synced if not s.get("success")])
                    
                    # At least one should succeed (first rating), second might fail due to rate limit
                    has_successes = successful_syncs > 0
                    all_have_offline_id = all("offline_id" in s for s in synced)
                    
                    self.log_test("Offline Rating Sync", has_successes and all_have_offline_id,
                                f"Total: {total_synced}, Successful: {successful_syncs}, Failed: {failed_syncs}")
                    
                    # Log details of any failures
                    for sync_result in synced:
                        if not sync_result.get("success"):
                            print(f"   Failed sync - Offline ID: {sync_result.get('offline_id')}, Error: {sync_result.get('error', 'Unknown')}")
                            
                else:
                    error_text = await resp.text()
                    self.log_test("Offline Rating Sync", False, f"HTTP {resp.status}: {error_text}", critical=True)
        except Exception as e:
            self.log_test("Offline Rating Sync", False, str(e), critical=True)

    async def test_super_admin_treasury(self):
        """Test super-admin treasury endpoint (requires authentication)"""
        print("\n🏛️ Testing Super-Admin Treasury")
        
        if not self.admin_user_id:
            self.log_test("Super Admin Treasury Prerequisites", False, "No admin user ID", critical=True)
            return
        
        # Note: In a real scenario, we'd need to authenticate as admin first
        # For this test, we'll attempt the call and handle auth appropriately
        
        try:
            # Attempt treasury call without auth first (should fail)
            async with self.session.get(f"{self.base_url}/admin/treasury") as resp:
                if resp.status == 403:
                    self.log_test("Treasury Auth Protection", True, "Correctly rejected unauthenticated request")
                elif resp.status == 200:
                    # If it somehow worked without auth, that's concerning but let's test the response
                    treasury_data = await resp.json()
                    
                    required_sections = ["global", "revenue_by_city", "revenue_by_tier", "network_health"]
                    has_all_sections = all(section in treasury_data for section in required_sections)
                    
                    # Check global stats
                    global_stats = treasury_data.get("global", {})
                    has_total_revenue = "total_revenue" in global_stats
                    has_today_revenue = "today_revenue" in global_stats
                    
                    # Check network health
                    network_health = treasury_data.get("network_health", {})
                    has_active_connections = "active_connections" in network_health
                    has_venue_stats = "total_venues" in network_health and "verified_venues" in network_health
                    
                    self.log_test("Super Admin Treasury Endpoint", 
                                has_all_sections and has_total_revenue and has_today_revenue and has_venue_stats,
                                f"Total revenue: ₦{global_stats.get('total_revenue', 0):,}, "
                                f"Active connections: {network_health.get('active_connections', 'N/A')}, "
                                f"Total venues: {network_health.get('total_venues', 'N/A')}")
                else:
                    error_text = await resp.text()
                    self.log_test("Super Admin Treasury Endpoint", False, f"HTTP {resp.status}: {error_text}")
                    
        except Exception as e:
            self.log_test("Super Admin Treasury Endpoint", False, str(e))

    async def run_all_tests(self):
        """Execute all v3-specific test suites"""
        print("🚀 Starting Vibe App v3 Backend Testing")
        print("🚨 NOTE: Fast Pass has been REMOVED - only Pulse Drops remain")
        print("=" * 70)
        
        # Setup
        if not await self.setup():
            print("❌ Setup failed, aborting tests")
            return False

        # Test API health first
        try:
            async with self.session.get(f"{self.base_url}/health") as resp:
                if resp.status != 200:
                    print("❌ API health check failed, aborting tests")
                    return False
                print("✅ API health check passed")
        except Exception as e:
            print(f"❌ API health check failed: {e}")
            return False

        # Run v3-specific feature tests
        await self.test_merchant_wallet_system()
        await self.test_pulse_drop_wallet_purchase()  
        await self.test_merchant_roi_metrics()
        await self.test_offline_rating_sync()
        await self.test_super_admin_treasury()

        # Results summary
        print("\n" + "=" * 70)
        print("🏁 VIBE APP v3 TEST RESULTS SUMMARY")
        print("=" * 70)
        
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
        else:
            print("\n🎉 NO CRITICAL FAILURES - All core v3 systems functional!")
        
        print(f"\n📍 Tested against: {self.base_url}")
        print("📋 Key v3 Features Tested:")
        print("   • Merchant Wallet System (balance, top-up)")
        print("   • Wallet-based Pulse Drop Purchase")
        print("   • Merchant ROI Metrics (heatmap delta, clicks, views)")
        print("   • Offline Rating Synchronization")
        print("   • Super-Admin Treasury Dashboard")
        
        # Cleanup
        await self.cleanup()
        
        return len(self.results["critical_failures"]) == 0


async def main():
    """Main test runner for Vibe App v3"""
    tester = VibeAppV3Tester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())