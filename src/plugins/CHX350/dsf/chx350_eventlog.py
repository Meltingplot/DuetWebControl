"""Job history from RepRapFirmware's event log (``0:/sys/eventlog.log``).

The firmware logs one line when a job ends::

    2026-09-14 15:30:56 Finished printing file 0:/gcodes/part.gcode, print time was 1h 36m
    2026-09-20 11:39:43 Cancelled printing file 0:/gcodes/part.gcode, print time was 0h 50m

Phase 1 of the CHX 350 operator UI builds its history from these lines; the
quality-assurance plugin will provide richer records later.

Pure functions, no DSF dependency - covered by tests/test_eventlog.py.
"""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Iterable, List, Optional

_LINE_RE = re.compile(
    r"^(?:(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+)?"
    r"(?P<kind>Finished|Cancelled) printing file (?P<file>.+?)"
    r"(?:, print time was (?P<time>[\dhms ]+))?\s*$"
)
_TIME_RE = re.compile(r"(?:(?P<h>\d+)h)?\s*(?:(?P<m>\d+)m)?\s*(?:(?P<s>\d+)s)?")


def parse_print_time(value: Optional[str]) -> Optional[int]:
    """``"1h 36m"`` -> seconds; ``None`` when nothing usable is present."""
    if not value:
        return None
    match = _TIME_RE.fullmatch(value.strip())
    if not match or not any(match.groupdict().values()):
        return None
    hours = int(match.group("h") or 0)
    minutes = int(match.group("m") or 0)
    seconds = int(match.group("s") or 0)
    return hours * 3600 + minutes * 60 + seconds


def parse_lines(lines: Iterable[str]) -> List[dict]:
    """Parse log lines into history entries, oldest first."""
    entries: List[dict] = []
    for raw in lines:
        match = _LINE_RE.match(raw.strip())
        if not match:
            continue
        timestamp = None
        if match.group("ts"):
            try:
                timestamp = datetime.strptime(match.group("ts"), "%Y-%m-%d %H:%M:%S").isoformat()
            except ValueError:
                timestamp = None
        entries.append(
            {
                "file": match.group("file"),
                "result": "finished" if match.group("kind") == "Finished" else "cancelled",
                "printTimeS": parse_print_time(match.group("time")),
                "timestamp": timestamp,
            }
        )
    return entries


class EventLogHistory:
    """Parses the event log once per (size, mtime) and serves the newest entries."""

    def __init__(self) -> None:
        self._key = None
        self._entries: List[dict] = []

    def entries(self, path: str, limit: int = 100) -> List[dict]:
        try:
            stat = os.stat(path)
        except FileNotFoundError:
            return []
        key = (stat.st_size, stat.st_mtime_ns)
        if key != self._key:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                self._entries = parse_lines(handle)
            self._key = key
        newest_first = list(reversed(self._entries))
        return newest_first[: max(1, limit)]
