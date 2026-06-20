# Audit Design

## Scope

This task audits compatibility between ClawGod's repository patch definitions and the local Claude Code CLI `2.1.183` installation.

In scope:

- Repository patch definitions in `src/patch.mjs`.
- Installed ClawGod patcher and extracted source under `~/.clawgod/`.
- Local native Claude binaries under `~/.local/share/claude/versions/`.
- Install/update wrapper behavior relevant to version drift and `claude update`.

Out of scope:

- Code changes.
- Reinstalling Claude Code or ClawGod.
- Network-dependent live provider calls unless a later fix task requires them.

## Evidence Strategy

1. Confirm versions and source identity.
2. Run read-only patch verification against the installed extracted source.
3. Compare repository `src/patch.mjs` and installed `~/.clawgod/patch.mjs` where needed, because the local wrapper may already contain changes not yet represented in the repo or vice versa.
4. Inspect current `2.1.183` extracted source around every failed, optional, or suspicious patch.
5. Search for upstream restriction markers:
   - `firstParty`, `anthropicAws`, `gateway`
   - `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
   - feature flags beginning with `tengu_`
   - model allowlists and explicit model literals
   - policy gates around agents, daemon, background, web search, remote control, memory, channels, advisor, and image/context limits
6. For each finding, separate:
   - verified patch failure
   - patch still applies but target logic changed
   - upstream restriction removed
   - new upstream restriction not covered
   - inconclusive static result

## Reporting Shape

Produce a concise audit report in `.codestable/audits/2026-06-20-claude-code-compat/` following `cs-audit` conventions:

- `index.md` summarizes scope, commands, total assessment, and finding table.
- `finding-NN.md` files record concrete evidence when there is a real issue or high-value suspicious area.

If no upgrade is needed, still write `index.md` with the negative findings and residual risk.

## Risks

- Minified names change frequently; line-level source evidence may be stable only for local `2.1.183`.
- Dry-run matching can prove text replacement applicability, but not all runtime behavior.
- Installed files under `~/.clawgod/` may differ from the repository due to local install history.
