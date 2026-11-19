"""Readiness (docs/progression-rules.md §6). A planning aid, not medical advice."""

from typing import Literal

SLEEP_TARGET_H = 7.5

Level = Literal["High", "Moderate", "Low"]


def sleep_points(hours: float) -> int:
    return 2 if hours >= SLEEP_TARGET_H else 1 if hours >= SLEEP_TARGET_H - 1 else 0


def scale_points(rating: int) -> int:
    return 2 if rating >= 4 else 1 if rating == 3 else 0


def readiness(sleep_hours: float | None, energy: int | None, recovery: int | None) -> tuple[Level, int] | None:
    """Needs all three inputs; otherwise None."""
    if sleep_hours is None or energy is None or recovery is None:
        return None
    points = sleep_points(float(sleep_hours)) + scale_points(energy) + scale_points(recovery)
    level: Level = "High" if points >= 5 else "Moderate" if points >= 3 else "Low"
    return level, points
