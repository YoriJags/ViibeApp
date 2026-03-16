"""
Vibe App - Pydantic Models
All data models used across the application.
"""
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional, Literal


# ===== Shared =====

class Coordinates(BaseModel):
    lat: float
    lng: float


# ===== Users =====

class UserCreate(BaseModel):
    username: str
    phone: str


class UserLogin(BaseModel):
    phone: str


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    phone: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: Literal["local", "google", "apple"] = "local"
    clout_points: int = 0
    scout_status: Literal["newbie", "regular", "scout", "elite"] = "newbie"
    rating_accuracy_score: float = 0.0
    total_ratings: int = 0
    home_city: str = "lagos"
    is_admin: bool = False
    is_super_admin: bool = False
    is_merchant: bool = False
    merchant_venue_id: Optional[str] = None
    # ===== Vibe+ Subscription =====
    is_vibe_plus: bool = False
    vibe_plus_expires_at: Optional[datetime] = None
    vibe_plus_reference: Optional[str] = None   # most recent successful payment ref
    # ===== Icons System =====
    icon_tier: Optional[Literal["verified", "icon", "legend"]] = None  # None = regular scout
    icon_label: Optional[str] = None  # e.g. "DJ", "Dancer", "Artist", "Socialite"
    icon_granted_at: Optional[datetime] = None
    # ===== Scout Gamification =====
    streak_freezes: int = 0           # clout-purchasable streak insurance
    music_preferences: list[str] = [] # genre list bridged from music streaming mock
    zodiac_sign: Optional[str] = None # optional — set during onboarding, drives Cosmic Vibe reading
    reactor_skin: Optional[str] = None # preset key or "custom:#RRGGBB"
    call_name: Optional[str] = None    # what the user wants to be called in the app
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===== Venues =====

class Venue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    area: str
    city: str = "lagos"
    venue_type: Literal["club", "lounge", "restaurant", "bar", "church", "concert", "rave", "block_party", "festival", "event", "other"] = "club"
    coordinates: Coordinates
    current_vibe_score: float = 0.0
    energy_level: Literal["quiet", "chill", "warming", "charged", "lit", "peak"] = "quiet"
    vibe_state: Optional[str] = None          # derived display state (quiet/chill/warming/charged/lit/peak)
    viibe_certified: bool = False
    viibe_certified_at: Optional[datetime] = None
    capacity_level: Literal["sparse", "vibrant", "full"] = "sparse"
    gate_level: Literal["clear", "slow", "blocked"] = "clear"
    vibe_velocity: Literal["heating_up", "cooling_down", "stable"] = "stable"
    total_ratings_24h: int = 0
    owner_id: Optional[str] = None
    is_featured: bool = False
    is_verified: bool = False
    photo_base64: Optional[str] = None
    entry_fee: Optional[str] = None
    music_genre: Optional[str] = None
    tables_available: bool = True
    last_snapshot_url: Optional[str] = None
    last_snapshot_time: Optional[datetime] = None
    active_pulse_tier: Optional[Literal["spark", "flare", "supernova"]] = None
    pulse_expires_at: Optional[datetime] = None
    custom_icon: Optional[str] = None
    glow_boost: float = 0
    profile_views: int = 0
    direction_clicks: int = 0
    admin_override_score: Optional[float] = None
    is_suppressed: bool = False
    geofence_radius_m: float = 100
    spotlight_until: Optional[datetime] = None
    # operating_hours: dict keyed by 3-letter day ("mon"–"sun")
    # Each day: {"open": "HH:MM", "close": "HH:MM"} or null if closed that day
    # close < open means crosses midnight (e.g. open 22:00 close 04:00)
    operating_hours: Optional[dict] = None
    # Persistent reputation — cached from the reputation endpoint
    vibe_tier: Optional[str] = None          # "Elite" | "Established" | "Solid" | "Building" | "New"
    avg_score_30d: float = 0.0
    reputation_score: float = 0.0
    # Self-serve merchant onboarding
    claim_status: Literal["unclaimed", "pending", "claimed"] = "unclaimed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VenueUpdateRequest(BaseModel):
    entry_fee: Optional[str] = None
    music_genre: Optional[str] = None
    geofence_radius_m: Optional[float] = None
    tables_available: Optional[bool] = None
    operating_hours: Optional[dict] = None


