"""Background jobs to keep automation surfaced without manual polling."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import timedelta
from typing import Optional

from ..services.automation import AutomationEngine
from ..services.data import InMemoryStore, store


class AutomationDigestScheduler:
    """Periodically capture automation digests and broadcast summaries."""

    def __init__(self, data_store: InMemoryStore, *, interval: timedelta = timedelta(hours=24)) -> None:
        self._store = data_store
        self._interval = interval
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._task is not None:
            return
        self._running = True
        self._task = asyncio.create_task(self._runner())

    async def stop(self) -> None:
        if self._task is None:
            return
        self._running = False
        self._task.cancel()
        with suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def _runner(self) -> None:
        while self._running:
            engine = AutomationEngine(self._store)
            digest = engine.generate_digest()
            self._store.archive_automation_digest(digest)
            self._store.record_automation_broadcast(digest)
            await asyncio.sleep(self._interval.total_seconds())


automation_scheduler = AutomationDigestScheduler(store)
