---
doc_type: audit-finding
audit: 2026-06-20-claude-code-compat
finding_id: bug-02
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 02：outputFormat/json_schema 第三方 API 禁用补丁已过期

## 速答

`Disable outputFormat json_schema for third-party API` 在 2.1.183 没有命中新版 `GNe()` 能力判断函数，导致第三方 API 仍可能走 structured output / `output_config.format` 路径。

## 关键证据

- `src/patch.mjs:386` — patch 名称是 `Disable outputFormat json_schema for third-party API`。
- `src/patch.mjs:389` — 正则硬编码 `function X(H){let $=...,q=...}` 形态，依赖 `H/$/q` 混淆名。
- `src/patch.mjs:390` — replacement 预期向函数开头插入 `if(process.env.ANTHROPIC_BASE_URL&&!/anthropic\.com/i.test(process.env.ANTHROPIC_BASE_URL))return!1;`。
- `src/patch.mjs:391` — sentinel 使用 `let $` 形态，也不适配 2.1.183 的 `let t,n`。
- `node ~/.clawgod/patch.mjs --dry-run` — 该 patch 输出 `0 matches, sentinel absent — cannot verify`，这是本次唯一显式警告。
- `~/.clawgod/cli.original.cjs:411` — 2.1.183 中同等能力函数是 `function GNe(e){let t=Bo(e),n=_y(e);if(!lO(n))return!1;if(t.includes("claude-3-")||t==="claude-opus-4-0"||t==="claude-sonnet-4-0")return!1;return!0}`。
- `~/.clawgod/cli.original.cjs:411` — `GNe(e)` 被用于 structured output beta header 注入：`if(lO(_y(e))&&!jNe()&&GNe(e)&&l)t.push(hQ)`。
- `~/.clawgod/cli.original.cjs:10057` — `GNe(r)` 直接参与请求体 format 注入：`function ibf(e,t,n,r){if(!e||"format"in t||!GNe(r)||!Zoe(r,"structured_outputs"))return;if(t.format=e,!n.includes(hQ))n.push(hQ)}`。
- 本次 regex 检查：旧 exact regex 命中 `0`，放宽参数名后的同形 regex 命中 `1`，目标函数仍存在但旧 patch 已不能命中。

## 影响

Stop/SubagentStop hook evaluator、`--json-schema`、side query 或其他 structured output 路径可能继续向第三方 API 注入 `outputFormat` / `output_config.format` / structured output beta。第三方 API 如果不支持 Anthropic structured output 扩展，会出现 JSON validation 失败、400 或响应解析失败。

## 修复方向

更新 patch pattern 以匹配 2.1.183 的 `GNe(e)` 形态，避免硬编码参数名；同时将 sentinel 调整为已插入 provider guard 的可靠 marker，并补充对 `ibf()` 路径的验证。

## 建议动作

`cs-issue`，因为这是当前 dry-run 已显式提示且静态调用链可确认的兼容性 bug。
