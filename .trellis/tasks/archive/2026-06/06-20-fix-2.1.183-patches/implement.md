# Execution Plan

## Phased (verify after each)

### Phase A — Sentinel engine + cache-critical patches (P0 core)
1. Edit `src/patch.mjs` main loop: add `patchedMarker` handling (applied-proof) alongside existing `sentinel` (stale-detection). Truth table per design.md §2.
2. Rewrite patch #5 (1h cache TTL): regex wildcard + anchor `tengu_prompt_cache_1h_config`/`isUsingOverage`; keep existing `patchedMarker` comment; verify it now matches `M4e`/`Co`/`Ix`.
3. Rewrite #6 (global cache scope): wildcard `let X=Y()`; validate two `if(!X())return!1` + firstParty/anthropicAws return; `patchedMarker`.
4. Rewrite #4 (ST/$M bypass): `function X(){return Y()&&!Z()}` + validate near cache-scope/firstParty callers; → `return!0`.
5. Rewrite #8 (1M context): confirm `mxt` vs `jQ` via call site; patch the default-200000 var → 1000000.
6. `node ~/.clawgod/patch.mjs --dry-run`; marker-grep each of 4/5/6/8 on patched source.

### Phase B — Remaining false-greens
7. #1 beta-header, #2 outputFormat, #3 CLAUDE.md, #7 Advisor, #9 MAX_CONTEXT_TOKENS, #10 auto-mode, #11 Send File, #12 image — apply wildcard+anchor+marker per design table.
8. Confirm Fast mode is now upstream-removed (mark optional if so).
9. `--dry-run` + marker-grep all.

### Phase C — New guards
10. finding-05: add `tengu_sepia_moth:true` to `features.json` + its generator in `install.sh`/`install.ps1`; verify `ct("tengu_sepia_moth")` resolves true for 3P (else add gate-forcing patch).
11. finding-06: add adaptive-thinking 3P guard patch at `vse()`/thinkingConfig site; preserve `MAX_THINKING_TOKENS`/`CLAUDE_CODE_DISABLE_THINKING`.
12. `--dry-run` + marker-grep.

### Phase D — Sync + verify
13. `diff src/patch.mjs ~/.clawgod/patch.mjs` after reinstalling repo patcher into `~/.clawgod/` (or run install path) — expect identical.
14. Full `node ~/.clawgod/patch.mjs --dry-run`: 0 failed, no false-green "sentinel absent" lines.
15. Optional smoke: `clawgod -p "say ok"` with 3P base URL.

## Validation commands
- `node src/patch.mjs --dry-run`
- `node ~/.clawgod/patch.mjs --dry-run`
- `grep -c '<patchedMarker>' ~/.clawgod/cli.original.cjs` per patch (after apply)
- `diff -u src/patch.mjs ~/.clawgod/patch.mjs`

## Rollback
- `src/patch.mjs` is git-tracked: `git checkout -- src/patch.mjs`.
- Installed: `cp ~/.clawgod/patch.mjs.bak ~/.clawgod/patch.mjs` then `node ~/.clawgod/patch.mjs --revert` on `cli.original.cjs` if a bad apply wrote it (dry-run first prevents this).

## Review gates
- After Phase A: dry-run must show 4/5/6/8 as real matches (not "already applied").
- After Phase B: zero "sentinel absent — cannot verify" warnings.
- After Phase C: new markers present; existing thinking control intact.
- Before commit: full dry-run 0 failed + marker audit.
