---
doc_type: audit-finding
audit: 2026-06-20-claude-code-compat
finding_id: bug-03
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 03：CLAUDE.md system prompt 注入补丁已不命中新版入口

## 速答

ClawGod wrapper 仍设置 `CLAUDE_CODE_APPEND_SYSTEM_PROMPT`，但 Claude Code `2.1.183` 的 `cli.original.cjs` 已不读取该 env；旧 patch 目标 `function k9(H){return H}` 也不存在，dry-run 误报为已应用。

## 关键证据

- `src/cli.cjs:127` — wrapper 注释说明要把 CLAUDE.md 注入 system prompt。
- `src/cli.cjs:146` — wrapper 实际设置 `process.env.CLAUDE_CODE_APPEND_SYSTEM_PROMPT ??= ...`。
- `~/.clawgod/cli.cjs:149` — 已安装 wrapper 同样设置 `CLAUDE_CODE_APPEND_SYSTEM_PROMPT`。
- `src/patch.mjs:628` — patch 名称是 `Append CLAUDE_CODE_APPEND_SYSTEM_PROMPT into system prompt`。
- `src/patch.mjs:629` — 旧 patch 只匹配 `function k9(H){return H}`。
- `src/patch.mjs:630` — replacement 预期让 `k9()` 读取 `process.env.CLAUDE_CODE_APPEND_SYSTEM_PROMPT`。
- `~/.clawgod/cli.original.cjs` 全文搜索 `CLAUDE_CODE_APPEND_SYSTEM_PROMPT` 返回 `-1`，说明新版 CLI 没有读取 wrapper 设置的 env。
- `~/.clawgod/cli.original.cjs` 全文搜索 `function k9(H){return H}` 返回 `-1`，说明旧 patch 目标不存在。
- `~/.clawgod/cli.original.cjs:462` — 新版入口是 `function HAi(e){let t=e.cli.systemPrompt,n=e.cli.appendSystemPrompt,r=ers();if(r)n=n?...;return{systemPrompt:t,appendSystemPrompt:n}}`，它合并 CLI `appendSystemPrompt` 和 policyHelper `appendSystemPrompt`，但不读取 `CLAUDE_CODE_APPEND_SYSTEM_PROMPT`。
- `~/.clawgod/cli.original.cjs:32306` — CLI 启动路径调用 `HAi({cli:{systemPrompt:Ce,appendSystemPrompt:$e},env:process.env,settings:jr()})`，`$e` 来自 `--append-system-prompt` / `--append-system-prompt-file` 参数。

## 影响

ClawGod 期望把 CLAUDE.md 内容追加到 system prompt，使第三方 API 模型也能按系统指令处理项目约定。当前 wrapper 设置的 env 没有消费者，因此在 2.1.183 上该增强大概率失效。影响表现不是 API 400，而是 CLAUDE.md 指令遵循度下降、第三方 API 与官方 Claude Code 行为不一致。

## 修复方向

两条可选方向：更新 patch 让 `HAi()` 合并 `process.env.CLAUDE_CODE_APPEND_SYSTEM_PROMPT`；或改 wrapper 通过新版 CLI 已支持的 `--append-system-prompt` 路径传入内容。需要避免与用户显式 `--append-system-prompt` 冲突。

## 建议动作

`cs-issue`，因为这是 wrapper 与新版 CLI 接口漂移导致的 confirmed bug，修复需要同时检查 `src/cli.cjs`、install script 内嵌 wrapper 片段和 `src/patch.mjs` 是否仍需要该 patch。
