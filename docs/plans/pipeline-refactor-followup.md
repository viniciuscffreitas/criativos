# Pipeline Refactor — Follow-up (Tier 1 + Tier 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Close bugs and migration gaps identified in the post-refactor review gate.

**Architecture:** No structural changes. Six atomic commits fixing verified bugs,
strengthening the tokens-truth test so it matches the README's claim, and finishing
the CSS hex → `var(--*)` sweep.

**Tech Stack:** Same — Python, Playwright, pytest, Pillow.

---

## Commit A — Tier 1 quick fixes (items 1, 3, 4, 5)

**Files:**
- Modify: `brand/guidelines.html` (fix broken stylesheet link)
- Modify: `tests/test_generate.py` (remove Task 7 refs + fix vacuous test)
- Modify: `scripts/generate.py` (drop dead `to_file_url` import)

- [ ] **Step 1:** `guidelines.html:9` — `href="brand-guidelines.css"` → `href="guidelines.css"`.
- [ ] **Step 2:** `test_generate.py` — strip "Task 7" from comment, docstring, assert message.
- [ ] **Step 3:** `test_white_svg_has_no_background_rect` — replace OR with `<rect` absence + fill check.
- [ ] **Step 4:** `generate.py` — remove `to_file_url` from the `from scripts.pipeline import ...` line (unused).
- [ ] **Step 5:** `pytest -q` → all green.
- [ ] **Step 6:** commit `fix: guidelines.html link, dead imports, vacuous test, task-ref cleanup`.

## Commit B — Wheel packaging (item 2)

**Files:**
- Modify: `pyproject.toml` (add `ads*` to `include`)
- Create: `scripts/__init__.py`, `ads/__init__.py` (both empty)
- Modify: `tests/test_packaging.py` (assert ads is included)

- [ ] **Step 1:** Add `tomllib` check that `ads*` appears in `include` list.
- [ ] **Step 2:** Expect RED (current toml only has `scripts*`).
- [ ] **Step 3:** Edit `pyproject.toml` + create both `__init__.py`.
- [ ] **Step 4:** Expect GREEN.
- [ ] **Step 5:** Smoke test real wheel install in isolated venv — `vibeweb-build --help` and `python -c "from ads.render import main"` must succeed.
- [ ] **Step 6:** commit.

## Commit C — Strengthen tokens-truth test (item 6)

**Files:**
- Modify: `tests/test_tokens_truth.py`

- [ ] **Step 1:** Add `test_template_has_no_tokenized_hex_in_css` — parses template, extracts CSS rules only, flags any `#04d361|#ffffff|#a3a3a3|#999|#888|#2a2a2a|#0a0a0a` in `color:`, `background:`, `background-color:`, `border[-...]:`. Excludes SVG `fill="..."` presentation attrs and HTML comments.
- [ ] **Step 2:** Add `test_template_has_no_brand_green_rgba` — flags `rgba(4,\s*211,\s*97,\s*X)` literals.
- [ ] **Step 3:** Run — expect failures on templates that still use hex/rgba.
- [ ] **Step 4:** commit `test: strengthen tokens-truth to reject tokenized hex + brand rgba`.

## Commit D — Migration sweep (items 7, 8)

**Files:**
- Modify: `brand/tokens.css` (add missing opacity tokens: `--accent-05`, `--accent-40`, `--accent-50`, etc. as needed)
- Modify: all 11 templates with remaining hex/rgba
- Modify: `scripts/generate.py` (extract `_BG` constant)

- [ ] **Step 1:** Audit: which rgba opacities exist in templates? Add matching tokens.
- [ ] **Step 2:** Python migration script replaces `#04d361` in CSS rules → `var(--accent)`, keeps SVG fill attrs.
- [ ] **Step 3:** Python migration script replaces `rgba(4, 211, 97, X)` → `var(--accent-XX)` using the nearest opacity token.
- [ ] **Step 4:** `generate.py` — extract `_BG = "#0a0a0a"` or equivalent; use in the 3 wrapper f-strings.
- [ ] **Step 5:** Run `test_tokens_truth.py` — all strengthened tests pass.
- [ ] **Step 6:** Re-render (`python scripts/build.py --all`) + visual regression → confirm no drift beyond threshold.
- [ ] **Step 7:** commit `refactor(templates): finish tokens-as-truth migration for #04d361 + rgba variants`.

## Commit E — Fix contrast ratio docs (item 9)

**Files:**
- Modify: `brand/guidelines.css` (remove numeric ratios, keep AA/AAA tiers)
- Modify: `brand/tokens.css` (same)

- [ ] **Step 1:** Strip fabricated/contradictory decimal ratios from comments. Leave only the qualitative tier (`✓ AA`, `✓ AAA`, `decorative only`).
- [ ] **Step 2:** commit `docs(brand): remove unreliable contrast decimals, keep AA/AAA tiers`.

## Commit F — Unify guidelines vocabulary (item 10)

**Files:**
- Modify: `brand/guidelines.css` (drop local `:root { --brand, --bg, ... }`; `@import url('tokens.css')`; rename `--brand` → `--accent`)

- [ ] **Step 1:** Replace local var declarations with `@import url('tokens.css')` at file top.
- [ ] **Step 2:** Global rename `--brand` → `--accent` in `guidelines.css` and `guidelines.html` inline styles.
- [ ] **Step 3:** Open guidelines.html in browser (manual visual check — after Commit A it loads CSS, so this matters).
- [ ] **Step 4:** commit `refactor(brand): guidelines.css imports tokens.css, drops duplicate vocabulary`.

## Final verification

- [ ] `pytest -q` — all green
- [ ] `python scripts/build.py --all` — 21 PNGs
- [ ] `pip install .` in isolated venv → `vibeweb-build --all` works
- [ ] Visual regression still within 1% threshold