# ===== Ratings =====

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    energy: Literal["quiet", "chill", "warming", "lit", "peak"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    venue_specific: Optional[str] = None  # venue-type dimension (dj, service, ambience, etc.)
    photo_base64: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_correction: bool = False
    vibe_score: float = 0.0
    synced: bool = True


class RatingCreate(BaseModel):
    user_id: str
    venue_id: str
    energy: Literal["quiet", "chill", "warming", "lit", "peak"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    venue_specific: Optional[str] = None  # venue-type dimension value
    photo_base64: Optional[str] = None
    coordinates: Coordinates
    offline_id: Optional[str] = None


# ===== Merchant Wallet =====

class MerchantWallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    venue_id: str
    balance: float = 0.0
    total_deposited: float = 0.0
    total_spent: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WalletTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet_id: str
    type: Literal["deposit", "pulse_drop_spend", "spotlight_spend", "refund"]
    amount: float
    balance_before: float
    balance_after: float
    reference: Optional[str] = None
    pulse_drop_id: Optional[str] = None
    paystack_reference: Optional[str] = None
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===== Pulse Drops =====

class PulseDrop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    venue_name: str = ""
    tier: Literal["spark", "flare", "supernova"]
    message: str
    radius_km: float
    glow_boost: float
    chart_placement: Optional[int] = None
    price_paid: float
    city: str
    expires_at: datetime
    profile_views_before: int = 0
    profile_views_after: int = 0
    direction_clicks_before: int = 0
    direction_clicks_after: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PulseDropCreate(BaseModel):
    venue_id: str
    tier: Literal["spark", "flare", "supernova"]
    message: str


# ===== Platform =====

class PlatformRevenue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["pulse_drop"]
    venue_id: str
    venue_name: str
    amount: float
    tier: Optional[str] = None
    city: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdminOverride(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    admin_id: str
    override_type: Literal["boost", "suppress", "verify", "unverify", "score_override"]
    override_value: Optional[float] = None
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AirdropRequest(BaseModel):
    user_ids: list[str]
    amount: int
    reason: str


# ===== Lobby (Shortlist) =====

class LobbyEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LobbyAddRequest(BaseModel):
    venue_id: str


class LobbyRemoveRequest(BaseModel):
    venue_id: str


# ===== Ghost Check-ins =====

class GhostCheckin(BaseModel):
    venue_id: str
    latitude: float
    longitude: float


# ===== Vibe Streaks =====

class VibeStreak(BaseModel):
    current_streak: int = 0
    longest_streak: int = 0
    last_activity_date: str = ""  # "YYYY-MM-DD"
    multiplier: float = 1.0
    milestones_claimed: list[int] = []


# ===== Venue Stories =====

class VenueStory(BaseModel):
    venue_id: str
    media_url: str
    caption: str = ""
    latitude: float
    longitude: float


# ===== Crews =====

class CrewCreate(BaseModel):
    name: str  # Max 20 chars


class CrewJoin(BaseModel):
    invite_code: str


class CrewVoteStart(BaseModel):
    venue_ids: list[str]  # 2-4 venues


class CrewVoteCast(BaseModel):
    venue_id: str


# ===== Alert Preferences =====

class AlertRegister(BaseModel):
    expo_push_token: str


class AlertPreferences(BaseModel):
    lobby_alerts: bool = True
    streak_reminders: bool = True
    crew_alerts: bool = True
    nearby_alerts: bool = False


# ===== Aura Shield =====

class AuraShieldConfig(BaseModel):
    enabled: bool = False
    threshold: int = 50
    alert_on: list[str] = ["score_drop"]


# ===== Energy Campaigns =====

class CampaignCreate(BaseModel):
    multiplier: int  # 2 or 3
    duration_hours: int  # 2, 4, or 8


# ===== Surge Booking (Merchant Portal) =====

class SurgeBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    merchant_id: str
    scheduled_at: datetime
    duration_hours: int = 2               # how long the surge window runs
    tier: Literal["spark", "flare", "supernova"] = "spark"
    price_ngn: float = 0.0
    paystack_reference: Optional[str] = None
    paystack_access_code: Optional[str] = None
    status: Literal["pending_payment", "scheduled", "active", "expired", "cancelled"] = "pending_payment"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SurgeBookingCreate(BaseModel):
    scheduled_at: datetime
    duration_hours: int = 2
    tier: Literal["spark", "flare", "supernova"] = "spark"


# ===== Music Preferences =====

class MusicPreferencesUpdate(BaseModel):
    genres: list[str]  # e.g. ["Afrobeats", "Amapiano", "House", "Afro-Pop"]


class ReactorSkinUpdate(BaseModel):
    skin: str  # preset key (e.g. "gold") or "custom:#RRGGBB"


class ZodiacUpdate(BaseModel):
    sign: Optional[str] = None  # e.g. "aries" — None clears the sign
