#!/usr/bin/env python3
"""CHX 350 operator UI - DSF SBC backend.

Registers HTTP endpoints under ``/machine/CHX350/`` that the built-in DWC plugin
uses for things the browser cannot get from the object model:

- ``GET status``                   health probe
- ``GET fileinfo?name=<sd path>``  slicer settings from the tail of a job file
- ``GET history?limit=<n>``        job history parsed from the firmware event log
- ``GET diagnostics``              daemon + event log tail

Targets DSF 3.7 / dsf-python 3.7 on Python >= 3.11. No third-party dependencies
besides dsf-python.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
import traceback
from typing import Callable, Dict, Optional, Tuple
from urllib.parse import unquote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from chx350_eventlog import EventLogHistory  # noqa: E402
from chx350_gcode import file_info  # noqa: E402

PLUGIN_ID = "CHX350"
API_NAMESPACE = "CHX350"
EVENT_LOG_VIRTUAL = "0:/sys/eventlog.log"


def _read_version() -> str:
    """Version from the installed manifest, which the package build sets to the DWC version.
    DSF (and the image seed) put it next to the plugin directory: <plugins>/CHX350.json beside
    <plugins>/CHX350/dsf/<this file>"""
    plugin_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    manifest = os.path.join(os.path.dirname(plugin_dir), f"{PLUGIN_ID}.json")
    try:
        with open(manifest, "r", encoding="utf-8-sig") as handle:
            return str(json.load(handle).get("version") or "unknown")
    except (OSError, ValueError):
        return "unknown"


VERSION = _read_version()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CHX350] %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("chx350")

# --- dsf-python: robust server greeting ---------------------------------------
# dsf-python reads the DSF greeting with a fixed socket.recv(50); DSF 3.7 sends a
# longer greeting, which truncates the JSON. Read until a complete object arrived.
try:
    import socket as _socket

    from dsf.connections.base_connection import BaseConnection as _BaseConnection
    from dsf.connections.exceptions import IncompatibleVersionException as _Incompatible
    from dsf.connections.init_messages.server_init_message import ServerInitMessage as _ServerInit

    def _json_end(buffer: str) -> int:
        depth = 0
        in_str = False
        escape = False
        for index, char in enumerate(buffer):
            if in_str:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == '"':
                    in_str = False
            elif char == '"':
                in_str = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return index + 1
        return -1

    def _read_json_object(recv, timeout: float) -> Tuple[str, str]:
        buffer = ""
        start = time.monotonic()
        while True:
            end = _json_end(buffer)
            if end > 0:
                return buffer[:end], buffer[end:]
            if timeout and time.monotonic() - start > timeout:
                raise TimeoutError("Timeout while waiting for the DSF greeting")
            chunk = recv(4096)
            if not chunk:
                raise ConnectionError("Connection closed before the DSF greeting arrived")
            buffer += chunk.decode("utf8") if isinstance(chunk, (bytes, bytearray)) else chunk

    def _patched_connect(self, init_message, socket_file):
        self.socket = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
        self.socket.connect(socket_file)
        self.socket.settimeout(self.timeout if self.timeout > 0 else None)
        json_string, leftover = _read_json_object(self.socket.recv, self.timeout)
        self.input = leftover
        server_init = _ServerInit.from_json(json.loads(json_string))
        if not server_init.is_compatible():
            raise _Incompatible(
                f"Incompatible API version (need {server_init.PROTOCOL_VERSION}, got {server_init.version})"
            )
        self.id = server_init.id
        self.send(init_message)
        response = self.receive_response()
        if not getattr(response, "success", True):
            raise Exception(
                f"Could not set connection type {init_message.mode} "
                f"({response.error_type}: {response.error_message})"
            )

    for _name in ("connect", "_connect"):
        if hasattr(_BaseConnection, _name):
            setattr(_BaseConnection, _name, _patched_connect)
except Exception:  # noqa: BLE001 - never fatal; the stock connect may just work
    pass

from dsf.connections import CommandConnection  # noqa: E402
from dsf.http import HttpResponseType  # noqa: E402
from dsf.object_model import HttpEndpointType  # noqa: E402

_started = time.monotonic()
_history = EventLogHistory()
_shutdown = False


# --- DSF helpers ----------------------------------------------------------------

def resolve_path(cmd: CommandConnection, virtual: str) -> str:
    """``0:/gcodes/x.gcode`` -> real filesystem path via DSF."""
    response = cmd.resolve_path(virtual)
    real = getattr(response, "result", response)
    return real if isinstance(real, str) else str(real)


def _query(queries: dict, key: str, default: Optional[str] = None) -> Optional[str]:
    value = queries.get(key, default)
    if isinstance(value, list):
        value = value[0] if value else default
    return unquote(value) if isinstance(value, str) else default


# --- Handlers -------------------------------------------------------------------
# Each handler returns (status, body_dict)

def handle_status(_cmd: CommandConnection, _queries: dict) -> Tuple[int, dict]:
    return 200, {"version": VERSION, "uptime": round(time.monotonic() - _started, 1)}


def handle_fileinfo(cmd: CommandConnection, queries: dict) -> Tuple[int, dict]:
    name = _query(queries, "name")
    if not name or ".." in name:
        return 400, {"error": "missing or invalid 'name' parameter"}
    try:
        real = resolve_path(cmd, name)
    except Exception as exc:  # noqa: BLE001
        return 400, {"error": f"cannot resolve path: {exc}"}
    if not os.path.isfile(real):
        return 404, {"error": "file not found"}
    try:
        return 200, file_info(real, name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("fileinfo failed for %s: %s", name, exc)
        return 500, {"error": str(exc)}


def handle_history(cmd: CommandConnection, queries: dict) -> Tuple[int, dict]:
    try:
        limit = int(_query(queries, "limit", "100") or "100")
    except ValueError:
        limit = 100
    try:
        real = resolve_path(cmd, EVENT_LOG_VIRTUAL)
    except Exception as exc:  # noqa: BLE001
        return 500, {"error": f"cannot resolve event log: {exc}"}
    return 200, {"entries": _history.entries(real, limit), "source": "eventlog"}


def handle_diagnostics(cmd: CommandConnection, _queries: dict) -> Tuple[int, dict]:
    tail = []
    try:
        real = resolve_path(cmd, EVENT_LOG_VIRTUAL)
        with open(real, "r", encoding="utf-8", errors="replace") as handle:
            tail = handle.readlines()[-200:]
    except Exception as exc:  # noqa: BLE001
        tail = [f"(event log not available: {exc})"]
    return 200, {
        "version": VERSION,
        "python": sys.version.split()[0],
        "uptime": round(time.monotonic() - _started, 1),
        "eventlogTail": [line.rstrip("\n") for line in tail],
    }


ENDPOINTS: Dict[str, Callable[[CommandConnection, dict], Tuple[int, dict]]] = {
    "status": handle_status,
    "fileinfo": handle_fileinfo,
    "history": handle_history,
    "diagnostics": handle_diagnostics,
}


def _make_handler(cmd: CommandConnection, func):
    async def _handler(http_conn):
        request = await http_conn.read_request()
        try:
            queries = getattr(request, "queries", {}) or {}
            status, body = func(cmd, queries)
            await http_conn.send_response(status, json.dumps(body), HttpResponseType.JSON)
        except Exception:  # noqa: BLE001
            logger.error("handler error: %s", traceback.format_exc())
            await http_conn.send_response(500, json.dumps({"error": "internal error"}), HttpResponseType.JSON)

    return _handler


def register_endpoints(cmd: CommandConnection):
    registered = []
    for path, func in ENDPOINTS.items():
        try:
            endpoint = cmd.add_http_endpoint(HttpEndpointType.GET, API_NAMESPACE, path)
            endpoint.set_endpoint_handler(_make_handler(cmd, func))
            registered.append(endpoint)
            logger.info("registered GET /machine/%s/%s", API_NAMESPACE, path)
        except Exception as exc:  # noqa: BLE001
            logger.error("failed to register %s: %s", path, exc)
    return registered


def _signal_handler(_signum, _frame):
    global _shutdown
    _shutdown = True


def main() -> None:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    cmd = CommandConnection()
    last_error = None
    for attempt in range(1, 11):
        try:
            cmd.connect()
            last_error = None
            break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("DSF connection attempt %d/10 failed: %s", attempt, exc)
            time.sleep(2)
    if last_error is not None:
        logger.error("giving up: %s", last_error)
        sys.exit(1)

    endpoints = register_endpoints(cmd)
    logger.info("ready - version %s, %d endpoints", VERSION, len(endpoints))

    try:
        while not _shutdown:
            time.sleep(1)
    finally:
        for endpoint in endpoints:
            try:
                endpoint.close()
            except Exception:  # noqa: BLE001
                pass
        try:
            cmd.close()
        except Exception:  # noqa: BLE001
            pass
        logger.info("stopped")


if __name__ == "__main__":
    main()
