"""Slicer metadata from the tail of a G-code file.

OrcaSlicer/BambuStudio write their complete configuration between
``; CONFIG_BLOCK_START`` and ``; CONFIG_BLOCK_END`` at the very end of the file;
PrusaSlicer/SuperSlicer append ``; key = value`` lines without markers. DSF only
parses ``;customInfo`` comments in the header, so the CHX 350 backend reads the
last few hundred kilobytes and extracts the keys the operator UI checks against
the machine (filament, nozzle, printer profile, bed type).

Pure functions, no DSF dependency - covered by tests/test_gcode.py.
"""

from __future__ import annotations

import os
import re
from collections import OrderedDict
from typing import Dict, Optional, Tuple

TAIL_BYTES = 256 * 1024
CACHE_SIZE = 256

# Keys handed to the frontend. Everything else in the config block is ignored to keep
# the response small (the block holds several hundred settings).
WANTED_KEYS = (
    "filament_settings_id",
    "filament_type",
    "filament_vendor",
    "nozzle_diameter",
    "printer_model",
    "printer_settings_id",
    "print_settings_id",
    "curr_bed_type",
    "print_sequence",
    "layer_height",
    "first_layer_height",
    "filament_density",
    "filament_diameter",
    "filament_colour",
    "required_nozzle_HRC",
    "total filament used [g]",
    "estimated printing time (normal mode)",
)

_LINE_RE = re.compile(r"^;\s*(?P<key>[^=]+?)\s*=\s*(?P<value>.*?)\s*$")


def read_tail(path: str, size: int = TAIL_BYTES) -> str:
    """Return the last ``size`` bytes of ``path`` decoded as UTF-8 (errors replaced)."""
    with open(path, "rb") as handle:
        handle.seek(0, os.SEEK_END)
        length = handle.tell()
        handle.seek(max(0, length - size))
        data = handle.read()
    return data.decode("utf-8", errors="replace")


def _clean(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
        value = value[1:-1]
    return value


def parse_config_block(text: str) -> Tuple[Dict[str, str], str]:
    """Extract ``key = value`` comment lines from a file tail.

    Returns ``(config, source)`` where ``source`` is ``"config_block"`` when the
    OrcaSlicer markers were found, ``"tail"`` when plain ``; key = value`` lines
    were used, or ``"none"``.
    """
    start = text.rfind("; CONFIG_BLOCK_START")
    end = text.rfind("; CONFIG_BLOCK_END")
    if start >= 0 and end > start:
        block = text[start:end]
        source = "config_block"
    else:
        block = text
        source = "tail"

    config: Dict[str, str] = {}
    for line in block.splitlines():
        match = _LINE_RE.match(line)
        if not match:
            continue
        key = match.group("key").strip()
        if key in WANTED_KEYS:
            config[key] = _clean(match.group("value"))

    if not config:
        return {}, "none"
    return config, source


class FileInfoCache:
    """Small LRU keyed by (path, size, mtime_ns)."""

    def __init__(self, capacity: int = CACHE_SIZE) -> None:
        self._capacity = capacity
        self._items: "OrderedDict[Tuple[str, int, int], dict]" = OrderedDict()

    def get(self, key: Tuple[str, int, int]) -> Optional[dict]:
        item = self._items.get(key)
        if item is not None:
            self._items.move_to_end(key)
        return item

    def put(self, key: Tuple[str, int, int], value: dict) -> None:
        self._items[key] = value
        self._items.move_to_end(key)
        while len(self._items) > self._capacity:
            self._items.popitem(last=False)


_cache = FileInfoCache()


def file_info(real_path: str, display_name: str) -> dict:
    """Metadata record for ``real_path`` as the HTTP endpoint returns it."""
    stat = os.stat(real_path)
    key = (real_path, stat.st_size, stat.st_mtime_ns)
    cached = _cache.get(key)
    if cached is not None:
        return cached

    config, source = parse_config_block(read_tail(real_path))
    record = {
        "name": display_name,
        "size": stat.st_size,
        "mtime": _iso(stat.st_mtime),
        "source": source,
        "config": config,
    }
    _cache.put(key, record)
    return record


def _iso(timestamp: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
