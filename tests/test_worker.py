import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import worker

FIXTURES = Path(__file__).resolve().parent / "fixtures"
ROOT = FIXTURES / "wildcards"


def test_seed_determinism():
    req = {"command": "expand", "root": str(ROOT), "prompt": "{__colors__}", "seed": 999, "count": 3}
    assert worker.handle(req)["results"] == worker.handle(req)["results"]


def test_index_name_resolution():
    cols = worker.handle({"command": "index", "root": str(ROOT)})["collections"]
    assert {c["name"] for c in cols} >= {"colors", "primary", "cycle_a", "cycle_b"}
    primary = next(c for c in cols if c["name"] == "primary")
    assert (primary["count"], primary["kind"]) == (2, "txt")
    colors = next(c for c in cols if c["name"] == "colors")
    assert colors["path"] == "colors.txt"


def test_refs_edge():
    edges = worker.handle({"command": "refs", "root": str(ROOT)})["edges"]
    assert "primary" in edges["colors"]


def test_cycle_detection():
    cycle = worker.handle({"command": "refs", "root": str(ROOT)})["cycle"]
    assert cycle and set(cycle) == {"cycle_a", "cycle_b"}


def test_list_loras(tmp_path):
    for name in ("b.safetensors", "a.safetensors", "notes.txt"):
        (tmp_path / name).write_text("")
    assert worker.handle({"command": "list_loras", "root": str(tmp_path)})["loras"] == ["a.safetensors", "b.safetensors"]


def test_read_cp932_roundtrip(tmp_path):
    r = worker.handle({"command": "read", "root": str(FIXTURES), "file": "cp932.prompt"})
    assert r["encoding"] == "cp932"
    out = tmp_path / "cp932.prompt"
    worker.handle({"command": "write", "path": str(out), "encoding": r["encoding"], "text": r["text"]})
    assert out.read_bytes() == (FIXTURES / "cp932.prompt").read_bytes()
