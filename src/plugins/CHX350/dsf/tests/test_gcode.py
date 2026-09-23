import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chx350_gcode import file_info, parse_config_block, read_tail  # noqa: E402

ORCA_TAIL = """G1 X10 Y10
; filament used [mm] = 12526.19
; total filament used [g] = 103.88
; estimated printing time (normal mode) = 1h 14m 55s
; CONFIG_BLOCK_START
; curr_bed_type = High Temp Plate
; filament_diameter = 2.85
; filament_settings_id = "Extrudr PLA NX2 Matt @0.8 nozzle"
; filament_type = PLA
; layer_height = 0.36
; nozzle_diameter = 0.8
; print_sequence = by layer
; printer_model = Meltingplot CHX 350
; printer_settings_id = Meltingplot CHX 350 0.8 nozzle - #1
; required_nozzle_HRC = 3
; some_other_setting = 42
; CONFIG_BLOCK_END
"""


def test_config_block_parsed():
    config, source = parse_config_block(ORCA_TAIL)
    assert source == "config_block"
    assert config["filament_settings_id"] == "Extrudr PLA NX2 Matt @0.8 nozzle"
    assert config["filament_type"] == "PLA"
    assert config["nozzle_diameter"] == "0.8"
    assert config["printer_model"] == "Meltingplot CHX 350"
    assert config["curr_bed_type"] == "High Temp Plate"
    assert config["filament_diameter"] == "2.85"
    assert config["required_nozzle_HRC"] == "3"
    assert "some_other_setting" not in config


def test_plain_tail_fallback():
    config, source = parse_config_block("; layer_height = 0.2\n; printer_model = X\n")
    assert source == "tail"
    assert config == {"layer_height": "0.2", "printer_model": "X"}


def test_no_config():
    assert parse_config_block("G1 X1\nG1 X2\n") == ({}, "none")


def test_file_info_reads_tail_and_caches():
    with tempfile.NamedTemporaryFile("w", suffix=".gcode", delete=False) as handle:
        handle.write("; header\n" + ("G1 X1 Y1\n" * 50000) + ORCA_TAIL)
        path = handle.name
    try:
        assert "CONFIG_BLOCK_END" in read_tail(path)
        info = file_info(path, "0:/gcodes/test.gcode")
        assert info["config"]["nozzle_diameter"] == "0.8"
        assert info["source"] == "config_block"
        assert file_info(path, "0:/gcodes/test.gcode") is info  # cached
    finally:
        os.unlink(path)
