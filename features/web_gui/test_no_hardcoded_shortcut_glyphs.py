"""
Guard test: every keyboard-shortcut hint rendered by the SPA must go through
`features/web_gui/ui/src/platform.ts::formatShortcut`. No component is allowed
to write a literal "⌘X" or "Ctrl+X" inside JSX, because doing so silently
regresses Windows users (or Mac users, depending on which form was hardcoded).

Precedent: tests/test_generate.py::test_no_orphan_logo_pngs — same shape of
"every output has a producer" guard endorsed by CLAUDE.md §2.9.

Scope: only `src/components/` source files. The helper itself, its colocated
test, and component test files are allowed to use literals (they're asserting
the rendered output).
"""
from __future__ import annotations
import re
from pathlib import Path

UI_SRC = Path(__file__).parent / "ui" / "src"
COMPONENTS_DIR = UI_SRC / "components"

# These patterns flag a likely hardcoded shortcut hint in JSX/TSX.
# We only scan production component sources — tests legitimately assert on
# the rendered glyphs.
MAC_GLYPH = re.compile(r"⌘")
WIN_PREFIX = re.compile(r"\bCtrl\+")


def _component_sources() -> list[Path]:
    """Every .tsx under src/components/, excluding *.test.tsx."""
    files = []
    for p in COMPONENTS_DIR.rglob("*.tsx"):
        if p.name.endswith(".test.tsx"):
            continue
        files.append(p)
    return files


def test_no_hardcoded_command_glyph_in_components():
    """No production component may contain a literal "⌘" character."""
    offenders = []
    for path in _component_sources():
        text = path.read_text(encoding="utf-8")
        if MAC_GLYPH.search(text):
            # Allow only inside a // comment line — comments don't render.
            for lineno, line in enumerate(text.splitlines(), start=1):
                if "⌘" in line and not line.lstrip().startswith("//"):
                    offenders.append(f"{path.relative_to(UI_SRC.parent)}:{lineno}: {line.strip()}")
    assert not offenders, (
        "Hardcoded ⌘ glyph in component(s). Use formatShortcut() from "
        "src/platform.ts so Windows/Linux users see Ctrl+X.\n  "
        + "\n  ".join(offenders)
    )


def test_no_hardcoded_ctrl_prefix_in_components():
    """No production component may contain a literal "Ctrl+" string."""
    offenders = []
    for path in _component_sources():
        text = path.read_text(encoding="utf-8")
        if WIN_PREFIX.search(text):
            for lineno, line in enumerate(text.splitlines(), start=1):
                if WIN_PREFIX.search(line) and not line.lstrip().startswith("//"):
                    offenders.append(f"{path.relative_to(UI_SRC.parent)}:{lineno}: {line.strip()}")
    assert not offenders, (
        "Hardcoded \"Ctrl+\" prefix in component(s). Use formatShortcut() from "
        "src/platform.ts so Mac users see ⌘X.\n  "
        + "\n  ".join(offenders)
    )
