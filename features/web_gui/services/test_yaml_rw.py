"""
Tests for yaml_rw atomic read/write helpers.
Covers: empty-file returns {}, non-dict raises ValueError,
        write round-trip, rename failure wraps as RuntimeError.
"""
from pathlib import Path
from unittest.mock import patch

import pytest

from features.web_gui.services import yaml_rw


def test_read_empty_file_returns_empty_dict(tmp_path: Path):
    f = tmp_path / "empty.yaml"
    f.write_text("")
    assert yaml_rw.read(f) == {}


def test_read_valid_mapping(tmp_path: Path):
    f = tmp_path / "data.yaml"
    f.write_text("key: value\n")
    assert yaml_rw.read(f) == {"key": "value"}


def test_read_non_dict_raises_value_error(tmp_path: Path):
    f = tmp_path / "list.yaml"
    f.write_text("- item1\n- item2\n")
    with pytest.raises(ValueError, match="expected a YAML mapping"):
        yaml_rw.read(f)


def test_read_scalar_raises_value_error(tmp_path: Path):
    f = tmp_path / "scalar.yaml"
    f.write_text("just a string\n")
    with pytest.raises(ValueError, match="expected a YAML mapping"):
        yaml_rw.read(f)


def test_write_creates_file_with_correct_content(tmp_path: Path):
    f = tmp_path / "out.yaml"
    yaml_rw.write(f, {"hello": "world"})
    result = yaml_rw.read(f)
    assert result == {"hello": "world"}


def test_write_creates_bak_when_file_exists(tmp_path: Path):
    f = tmp_path / "out.yaml"
    yaml_rw.write(f, {"v": 1})
    yaml_rw.write(f, {"v": 2})
    bak = f.with_suffix(".yaml.bak")
    assert bak.exists()
    result = yaml_rw.read(f)
    assert result == {"v": 2}


def test_write_rename_failure_raises_runtime_error(tmp_path: Path):
    f = tmp_path / "out.yaml"
    yaml_rw.write(f, {"initial": True})

    with patch("pathlib.Path.replace", side_effect=[None, OSError("disk full")]):
        with pytest.raises(RuntimeError, match="atomic rename failed"):
            yaml_rw.write(f, {"updated": True})


def test_modify_non_dict_raises_value_error(tmp_path: Path):
    f = tmp_path / "list.yaml"
    f.write_text("- item1\n- item2\n")
    with pytest.raises(ValueError, match="expected a YAML mapping"):
        yaml_rw.modify(f, lambda d: d)


def test_modify_round_trip(tmp_path: Path):
    f = tmp_path / "data.yaml"
    f.write_text("count: 1\n")
    result = yaml_rw.modify(f, lambda d: {**d, "count": d["count"] + 1})
    assert result == {"count": 2}
    assert yaml_rw.read(f) == {"count": 2}
