# Audit Claude Code CLI compatibility

## Goal

Determine whether ClawGod needs updates for the locally installed Claude Code CLI version, with emphasis on whether previously fixed restriction-bypass patches are still genuinely effective and whether recent Claude Code releases introduced new restrictions that ClawGod does not yet cover.

The audit should produce evidence-backed conclusions before any code change is proposed.

## Confirmed Facts

- Local `claude --version` reports `2.1.183 (Claude Code)`.
- Local `clawgod --version` reports `2.1.183 (Claude Code)`.
- `~/.clawgod/.source-version` contains `2.1.183`, so the installed ClawGod wrapper is currently patched against the latest local native Claude binary.
- Recent local native Claude binaries under `~/.local/share/claude/versions/` include `2.1.178`, `2.1.179`, `2.1.181`, and `2.1.183`.
- Core patch logic lives in `src/patch.mjs`; installed patch state lives under `~/.clawgod/`.
- This task is an audit first. It should not modify `src/patch.mjs`, install scripts, or local Claude files unless a follow-up fix task is explicitly approved.

## Requirements

- Verify whether current repository `src/patch.mjs` can patch the local Claude Code `2.1.183` source cleanly.
- Distinguish "regex matched" from "patch is still behaviorally relevant"; identify stale patches that match old structures, became no-ops, or no longer protect the intended third-party provider path.
- Check previously important restriction areas:
  - first-party / Anthropic-only gates for features
  - model allowlists and model family checks
  - sub-agent / background / daemon / remote-control model and provider restrictions
  - web search, structured output, tool schemas, auto-memory, advisor, channels, image limit, context window, CLAUDE.md/system-prompt handling
  - `claude update` redirection and version drift behavior
- Search the `2.1.183` extracted source for new third-party provider restrictions or policy gates not represented in current patch definitions.
- Record findings with file/line evidence, command evidence, and confidence level.
- Recommend whether to:
  - do nothing,
  - update one or more patch patterns/sentinels,
  - add new patches,
  - or open a deeper targeted issue for behavior that cannot be proven statically.

## Constraints

- Do not edit production code during this audit.
- Do not overwrite user or existing local changes.
- Prefer dry-run and read-only inspection commands.
- Treat command success alone as insufficient when the question is whether old fixes are still truly effective.

## Acceptance Criteria

- [ ] The audit identifies the exact local Claude Code version and patched source version.
- [ ] `src/patch.mjs --dry-run` or an equivalent read-only patch application result is captured and interpreted.
- [ ] Each stale, suspicious, or missing patch candidate includes evidence from the relevant source snippet.
- [ ] Newly introduced upstream restrictions are searched for and either reported or explicitly marked as not found in the inspected areas.
- [ ] The final report states whether ClawGod needs an upgrade now, and separates confirmed required fixes from lower-confidence follow-up investigations.

## Notes

- This is a complex audit task; use `design.md` and `implement.md` before starting execution.
