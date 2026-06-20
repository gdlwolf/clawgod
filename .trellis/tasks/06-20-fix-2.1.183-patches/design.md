# Fix Design

## Root cause

2.1.183 renamed minified identifiers. ClawGod patches hardcoding old names fail to match; sentinels keyed on old-source-fragment absence then misreport "already applied" because the old fragment is gone too. Two problems to fix together: **regex robustness** and **sentinel truthfulness**.

## Strategy

### 1. Regex robustness — wildcard + stable anchoring

- Match function/parameter/variable names with `[\w$]+` capture groups, never literals like `ST`, `qq`, `H`, `$`, `M86`.
- Anchor on **stable** substrings: tengu flag names (`tengu_sepia_moth`, `tengu_prompt_cache_1h_config`, …), provider literals (`firstParty`/`anthropicAws`/`gateway`/`foundry`), env names (`ANTHROPIC_BASE_URL`, `CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, …), and structural punctuation.
- Add `validate(match, code)` where more than one structurally-similar function could match (e.g. cache-scope vs other `if(!X())return!1` functions), anchoring on nearby stable strings.

### 2. Sentinel truthfulness — patched-marker presence

Current engine: 0 matches + sentinel(old-fragment) absent → "already applied". This is fooled by renames. Add a `patchedMarker` field:

- `patchedMarker`: a string the replacer injects. Engine semantics:
  - matches > 0 → apply (as today).
  - 0 matches + `patchedMarker` present in code → "already applied" (truthful: marker proves a prior apply).
  - 0 matches + `patchedMarker` absent + sentinel(old-fragment) present → "regex stale" (failed).
  - 0 matches + both absent + optional → skip; + non-optional → "cannot verify" warn.
- Keep `sentinel` (old-fragment) as the stale-detection signal; `patchedMarker` is the applied-proof. Together they distinguish applied vs stale.
- For pure-replacement patches (colors, `CYBER_RISK_INSTRUCTION`) where injecting a marker is awkward, keep current sentinel-only behavior.

### 3. 3P-guard uniform pattern

For patches that gate a feature on provider (cache TTL, cache scope, Advisor, Send File, image, outputFormat, adaptive thinking, web_search): inject `if(process.env.ANTHROPIC_BASE_URL&&!/anthropic\.com/i.test(process.env.ANTHROPIC_BASE_URL))return <disable|!1|!0>;` at function entry — same idiom as the existing `web_search`/`outputFormat` patches. Stable, no minified-name dependence.

## Patch rewrite table (2.1.183 evidence)

| # | Patch | 2.1.183 new form (stable anchor) | Root cause | Fix |
|---|---|---|---|---|
| 1 | beta-header strip | `parse(e,t){return t={...t,headers:Ss([{"anthropic-beta":[...e.betas??[],"structured-outputs-2025-12-15"].toString()},t?.headers])},this.create(e,t).then(` | `parse(H,$)`/`H.betas` literals | wildcard `parse([\w$]+,[\w$]+)`; anchor `structured-outputs-2025-12-15` + `this.create`; `patchedMarker` = injected `_betas=process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` |
| 2 | outputFormat guard | `function GNe(e){let t=Bo(e),n=_y(e);if(!lO(n))return!1;if(t.includes("claude-3-")||t==="claude-opus-4-0"||t==="claude-sonnet-4-0")return!1;return!0}` | `function X(H){let $...}` literals | wildcard fn+params; anchor `claude-3-`+`claude-opus-4-0`+`claude-sonnet-4-0`+`return!0}`; inject 3P guard; `patchedMarker` = `ANTHROPIC_BASE_URL&&!/anthropic` inside this fn |
| 3 | CLAUDE.md inject | `function HAi(e){let t=e.cli.systemPrompt,n=e.cli.appendSystemPrompt,r=ers();...}`; no `CLAUDE_CODE_APPEND_SYSTEM_PROMPT` reader | `k9(H)` gone | retarget `HAi(e)`: merge `process.env.CLAUDE_CODE_APPEND_SYSTEM_PROMPT` into `appendSystemPrompt`; `patchedMarker` = env read. Fallback: wrapper passes via `--append-system-prompt` (verify `src/cli.cjs`). |
| 4 | ST/$M bypass | `function $M(){return SRr()&&!jNe()}` | `function ST(){return w86()}` gone | match `function [\w$]+(){return [\w$]+()&&![\w$]+()}` + validate near firstParty/cache-scope callers; replace → `return!0`; `patchedMarker` = `function $M(){return!0}`-equivalent (post-replace the `&&!...` is gone) |
| 5 | 1h cache TTL | `function M4e(e){...if(!Co()||Ix.isUsingOverage)return!1;...tengu_prompt_cache_1h_config...}` | `!qq()`/`bZ` literals | anchor `tengu_prompt_cache_1h_config` + `isUsingOverage`; replace the `if(![\w$]+()||[\w$]+.isUsingOverage)return!1` preceding the flag lookup → `if(!1)return!1`; `patchedMarker` = `/* patched: bypass auth check for 1h cache */` (already designed, just fix regex) |
| 6 | global cache scope | `function Xve(){if(!$M())return!1;if(!Pu())return!1;let e=Ir();return e==="firstParty"||e==="anthropicAws"}` | `let H=` literal | wildcard `let [\w$]+=[\w$]+();return [\w$]+==="firstParty"\|\|[\w$]+==="anthropicAws"`; validate fn has exactly two `if(!X())return!1` + the firstParty/anthropicAws return; replace `return ...`→`return!0`; `patchedMarker` = comment |
| 7 | Advisor | `if(st(process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL))return!1;if(Ir()!=="firstParty"||!$M())return!1;` | `bH(`/`vq()` literals | wildcard; anchor `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` + `!=="firstParty"`; drop the `||!$M()` clause; `patchedMarker` = absence of `!=="firstParty"||!` after ADVISOR_TOOL |
| 8 | 1M context | `var mxt=200000,jQ=200000,...` (default ctx) | `M86` gone | locate the `var <name>=200000` that the context-window fn returns as default (confirm via call site); replace → `=1000000`; `patchedMarker`/sentinel on the 1000000 literal |
| 9 | MAX_CONTEXT_TOKENS w/o DISABLE_COMPACT | `if(Ge.DISABLE_COMPACT&&process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS){` | `bH(process.env.DISABLE_COMPACT)` (call) → `Ge.DISABLE_COMPACT` (prop) | regex accept both `[\w$]+\(process\.env\.DISABLE_COMPACT\)` and `[\w$]+\.DISABLE_COMPACT`; replace → `if(process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS){`; `patchedMarker` = no DISABLE_COMPACT before MAX_CONTEXT_TOKENS |
| 10 | auto-mode unlock | `function X(e){if(e==="firstParty"||e==="anthropicAws")return!0;return st(process.env.CLAUDE_CODE_ENABLE_AUTO_MODE)}` | `aM$`/`FH`/`H` literals | wildcard fn+param+env-fn; anchor `CLAUDE_CODE_ENABLE_AUTO_MODE`; replace → `return!0`; `patchedMarker` |
| 11 | Send User File | `isEnabled(){if(Ir()!=="firstParty"||ra())return!1;if(!ct("tengu_send_user_file",!0))return!1;` | `vq()`/`Z$(` literals | wildcard; anchor `tengu_send_user_file`; drop `Ir()!=="firstParty"||` clause; `patchedMarker` |
| 12 | 10MB image | `function cmd(){if(Ir()==="firstParty"&&Pu()&&ct("tengu_crimson_vector",!1))return cxi;return L9.maxBase64Size}` | `vq()`/`Z$(` literals | wildcard; anchor `tengu_crimson_vector`+`maxBase64Size`; drop `Ir()==="firstParty"&&`; `patchedMarker` |

Upstream-removed (leave as optional no-op): Fast mode (`uc()` no longer has firstParty gate) — confirm and mark optional.

## New patches

- **finding-05 auto-compact**: `features.json` += `"tengu_sepia_moth": true`. Verify the GrowthBook-override injection path actually feeds `ct("tengu_sepia_moth")` for 3P (else add a patch forcing the auto-compact gate true). Gate is `if(!ct("tengu_sepia_moth",!1))return!1` in the auto-compact fn.
- **finding-06 adaptive thinking**: at the `vse()` decision (or the `thinkingConfig:u??(vse()!==!1?{type:"adaptive"}:{type:"disabled"})` site), inject 3P guard so custom `ANTHROPIC_BASE_URL` models get `{type:"disabled"}` unless `MAX_THINKING_TOKENS`/`CLAUDE_CODE_DISABLE_THINKING` already says otherwise. Preserve official-model thinking.

## Verification

- `node src/patch.mjs --dry-run` and `node ~/.clawgod/patch.mjs --dry-run`: 0 failed, no "sentinel absent" false-greens.
- Per-patch `grep` marker checks on patched `cli.original.cjs`.
- Optional smoke: launch `clawgod -p` with 3P base URL, confirm no 400/empty on a simple prompt; confirm cache_read tokens > 0 on second turn (if provider reports).

## Risks

- Wildcard regexes risk matching the wrong function; mitigated by `validate()` + stable anchors + `patchedMarker` proof.
- `mxt` vs `jQ` (both 200000): must pick the one returned as context default; confirm via call site before patching.
- CLAUDE.md injection retarget to `HAi` may conflict with user `--append-system-prompt`; keep wrapper env path as fallback.
- Sentinel engine change touches the main loop — test all patch categories (applied/optional/no-op/stale).
