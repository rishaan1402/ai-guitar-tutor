"""Streaks with rest days: every 7 days in a row earns one; a rest day covers one missed day."""
from datetime import date, timedelta

from progress.router import streak_with_rest

T = date(2026, 11, 23)


def run(n, end=T):
    return [end - timedelta(days=i) for i in range(n)]


def test_plain_streak():
    assert streak_with_rest(run(3), T) == (3, 0)
    assert streak_with_rest([], T) == (0, 0)


def test_not_broken_until_a_whole_day_is_missed():
    assert streak_with_rest(run(3, T - timedelta(days=1)), T) == (3, 0)
    assert streak_with_rest(run(3, T - timedelta(days=2)), T) == (0, 0)


def test_seven_days_earn_a_rest_day_that_covers_a_gap():
    days = run(7, T - timedelta(days=3)) + [T - timedelta(days=1), T]  # missed T-2
    assert streak_with_rest(days, T) == (9, 0)


def test_rest_day_covers_yesterday():
    assert streak_with_rest(run(7, T - timedelta(days=2)), T) == (7, 0)


def test_rest_days_bank_up_to_two_and_two_missed_days_still_break():
    days = run(21, T - timedelta(days=3))
    assert streak_with_rest(days + [T], T)[0] == 1  # missed 2 days: broken, today starts again
    assert streak_with_rest(run(21), T) == (21, 2)
