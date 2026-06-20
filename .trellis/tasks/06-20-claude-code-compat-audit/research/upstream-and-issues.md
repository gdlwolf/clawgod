# 上游 Claude Code 版本 / Changelog / Issue 调研

> 本任务第 2、3 项的外部证据。调研日期 2026-06-20。本地 = 上游最新 = 2.1.183。

## 版本基线

- `npm view @anthropic-ai/claude-code version` → `2.1.183`；dist-tags: `latest=2.1.183, next=2.1.183, stable=2.1.170`（走 npmmirror 镜像）。
- GitHub `anthropics/claude-code` 最新 release = `v2.1.183`（2026-06-19 发布）。
- **结论：上游 npm 与 GitHub 最新就是 2.1.183，本地已跟到最新。没有 2.1.184+ 需要审计。**
- 用户所说"升级了多个版本"是相对 journal 记录的 2.1.150（ClawGod 最初逆向版本）而言。2.1.150→2.1.183 之间的变更是本轮关注点。

## Changelog 关键条目（2.1.166 → 2.1.183，缓存 / thinking / 模型 / 第三方）

| 版本 | 条目 | 与第三方缓存/智能相关性 |
|---|---|---|
| 2.1.181 | `Fixed prompt caching not reading on custom ANTHROPIC_BASE_URL and on Foundry due to a per-request attestation token changing every turn` | **缓存**：官方修复第三方 base URL 缓存不命中。本地 2.1.183 已含。源码确认：`cch` nonce 只对 firstParty/vertex 注入（见下）。 |
| 2.1.183 | `Fixed thinking.disabled.display: Extra inputs are not permitted 400 on subagent spawns`；auto mode 安全强化 | thinking 400 修复。 |
| 2.1.178 | `Fixed claude agents workers 401 Invalid bearer token when daemon started from shell with custom API gateway via ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN` | 第三方 gateway 401 修复。 |
| 2.1.175 | `Added enforceAvailableModels managed setting`（模型 allowlist 强化） | 模型限制强化。 |
| 2.1.174 | `Fixed background sessions inheriting another session's ANTHROPIC_* provider env` | 第三方 env 继承修复。 |
| 2.1.173 | `Fixed Fable 5 model names with [1m] suffix not being normalized`（Fable 5 默认 1M） | 1M 上下文相关。 |
| 2.1.172 | `Fixed sessions using 1M context without usage credits getting permanently stuck`；`availableModels` 限制扩展到 subagent | 1M 上下文 + 模型 allowlist。 |
| 2.1.170 | `Introducing Claude Fable 5` | Fable 5 引入。 |
| 2.1.166 | `MAX_THINKING_TOKENS=0 / --thinking disabled ... now disable thinking on models that think by default via the Claude API (3P providers unchanged)` | **智能**：官方明确第三方 provider thinking 走不变路径。 |

## GitHub Issue 调研（search: `ANTHROPIC_BASE_URL cache`，total 133）

### 直接命中"第三方缓存 + 智能效果"

- **#68900 (open, 2.1.177)** `Billing-header nonce (cch) in system prompt breaks prompt caching on third-party providers`
  - 现象：每个 `/v1/messages` 第一个 system block 是 `x-anthropic-billing-header: cc_version=...; cc_entrypoint=sdk-cli; cch=<nonce>;`，`cch` 每轮变化，破坏前缀缓存 → 0% cache hit。剥离该 block 后 0%→99.7%。
  - **2.1.183 状态：已修复**。源码 `s=o==="firstParty"&&Pu()||o==="vertex"?" cch=00000;":""` —— 第三方不注入 cch。clawgod 无需处理。

- **#68551 (open, 2.1.177)** `Claude Code sends thinking:{type:adaptive} to custom ANTHROPIC_BASE_URL models — gateways 400 / empty / hang`
  - 现象：`effortLevel: high/xhigh` 时对每个请求（含第三方 custom model）发 `thinking:{type:adaptive}`。DeepSeek 挂起、Nemotron 空、Haiku(网关) 400、GLM/Gemini 容忍但慢。
  - workaround：`CLAUDE_CODE_DISABLE_THINKING=1`（保留 cache_control）。
  - **2.1.183 状态：未修复，clawgod 未覆盖**。源码 `thinkingConfig:u??(vse()!==!1?{type:"adaptive"}:{type:"disabled"})`，`vse()` 默认 true。见 finding-06。

- **#65585 (open, regression, v2.1.161+)** `Auto-compact stopped working for third-party API providers since v2.1.161`
  - 现象：第三方 auto-compact 自 v2.1.161 失效（v2.1.150 正常）。根因：GrowthBook 被 firstParty auth 门控 → `tengu_sepia_moth` flag 返回默认 false → 永不压缩 → 撞硬限崩溃。影响 Zhipu(glm)/Bedrock/Vertex/Foundry/任何 custom base URL。
  - **2.1.183 状态：未修复，clawgod features.json 漏 `tengu_sepia_moth`**。源码 gate `if(!ct("tengu_sepia_moth",!1))return!1`。见 finding-05。

- **#68522 (open, 2.1.177)** `Custom model via ANTHROPIC_BASE_URL: no way to declare context window >200k`
  - 现象：custom model id 被假设 200k，`[1m]` 只对内置名有效，无法声明 >200k。
  - **2.1.183 状态：clawgod `M86` patch false green**（M86 改名，见 finding-04）。

### 相关但非核心

- #47098 (open) `new sessions will never hit a (full)cache`
- #65863 (open, v2.1.167) `Agent() spawn fails with 400 thinking options type cannot be disabled`
- #63536 (open) `OTel api_request model attribute drops [1m] suffix while runtime serves 1M context`
- #60913 (open, 2.1.145) `sends literal claude-opus-4-7[1m] as model name on session resume, hits 404`

## 混淆名存活检查（2.1.183 cli.original.cjs）

clawgod 硬编码的旧混淆名在 2.1.183 **全部消失**（计数 0）：

| 旧名 | 2.1.183 计数 | 新名（推断） |
|---|---|---|
| `ST()` | 0 | `$M(){return SRr()&&!jNe()}` |
| `k9()` | 0 | `HAi(e)` |
| `qq()` | 0 | `Co(){if(!gb())return!1;return VU(mi()?.scopes)}` |
| `vq()` | 0 | `Ir()`（provider 判定，合并 vq/Dq） |
| `Dq()` | 0 | `Ir()` |
| `ivH()` | 0 | `M4e(e)`（1h cache TTL） |
| `FYH()` | 0 | `Xve()`（global cache scope） |
| `M86` | 0 | 改名（默认上下文变量） |
| `bH()` | 1（残留） | `st()`（env bool） |

这是 finding-04（系统性 false green）的根因证据。
