"""In-process sliding-window limiter for login (security doc §2).

One API instance is enough for a single owner. If the API is scaled out, move this to Postgres or Redis.
"""

import time
from collections import defaultdict, deque


class SlidingWindow:
    def __init__(self, max_events: int, window_s: int) -> None:
        self.max, self.window = max_events, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def retry_after(self, key: str) -> int:
        """Seconds to wait, or 0 if allowed now."""
        q = self._hits[key]
        now = time.monotonic()
        while q and now - q[0] > self.window:
            q.popleft()
        return 0 if len(q) < self.max else int(self.window - (now - q[0])) + 1

    def hit(self, key: str) -> None:
        self._hits[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)
