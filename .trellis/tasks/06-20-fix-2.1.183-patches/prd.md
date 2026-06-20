# Fix 2.1.183 patch false-greens and add 3P guards

## Goal

Restore ClawGod's third-party-API restriction-bypass patches on Claude Code 2.1.183, where a minified-identifier rename silently broke ~12 patches that dry-run misreports as "already applied". Also add two new third-party guards found in the compat audit (adaptive thinking, auto-compact).

## Background

Compat audit (`.codestable/audits/2026-06-20-claude-code-compat/`, findings 01–06) established that 2.1.183 renamed minified identifiers across the board: `ST→$M`, `k9→HAi`, `qq→Co`, `vq/Dq→Ir`, `ivH→M4e`, `FYH→Xve`, `M86→mxt`, `bH(env)→st(env)` / `bH(env)→Ge.<ENV>` (property form). ClawGod patches that hardcode these names no longer match; their sentinels (old-source-fragment absence) then misreport "already applied". Net effect: third-party-API users silently lose 1h cache TTL, global cache scope, Advisor, 1M context, Send User File, 10MB image, auto-mode unlock, MAX_CONTEXT_TOKENS, beta-header strip, outputFormat guard, CLAUDE.md injection, and the ST firstParty master switch.

Upstream also **removed** some gates (Fast mode firstParty check → now no-op `uc()`), so those patches become harmless no-ops, not false-greens.

## Requirements

- Rewrite the ~12 false-green patches in `src/patch.mjs` to `[\w$]+` wildcard + stable-identifier anchoring; convert their sentinels to patched-marker presence checks.
- Add a `patchedMarker` mechanism to the patch engine so 0-match + no-marker is reported as "regex stale", not "already applied".
- Add `tengu_sepia_moth: true` to `features.json` and its install-script generator (finding-05).
- Add an adaptive-thinking 3P guard patch (finding-06), preserving `MAX_THINKING_TOKENS`/`CLAUDE_CODE_DISABLE_THINKING` control.
- Verify against installed `~/.clawgod/cli.original.cjs` (2.1.183).

## Constraints

- Do not break patches that are genuinely applied or that are harmless no-ops (Fast mode).
- Do not change behavior for official first-party users except where the patch already intentionally bypasses (preserve env overrides).
- Keep `src/patch.mjs` and installed `~/.clawgod/patch.mjs` in sync.

## Acceptance Criteria

- [ ] `node ~/.clawgod/patch.mjs --dry-run` reports 0 failed and no "already applied, sentinel absent" for any previously-false-green patch.
- [ ] Marker checks on patched `cli.original.cjs` confirm every rewritten patch's injected marker is present.
- [ ] These 12 verified applied: beta-header strip, outputFormat guard, CLAUDE.md injection, ST/$M bypass, 1h cache TTL, global cache scope, Advisor, 1M context (mxt), MAX_CONTEXT_TOKENS w/o DISABLE_COMPACT, auto-mode unlock, Send User File, 10MB image.
- [ ] `tengu_sepia_moth: true` in `features.json` and its install generator.
- [ ] Adaptive-thinking 3P guard applied; thinking env controls preserved.
- [ ] No regression: applied patches stay applied; optional/no-op patches skip cleanly; dry-run ends `0 failed`.
- [ ] `diff src/patch.mjs ~/.clawgod/patch.mjs` in sync (or reinstall verified).
