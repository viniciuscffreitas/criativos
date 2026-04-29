# Big Sync — devflow + criativos integration

**Date:** 2026-04-29
**Status:** Approved (user delegated 100% autonomy)
**Scope:** Reconcile divergent state between local and remote across two repos
(`viniciuscffreitas/criativos` and `viniciuscffreitas/devflow`) without losing
work and without regressions.

---

## 1. Context

Two parallel branches of work happened on different machines:

**criativos repo (this project, branch main)**:
- Remote `origin/main`: ~80 commits ahead. Implemented Spec 1 (AI Creative
  Factory: copy_generation agent, PAS+NPQEL+AIDA+BAB methodologies, ads → Jinja2
  migration, ads.yaml extraction) plus Spec 3 in progress (FastAPI + Vite+React+TS
  web GUI, SSE streaming, prompt-cache, docker-compose deploy).
- Local: 30 commits ahead. Built Instagram Content Factory v1 (48 PNGs, full
  account launch).
- Common ancestor: `06764d1` (continuation prompt).
- **Divergent**: cannot fast-forward.

**devflow repo (`~/.claude/devflow/`, branch main)**:
- Remote `origin/main`: ~95 commits ahead. Implemented V3 SOTA hierarchy + E2R
  loop, Knowledge Base + FTS5 + Memoria, Mission Feed dashboard, Cloud Portal +
  IAM, Shadow Runner cloud dispatch, devflow-zelador VPS pipeline, init flow
  with stack detection, judge mode plumbing.
- Local: 0 ahead, in sync with old origin.
- Diff: +47k / -10k lines, 275 files. Major-ish upgrade.
- **Behind**: fast-forwardable (no local divergent work).

User intent: get the "content + creative factory" perfect and working without
regressions. All updates pulled.

---

## 2. Order of operations (rationale)

Two valid orderings; we picked **project merge first, devflow update after**.

### Why project first

1. **Stable tooling during the merge**: the devflow we know is the devflow we
   trust. Updating mid-session changes hook behavior (TDD enforcer, judge,
   file_checker, secrets_gate) under our feet.
2. **Idempotent rollback**: if project merge breaks, we can use
   `backup/local-instagram-pre-merge` to restore. The devflow update is
   independent — it doesn't compound the rollback.
3. **Low impact on devflow**: the project merge doesn't touch devflow internals.
4. **Critical-path delivery**: the user wants the IG launch + AI factory
   working. That's the project repo. Devflow is infrastructure — important but
   not blocking.

### Why devflow second (and isolated)

1. **Stable known-good state on remote**: once project is pushed to origin, even
   a catastrophic devflow break still leaves the project work safe.
2. **Hook regressions are easier to diagnose with green pytest already on disk**:
   we know the project itself is correct, so any new failure is a devflow
   regression, not a project regression.
3. **Allows separate verification**: pytest in this repo + devflow self-tests
   each prove their side is healthy.

---

## 3. Goals and non-goals

### Goals

- All 80+ remote criativos commits integrated into local main without losing
  any of our 30 local commits (especially: 48 IG PNGs + their goldens + the
  Instagram Content Factory).
- All 95+ remote devflow commits applied to `~/.claude/devflow/` without
  breaking the hooks/skills the criativos session depends on.
- pytest -q stays green at every checkpoint.
- Visual regression goldens stay matching.
- Backup branches exist for instant rollback at every stage.
- Origin pushed, working tree clean at the end.

### Non-goals (deferred)

- Refactoring `instagram_content/` to consume the new `copy_generation` agent.
  That's a follow-up spec (the agent now exists on remote — we'll spec the
  integration separately once the merge is stable).
- Migrating Instagram templates to Jinja2 like ads. Same reasoning.
- Web GUI integration with IG content. Future.
- Reels (Spec D) or conversion funnel (Spec E).
- Resolving philosophical conflicts between our IG approach (Playwright + HTML)
  and remote's evolved patterns (Jinja2 + ads.yaml). v1: keep IG as-is, evolve
  later.

---

