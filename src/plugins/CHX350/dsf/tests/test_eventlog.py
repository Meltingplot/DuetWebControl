import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chx350_eventlog import EventLogHistory, parse_lines, parse_print_time  # noqa: E402

LOG = """2026-09-14 15:30:56 Finished printing file 0:/gcodes/3DBenchy_L0.36mm_N0.8_PLA_Meltingplot CHX 350_1h15m.gcode, print time was 1h 36m
2026-09-20 10:36:52 Resume state saved
2026-09-20 11:39:43 Cancelled printing file 0:/gcodes/PO-2109847-333747_L0.18mm_N0.4_PLA_Meltingplot CHX 350_5h38m.gcode, print time was 0h 50m
Warning: something else
2026-09-20 23:00:02 Finished printing file 0:/gcodes/part.gcode, print time was 10h 24m
"""


def test_parse_print_time():
    assert parse_print_time("1h 36m") == 5760
    assert parse_print_time("0h 50m") == 3000
    assert parse_print_time("12m 5s") == 725
    assert parse_print_time("") is None
    assert parse_print_time("garbage") is None


def test_parse_lines():
    entries = parse_lines(LOG.splitlines())
    assert len(entries) == 3
    assert entries[0]["result"] == "finished"
    assert entries[0]["file"].endswith("1h15m.gcode")
    assert entries[0]["printTimeS"] == 5760
    assert entries[0]["timestamp"] == "2026-09-14T15:30:56"
    assert entries[1]["result"] == "cancelled"
    assert entries[2]["printTimeS"] == 10 * 3600 + 24 * 60


def test_history_newest_first_and_limit():
    with tempfile.NamedTemporaryFile("w", suffix=".log", delete=False) as handle:
        handle.write(LOG)
        path = handle.name
    try:
        history = EventLogHistory()
        entries = history.entries(path, limit=2)
        assert [e["file"] for e in entries] == ["0:/gcodes/part.gcode", "0:/gcodes/PO-2109847-333747_L0.18mm_N0.4_PLA_Meltingplot CHX 350_5h38m.gcode"]
        assert history.entries("/nonexistent/eventlog.log") == []
    finally:
        os.unlink(path)
