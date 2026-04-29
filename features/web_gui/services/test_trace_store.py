"""Tests for trace_store persistence layer."""
import json
from pathlib import Path

import pytest

from features.web_gui.services import trace_store


def test_save_writes_pretty_json(tmp_path, monkeypatch):
    monkeypatch.setattr("features.web_gui.services.trace_store.traces_dir",
                        lambda: tmp_path)
    p = trace_store.save("abc123", {"run_id": "abc123", "acentuação": "é"})
    assert p == tmp_path / "abc123.json"
    content = p.read_text(encoding="utf-8")
    assert "\n" in content  # indented
    assert "acentuação" in content  # ensure_ascii=False


def test_load_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr("features.web_gui.services.trace_store.traces_dir",
                        lambda: tmp_path)
    trace_store.save("xyz", {"a": 1, "b": [2, 3]})
    assert trace_store.load("xyz") == {"a": 1, "b": [2, 3]}


def test_save_atomic_via_tmp_rename(tmp_path, monkeypatch):
    # tmp file should not linger after successful save
    monkeypatch.setattr("features.web_gui.services.trace_store.traces_dir",
                        lambda: tmp_path)
    trace_store.save("atomic", {"ok": True})
    assert (tmp_path / "atomic.json").exists()
    assert not (tmp_path / "atomic.json.tmp").exists()


def test_save_raises_when_traces_dir_missing(tmp_path, monkeypatch):
    missing = tmp_path / "does_not_exist"
    monkeypatch.setattr("features.web_gui.services.trace_store.traces_dir",
                        lambda: missing)
    with pytest.raises(RuntimeError, match="traces dir not found"):
        trace_store.save("x", {})
