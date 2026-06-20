# Audit Execution Plan

## Checklist

- [x] Confirm task is started before execution.
- [x] Capture local version and source identity:
  - `claude --version`
  - `clawgod --version`
  - `~/.clawgod/.source-version`
  - latest files in `~/.local/share/claude/versions/`
- [x] Compare repository and installed patcher:
  - `diff -u src/patch.mjs ~/.clawgod/patch.mjs`
  - inspect only meaningful divergences.
- [x] Run dry-run verification:
  - `node src/patch.mjs --dry-run`
  - `node ~/.clawgod/patch.mjs --dry-run` if needed.
- [x] Parse patch names, matches, skipped optional patches, stale regex warnings, and "cannot verify" warnings.
- [x] Inspect source snippets for every warning/failure.
- [x] Search current extracted source for new restriction markers in the areas listed in `design.md`.
- [x] Write `.codestable/audits/2026-06-20-claude-code-compat/index.md`.
- [x] Write `finding-NN.md` only for concrete or high-value suspicious findings.
- [x] Report whether upgrade is needed and what exact next step is recommended.

## Validation Commands

- `node src/patch.mjs --dry-run`
- `node ~/.clawgod/patch.mjs --dry-run`
- targeted `rg` searches against `~/.clawgod/cli.original.cjs`
- targeted source snippet reads with line numbers

## Rollback

No production code or local Claude files should be modified. If any command unexpectedly writes generated files, stop and report before continuing.