## 4. Risk model

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Conflict in `scripts/build.py` (both added flags) | Certain | Medium | Manual merge: keep both `--instagram` and any new flags; preserve mutex group |
| Conflict in `brand/tokens.css` (both added tokens) | Likely | Low | Manual merge: append both token additions |
| Conflict in `tests/test_tokens_truth.py` (both extended globs) | Certain | Medium | Manual merge: combine both glob extensions; preserve `_stylesheet_text_for` helper |
| Remote refactored `ads/templates/*.html` → `*.html.j2`; local kept `.html` | Certain | High | Trust remote refactor (it implements approved Spec 1). Local IG `templates/` are isolated — won't conflict with `ads/templates/` |
| `pyproject.toml` — remote added jinja2/pyyaml/anthropic; we didn't | Likely | Low | Take remote's version |
| `docs/plans/` and `docs/superpowers/specs/` — both added new files | Certain | None | Both files coexist (different filenames) |
| Goldens drift after merge if remote refreshed brand/ads goldens | Possible | Medium | Re-run full pipeline + visual_regression after merge |
| Devflow hook update breaks pytest invocation in current session | Possible | High | Devflow update happens AFTER project pushed; rollback via `backup/pre-bigsync-2026-04-29` |
| Devflow new TDD enforcer rules are stricter and our IG commits would now fail | Low | Low | Already merged + pushed; if a new commit triggers, address ad hoc |

---

## 5. Phases

### Phase A — Project repo merge (criativos)

A1. Backup branch created: `backup/local-instagram-pre-merge` at `4ffb20e`. ✅
A2. Fetch latest origin: `git fetch origin`. (Already done.)
A3. Strategy: **merge with merge commit** (option A from earlier brainstorm).
    Rationale: 30 local commits include atomic per-template work that's better
    preserved as-is than re-played on top of the remote's structural refactor.
    A merge commit honestly records "two parallel efforts integrated here."
A4. Execute `git merge origin/main` in main.
A5. For each conflict, resolve with the rule: "preserve both sides' intent,
    don't drop functionality":
   - `scripts/build.py`: combine arg groups; chain dispatches (brand → ads →
     instagram); don't drop any flag.
   - `brand/tokens.css`: keep all tokens from both sides.
   - `tests/test_tokens_truth.py`: keep `_stylesheet_text_for` (our addition);
     ensure `INSTAGRAM_TEMPLATES` glob is in the final `ALL_TEMPLATES`; if
     remote also extended the test, integrate without losing IG coverage.
   - `pyproject.toml`: take remote's deps (jinja2, pyyaml, anthropic) +
     ensure ours don't get dropped.
   - `ads/templates/*.html` if both sides modified: take remote (it migrated to
     `.html.j2`); we never touched `ads/templates/` in our 30 commits.
A6. After all conflicts resolved, run `pytest -q`. Must be green or fix.
A7. Run `python scripts/build.py --all`. Must complete without `[FAIL]`.
A8. Run visual regression separately for confidence.
A9. Commit the merge with descriptive message.
A10. Push to `origin/main`.

### Phase B — Devflow update

B1. Backup branch created: `backup/pre-bigsync-2026-04-29` on devflow at `ac3e8b7`. ✅
B2. Pull devflow main: `git pull --ff-only origin main` (no diverging local
    work, so fast-forward is safe).
B3. Run devflow's own self-tests if any exist.
B4. Re-run criativos pytest to confirm devflow update didn't break anything.
B5. Try a small commit in criativos (this very spec doc, e.g.) to verify hook
    chain still works.
B6. If anything broken, restore via `git reset --hard backup/pre-bigsync-2026-04-29`
    in the devflow repo.

### Phase C — Verify integration

C1. From `vibeweb/`: `pytest -q`. Must stay green.
C2. From `vibeweb/`: `python scripts/build.py --all`. Must complete.
C3. From `vibeweb/`: `pytest features/instagram_content/test_render.py::test_visual_regression -v`.
    Must show 48 PASS.
C4. Working tree clean.
C5. If any check fails, surface and don't push. Restore via backups.

