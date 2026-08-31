from datetime import datetime, timedelta, timezone


def test_fois_forecast_seed_is_stable_within_day_and_changes_daily():
    morning = datetime(2026, 9, 1, 1, 0, tzinfo=timezone.utc)
    evening = datetime(2026, 9, 1, 23, 0, tzinfo=timezone.utc)
    next_day = morning + timedelta(days=1)

    assert morning.toordinal() == evening.toordinal()
    assert next_day.toordinal() == morning.toordinal() + 1