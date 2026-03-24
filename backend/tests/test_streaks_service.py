"""
Unit tests for app.services.streaks.

The streak service contains meaningful branching logic (consecutive day,
gap of 2 with/without freeze, larger gap reset, milestone detection) that
is well-suited to unit testing with a mocked DB.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta

from app.services.streaks import get_multiplier, update_streak, get_streak, STREAK_MILESTONES

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# get_multiplier (pure function — no DB)
# ---------------------------------------------------------------------------

class TestGetMultiplier:
    def test_zero_streak_returns_one(self):
        assert get_multiplier(0) == pytest.approx(1.0)

    def test_one_day_streak(self):
        assert get_multiplier(1) == pytest.approx(1.1)

    def test_five_day_streak(self):
        assert get_multiplier(5) == pytest.approx(1.5)

    def test_ten_day_streak_hits_cap(self):
        assert get_multiplier(10) == pytest.approx(2.0)

    def test_multiplier_caps_at_two(self):
        # 10+ days should all return 2.0
        assert get_multiplier(20) == pytest.approx(2.0)
        assert get_multiplier(100) == pytest.approx(2.0)

    def test_multiplier_increases_with_streak(self):
        assert get_multiplier(3) > get_multiplier(2) > get_multiplier(1)


# ---------------------------------------------------------------------------
# update_streak
# ---------------------------------------------------------------------------

class TestUpdateStreak:
    def _make_streak_doc(self, current=5, longest=5, days_ago=1, milestones=None):
        """Build a fake streak document where last_activity was `days_ago` days ago."""
        last_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        return {
            "user_id": "user-abc",
            "current_streak": current,
            "longest_streak": longest,
            "last_activity_date": last_date,
            "multiplier": get_multiplier(current),
            "milestones_claimed": milestones or [],
        }

    @pytest.mark.asyncio
    async def test_first_ever_activity_creates_streak(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(return_value=None)
        result = await update_streak("user-new")

        assert result["current_streak"] == 1
        assert result["extended"] is True
        assert result["multiplier"] == pytest.approx(1.1)
        mock_db.streaks.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_consecutive_day_extends_streak(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(return_value=self._make_streak_doc(current=4, days_ago=1))
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        assert result["current_streak"] == 5
        assert result["extended"] is True

    @pytest.mark.asyncio
    async def test_same_day_activity_does_not_extend(self, mock_db):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        doc = {
            "user_id": "user-abc",
            "current_streak": 3,
            "longest_streak": 3,
            "last_activity_date": today,
            "multiplier": get_multiplier(3),
            "milestones_claimed": [],
        }
        mock_db.streaks.find_one = AsyncMock(return_value=doc)

        result = await update_streak("user-abc")

        assert result["extended"] is False
        assert result["current_streak"] == 3
        mock_db.streaks.update_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_two_day_gap_without_freeze_resets_streak(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(return_value=self._make_streak_doc(current=10, days_ago=2))
        mock_db.users.find_one = AsyncMock(return_value={"streak_freezes": 0})
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        assert result["current_streak"] == 1

    @pytest.mark.asyncio
    async def test_two_day_gap_with_freeze_preserves_streak(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(return_value=self._make_streak_doc(current=10, days_ago=2))
        mock_db.users.find_one = AsyncMock(return_value={"streak_freezes": 2})
        mock_db.users.update_one = AsyncMock()
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        assert result["current_streak"] == 10
        mock_db.users.update_one.assert_called_once()  # freeze consumed

    @pytest.mark.asyncio
    async def test_large_gap_always_resets(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(return_value=self._make_streak_doc(current=30, days_ago=5))
        mock_db.users.find_one = AsyncMock(return_value={"streak_freezes": 99})
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        assert result["current_streak"] == 1

    @pytest.mark.asyncio
    async def test_milestone_3_awards_clout(self, mock_db):
        # Streak currently at 2, activity today extends to 3 (hits milestone)
        mock_db.streaks.find_one = AsyncMock(return_value=self._make_streak_doc(current=2, days_ago=1))
        mock_db.users.update_one = AsyncMock()
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        assert result["current_streak"] == 3
        assert result["milestone"] is not None
        assert result["milestone"]["clout"] == STREAK_MILESTONES[3]["clout"]
        # Verify clout was credited
        mock_db.users.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_milestone_not_awarded_twice(self, mock_db):
        # Already claimed milestone 3
        doc = self._make_streak_doc(current=2, days_ago=1, milestones=[3])
        mock_db.streaks.find_one = AsyncMock(return_value=doc)
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        assert result["milestone"] is None

    @pytest.mark.asyncio
    async def test_longest_streak_never_decreases(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(
            return_value=self._make_streak_doc(current=2, longest=20, days_ago=3)
        )
        mock_db.streaks.update_one = AsyncMock()

        result = await update_streak("user-abc")

        # streak resets to 1, but longest should remain 20
        call_args = mock_db.streaks.update_one.call_args
        update_doc = call_args[0][1]["$set"]
        assert update_doc["longest_streak"] == 20


# ---------------------------------------------------------------------------
# get_streak
# ---------------------------------------------------------------------------

class TestGetStreak:
    @pytest.mark.asyncio
    async def test_no_streak_returns_empty_defaults(self, mock_db):
        mock_db.streaks.find_one = AsyncMock(return_value=None)

        result = await get_streak("user-new")

        assert result["current_streak"] == 0
        assert result["longest_streak"] == 0
        assert result["multiplier"] == 1.0
        assert result["next_milestone"] == 3

    @pytest.mark.asyncio
    async def test_active_streak_returned_correctly(self, mock_db):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        mock_db.streaks.find_one = AsyncMock(return_value={
            "user_id": "user-abc",
            "current_streak": 7,
            "longest_streak": 7,
            "last_activity_date": today,
            "multiplier": get_multiplier(7),
            "milestones_claimed": [3],
        })

        result = await get_streak("user-abc")

        assert result["current_streak"] == 7
        assert result["next_milestone"] == 14  # 7-day milestone already claimed, next is 14

    @pytest.mark.asyncio
    async def test_expired_streak_shows_zero(self, mock_db):
        # Last activity 5 days ago → streak expired
        old_date = (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d")
        mock_db.streaks.find_one = AsyncMock(return_value={
            "user_id": "user-abc",
            "current_streak": 15,
            "longest_streak": 15,
            "last_activity_date": old_date,
            "multiplier": 2.0,
            "milestones_claimed": [3, 7, 14],
        })

        result = await get_streak("user-abc")

        assert result["current_streak"] == 0
        assert result["multiplier"] == 1.0

    @pytest.mark.asyncio
    async def test_next_milestone_after_all_claimed(self, mock_db):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        mock_db.streaks.find_one = AsyncMock(return_value={
            "user_id": "user-legend",
            "current_streak": 30,
            "longest_streak": 30,
            "last_activity_date": today,
            "multiplier": 2.0,
            "milestones_claimed": [3, 7, 14, 30],
        })

        result = await get_streak("user-legend")

        # All milestones claimed — no next milestone
        assert result["next_milestone"] is None
        assert result["next_milestone_clout"] is None
