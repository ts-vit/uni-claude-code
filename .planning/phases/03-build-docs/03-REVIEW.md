---
phase: 03
phase_name: build-docs
reviewed: 2026-05-16T17:00:00Z
depth: quick
status: issues_found
findings_count: 3
critical: 0
warning: 2
info: 1
---

# Phase 03: Build & Docs — Code Review Report

**Reviewed:** 2026-05-16T17:00:00Z
**Depth:** quick (docs-only phase, no source code changes)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

All eight files modified in phase 3 were reviewed: `README.md`, `CLAUDE.md` (free-form section), `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/phases/03-build-docs/03-03-TEST-NOTES.md`, `.planning/phases/03-build-docs/03-VERIFICATION.md`.

Grep-invariant check on all modified files (excluding GSD-block content per D-C4): zero hits for `npm.ts-vit.com`, `ts-vit/ai-chat`, `private registry`, `git dependency`. The three hits found in CLAUDE.md (lines 77, 143, 247) are all within `<!-- GSD:*-start … GSD:*-end -->` blocks and are correctly classified as expected/deferred per D-C4. No source files (`src/`, `src-tauri/`, `crates/`) were touched in any of the 8 phase-3 commits. All README commands match actual `package.json` scripts; `.nvmrc` is correctly described as absent.

Two inaccuracies were found: one is a hardcoded local machine path in the committed free-form section of CLAUDE.md (visible to all cloners), and one is an understated commit range in VERIFICATION.md Truth #10 that leaves four phase-3 commits formally unverified by that specific claim. A minor info item notes that VERIFICATION.md records the source commit as `ebb79e1`, which is consistent with the actual clone-time HEAD but may confuse readers since the current HEAD is `cd8004e`.

---

## Warnings

### WR-01: Hardcoded local machine path committed in CLAUDE.md free-form section

**File:** `CLAUDE.md:56`

**Issue:** The free-form (non-GSD-block) "Vendored Dependencies" paragraph at line 56 contains:

```
Upstream sync is not maintained — vendored copy is a one-shot snapshot from `D:\work-ai\ai-chat`.
```

This is a Windows-specific absolute path to the author's local machine. It is not inside any GSD block (the first GSD block starts at line 62), so D-C4 does not protect it from manual edits. Any developer cloning the repository will see a path that does not exist on their machine, with no explanation of what it means for them. The path also references `ai-chat` — the previously-private upstream — which may be confusing post-vendoring.

**Fix:** Remove the machine-specific path reference. The surrounding sentence conveys the same meaning without it:

```markdown
Upstream sync is not maintained — vendored copy is a one-shot snapshot taken during project setup.
```

Or, if provenance is important to preserve, generalize it:

```markdown
Upstream sync is not maintained — vendored copy is a one-shot snapshot from the private `ts-vit/ai-chat` upstream (no longer needed for building this repo).
```

---

### WR-02: VERIFICATION.md Truth #10 uses HEAD~4 but phase 3 has 8 commits — four phase-3 commits are not covered by the cited diff command

**File:** `.planning/phases/03-build-docs/03-VERIFICATION.md:32`

**Issue:** Truth #10 states:

```
git diff --stat HEAD~4 HEAD -- src/ src-tauri/ crates/ → пусто
```

Phase 3 consists of 8 commits (`3b798e8` through `cd8004e`). At the time VERIFICATION.md was written (commit `aa3020a`), HEAD~4 covered only `ec3f67f`, `ebb79e1`, `f1e46d3`, `58c6b0e` — the four most recent phase-3 commits. The first four phase-3 commits (`3b798e8`, `4f102a8`, `9b3faed`, `58c6b0e`) are not covered by this specific command.

The actual fact being asserted is true (running `git diff --stat HEAD~8 HEAD -- src/ src-tauri/ crates/` returns empty), but the evidence cited in the VERIFICATION.md does not actually prove it — the cited command leaves half the phase's commits unverified.

**Fix:** Update the evidence line to use the correct commit range:

```markdown
git diff --stat HEAD~8 HEAD -- src/ src-tauri/ crates/   →  пусто
```

Or cite the base commit directly:

```markdown
git diff --stat 3b798e8..HEAD -- src/ src-tauri/ crates/   →  пусто
```

---

## Info

### IN-01: VERIFICATION.md records source commit ebb79e1 but current HEAD is cd8004e — potential reader confusion

**File:** `.planning/phases/03-build-docs/03-VERIFICATION.md:129`

**Issue:** The Artifacts section records:

```
Source commit: ebb79e1ec889f9a00c041b5d4ca4a3bedd8cf0da
```

This is the HEAD at the time of the actual test run (commit `ec3f67f` was the test; it was committed at HEAD that included `ebb79e1` as its parent). However, post-facto additions (`aa3020a`, `cd8004e`) added documentation commits on top, making the recorded "source commit" four commits behind the current HEAD. A future reader might assume the test was run against a stale state.

The claim is factually accurate about what was actually tested, and the Deviation D-V2 section explains the methodology. No fix is required for correctness, but adding a parenthetical note would help:

```markdown
**Source commit:** `ebb79e1ec889f9a00c041b5d4ca4a3bedd8cf0da` *(HEAD at time of test run; subsequent commits are documentation-only)*
```

---

_Reviewed: 2026-05-16T17:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