### Phase D — Cleanup

D1. Delete safety branches IF everything green and pushed.
D2. Update `~/.claude/devflow/state/default/active-spec.json` to COMPLETED.
D3. Final summary report.

---

## 6. Conflict resolution decision matrix (for Phase A5)

| File | Local has | Remote has | Resolution |
|---|---|---|---|
| `scripts/build.py` | `--instagram` flag, dispatch to `features.instagram_content.render` | likely `--copy-generation` or Jinja2 hooks; possibly a new module | Keep BOTH flags in mutex group; chain dispatches in `--all` (brand → ads → instagram → any new) |
| `brand/tokens.css` | `--ig-handle` token | possibly other tokens | Append all; preserve order |
| `tests/test_tokens_truth.py` | `INSTAGRAM_TEMPLATES`, `_stylesheet_text_for`, follow-link logic | possibly Jinja2-aware globs (`.html.j2`) | Combine globs; preserve our helper; extend if needed for `.html.j2` |
| `pyproject.toml` | unchanged from baseline | added jinja2, pyyaml, anthropic | Take remote |
| `tests/test_visual_regression.py` | imports moved to `shared/visual_regression.py` | possibly new test cases | Combine: new cases use shared/ constants |
| `ads/templates/*.html` | unchanged | migrated to `.html.j2` (remote refactor) | Take remote's full refactor |
| `ads/render.py` | unchanged | likely consumes `config/ads.yaml` + Jinja2 | Take remote |
| `scripts/pipeline.py` | added `requestfailed` listener | possibly Jinja2 hooks | Combine if both modified |
| `tests/test_build_cli.py` | extended for `--instagram` | possibly extended for new flags | Take both extensions |
| `docs/plans/`, `docs/superpowers/specs/` | new IG files | new copy_generation/web_gui files | Both coexist |
| `.gitignore` | `features/instagram_content/renders/` | possibly `node_modules/`, `web_gui/.next/`, etc. | Combine all rules |

---

## 7. Verification plan

After Phase A merge completes:

```bash
# 1. structural integrity
git status                          # clean working tree
git log --oneline -10                # merge commit at HEAD

# 2. pytest sanity
pytest -q                            # all green

# 3. full pipeline rebuild
python scripts/build.py --all        # no [FAIL] markers

# 4. visual regression on the IG factory specifically
pytest features/instagram_content/test_render.py::test_visual_regression -v

# 5. tokens-truth spans IG + ads + brand templates
pytest tests/test_tokens_truth.py -q

# 6. confirm CLI still exposes all flags
python scripts/build.py --help       # --brand, --ads, --instagram, +remote's
```

After Phase B devflow update:

```bash
# 7. fresh hook chain doesn't crash
cd ~/.claude/devflow/ && python -c "import devflow"  # or whatever entrypoint

# 8. trial commit to project repo to exercise hooks
cd /c/Users/Vinicius/Developer/vibeweb && git commit --allow-empty -m "test(devflow): verify hook chain post-update"
```

If any step fails: roll back via backup branch, surface issue.

---

## 8. Out-of-scope (post-merge follow-ups)

- Spec: `instagram_content/` consumes `copy_generation` agent (replaces
  hardcoded copy with config + LLM-generated variants).
- Spec: IG templates migrate to Jinja2 (consistency with ads).
- Spec: Web GUI integration — IG content visible/editable from the FastAPI app.
- Spec D / Spec E (Reels, conversion funnel) — pre-existing roadmap items.
- Devflow self-tests in CI for criativos (the new SOTA v2 has more rigorous
  cloud-side judging — adopt or adapt).

---

## 9. Backup state (rollback procedure)

If anything irrecoverable happens:

```bash
# Project repo restore
cd /c/Users/Vinicius/Developer/vibeweb
git checkout main
git reset --hard backup/local-instagram-pre-merge

# Devflow restore
cd ~/.claude/devflow/
git checkout main
git reset --hard backup/pre-bigsync-2026-04-29
```

Both backups exist as of 2026-04-29 14:XX UTC-3 (start of this spec).
