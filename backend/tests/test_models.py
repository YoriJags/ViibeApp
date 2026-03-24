"""
Unit tests for app.models — Pydantic model validation.

These tests document the expected shape of data at API boundaries
and catch regressions if field types or defaults change.
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models import (
    User,
    UserCreate,
    Venue,
    Rating,
    RatingCreate,
    Coordinates,
    MerchantWallet,
    WalletTransaction,
    PulseDrop,
    VibeStreak,
    SurgeBooking,
)

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Coordinates
# ---------------------------------------------------------------------------

class TestCoordinates:
    def test_valid_coordinates(self):
        c = Coordinates(lat=6.4281, lng=3.4219)
        assert c.lat == 6.4281
        assert c.lng == 3.4219

    def test_rejects_missing_field(self):
        with pytest.raises(ValidationError):
            Coordinates(lat=6.4281)  # missing lng


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class TestUser:
    def test_minimal_user_has_defaults(self):
        u = User(username="tunde", phone="+2348000000001")
        assert u.clout_points == 0
        assert u.scout_status == "newbie"
        assert u.is_admin is False
        assert u.is_merchant is False
        assert u.home_city == "lagos"
        assert u.auth_provider == "local"
        assert isinstance(u.id, str) and len(u.id) == 36  # UUID4

    def test_scout_status_values(self):
        for status in ("newbie", "regular", "scout", "elite"):
            u = User(username="x", phone="+234800", scout_status=status)
            assert u.scout_status == status

    def test_invalid_scout_status_rejected(self):
        with pytest.raises(ValidationError):
            User(username="x", phone="+234800", scout_status="god_tier")

    def test_auth_provider_values(self):
        for provider in ("local", "google", "apple"):
            u = User(username="x", phone="+234800", auth_provider=provider)
            assert u.auth_provider == provider

    def test_created_at_is_datetime(self):
        u = User(username="x", phone="+234800")
        assert isinstance(u.created_at, datetime)


# ---------------------------------------------------------------------------
# UserCreate
# ---------------------------------------------------------------------------

class TestUserCreate:
    def test_valid_creation(self):
        uc = UserCreate(username="scout_ada", phone="+2348012345678")
        assert uc.username == "scout_ada"

    def test_rejects_missing_phone(self):
        with pytest.raises(ValidationError):
            UserCreate(username="ada")


# ---------------------------------------------------------------------------
# Venue
# ---------------------------------------------------------------------------

class TestVenue:
    def _base_venue(self, **kwargs):
        defaults = dict(
            name="Club Quilox",
            address="10 Ozumba Mbadiwe",
            area="Victoria Island",
            coordinates=Coordinates(lat=6.4281, lng=3.4219),
        )
        defaults.update(kwargs)
        return Venue(**defaults)

    def test_minimal_venue_has_defaults(self):
        v = self._base_venue()
        assert v.current_vibe_score == 0.0
        assert v.energy_level == "quiet"
        assert v.city == "lagos"
        assert v.claim_status == "unclaimed"
        assert v.is_featured is False

    def test_venue_type_validation(self):
        valid_types = ["club", "lounge", "restaurant", "bar", "church", "concert", "rave", "block_party", "festival", "event", "other"]
        for vtype in valid_types:
            v = self._base_venue(venue_type=vtype)
            assert v.venue_type == vtype

    def test_invalid_venue_type_rejected(self):
        with pytest.raises(ValidationError):
            self._base_venue(venue_type="disco")

    def test_pulse_drop_tier_values(self):
        for tier in ("spark", "flare", "supernova"):
            v = self._base_venue(active_pulse_tier=tier)
            assert v.active_pulse_tier == tier

    def test_operating_hours_optional(self):
        v = self._base_venue()
        assert v.operating_hours is None


# ---------------------------------------------------------------------------
# Rating / RatingCreate
# ---------------------------------------------------------------------------

class TestRating:
    def test_valid_rating(self):
        r = Rating(
            user_id="user-1",
            venue_id="venue-1",
            energy="lit",
            capacity="full",
            gate="clear",
        )
        assert r.vibe_score == 0.0  # default before calculation
        assert r.is_correction is False

    def test_invalid_energy_rejected(self):
        with pytest.raises(ValidationError):
            Rating(user_id="u", venue_id="v", energy="electric", capacity="full", gate="clear")

    def test_invalid_capacity_rejected(self):
        with pytest.raises(ValidationError):
            Rating(user_id="u", venue_id="v", energy="lit", capacity="packed", gate="clear")

    def test_invalid_gate_rejected(self):
        with pytest.raises(ValidationError):
            Rating(user_id="u", venue_id="v", energy="lit", capacity="full", gate="open")


class TestRatingCreate:
    def test_valid_rating_create(self):
        rc = RatingCreate(
            user_id="u-1",
            venue_id="v-1",
            energy="peak",
            capacity="full",
            gate="slow",
            coordinates=Coordinates(lat=6.4281, lng=3.4219),
        )
        assert rc.offline_id is None


# ---------------------------------------------------------------------------
# MerchantWallet & WalletTransaction
# ---------------------------------------------------------------------------

class TestMerchantWallet:
    def test_default_balances_zero(self):
        w = MerchantWallet(merchant_id="m-1", venue_id="v-1")
        assert w.balance == 0.0
        assert w.total_deposited == 0.0
        assert w.total_spent == 0.0

    def test_wallet_id_is_uuid(self):
        w = MerchantWallet(merchant_id="m-1", venue_id="v-1")
        assert len(w.id) == 36


class TestWalletTransaction:
    def test_valid_transaction_types(self):
        for ttype in ("deposit", "pulse_drop_spend", "spotlight_spend", "refund"):
            t = WalletTransaction(
                wallet_id="w-1",
                type=ttype,
                amount=5000,
                balance_before=10000,
                balance_after=5000,
                description="test",
            )
            assert t.type == ttype

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            WalletTransaction(
                wallet_id="w-1",
                type="withdrawal",
                amount=5000,
                balance_before=10000,
                balance_after=5000,
                description="test",
            )


# ---------------------------------------------------------------------------
# VibeStreak
# ---------------------------------------------------------------------------

class TestVibeStreak:
    def test_defaults(self):
        s = VibeStreak()
        assert s.current_streak == 0
        assert s.longest_streak == 0
        assert s.multiplier == 1.0
        assert s.milestones_claimed == []


# ---------------------------------------------------------------------------
# SurgeBooking
# ---------------------------------------------------------------------------

class TestSurgeBooking:
    def test_default_status(self):
        from datetime import timezone
        sb = SurgeBooking(
            venue_id="v-1",
            merchant_id="m-1",
            scheduled_at=datetime.now(timezone.utc),
        )
        assert sb.status == "pending_payment"
        assert sb.tier == "spark"
