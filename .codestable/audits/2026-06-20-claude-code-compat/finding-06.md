---
doc_type: audit-finding
audit: 2026-06-20-claude-code-compat
finding_id: bug-06
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 06：第三方 API 默认发送 adaptive thinking → 网关 400/挂起/空响应

## 速答

Claude Code 在 `effortLevel: high/xhigh`（或默认 thinking on）时对每个 `/v1/messages` 请求发送 `thinking:{type:"adaptive"}`，包括通过 `ANTHROPIC_BASE_URL` 路由的未识别 custom model。许多非 Anthropic 模型（DeepSeek/Nemotron/Haiku 经网关）不能处理该参数，静默挂起、返回空或 400。clawgod 没有任何 patch 处理此问题，是用户第 2 项"智能效果"维度的确认缺口。

## 关键证据

- GitHub issue **#68551**（open, 2.1.177）`Claude Code sends thinking:{type:adaptive} to custom ANTHROPIC_BASE_URL models — gateways 400 / empty / hang`：
  - `effortLevel: xhigh` 时对每个请求发 `thinking:{"type":"adaptive"}`。
  - DeepSeek reasoning 模型：挂起几分钟无输出；Nemotron：空响应；Claude Haiku(网关)：HTTP 400；GLM/Gemini：容忍但慢。
  - workaround：`CLAUDE_CODE_DISABLE_THINKING=1`（省略 thinking 参数，保留 cache_control）。`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` 无效。
- `~/.clawgod/cli.original.cjs`（2.1.183）发送逻辑：`thinkingConfig:u??(vse()!==!1?{type:"adaptive"}:{type:"disabled"})`。
- `vse()` 定义：`function vse(){if(process.env.MAX_THINKING_TOKENS)return parseInt(process.env.MAX_THINKING_TOKENS,10)>0;let{settings:e}=gq();if(e.alwaysThinkingEnabled===!1)return!1;return!0}` —— 默认 `return!0`（adaptive on）。
- `CLAUDE_CODE_DISABLE_THINKING` 在别处检查：`so=st(process.env.CLAUDE_CODE_DISABLE_THINKING)`。
- changelog 2.1.166：`MAX_THINKING_TOKENS=0 / --thinking disabled ... (3P providers unchanged)` —— 官方对 3P thinking 路径未加新限制，但默认仍发送 adaptive，兼容性由 provider 承担。

## 影响

第三方 API 用户在 high/xhigh effort 下，对不兼容 Anthropic thinking schema 的模型会静默挂起/空/400。GLM 系列虽"容忍但慢"，仍拖慢响应、增加无效 token。这是"智能效果"维度的真实兼容问题，clawgod 当前完全未覆盖。当前会话本身使用 glm-5.2，若 effort 提升可能受影响。

## 修复方向

二选一：
1. **patch**：在第三方 base URL 时让 `vse()` 返回 false（不发 adaptive thinking），类似 `web_search`/`outputFormat` 的 `ANTHROPIC_BASE_URL` 第三方守卫模式。需保留官方模型用户的 thinking。
2. **配置**：在 wrapper（`src/cli.cjs`）对第三方 base URL 场景默认设 `CLAUDE_CODE_DISABLE_THINKING=1`（若用户未显式开启 thinking）。但这会牺牲支持 thinking 的第三方模型。

倾向方案 1（与现有第三方守卫补丁风格一致）。

## 建议动作

`cs-issue`，P1。需结合用户实际使用的第三方模型是否支持 thinking 决定默认策略；建议做成可由 env 开关控制。
