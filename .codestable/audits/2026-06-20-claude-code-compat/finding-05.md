---
doc_type: audit-finding
audit: 2026-06-20-claude-code-compat
finding_id: bug-05
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 05：第三方 API auto-compact 仍失效（tengu_sepia_moth 未覆盖）

## 速答

Claude Code 自 v2.1.161 起把 auto-compact 门控在 GrowthBook flag `tengu_sepia_moth` 上，而 GrowthBook 对第三方 provider 不可用 → flag 返回默认 false → auto-compact 永不触发。clawgod 的 `features.json` 覆盖了 `tengu_moth_copse`/`tengu_umber_petrel`/`tengu_sepia_cormorant`，但**漏了 `tengu_sepia_moth`**，第三方用户长会话仍会撞上下文硬限崩溃。

## 关键证据

- GitHub issue **#65585**（open, regression, v2.1.161+）`Auto-compact stopped working for third-party API providers since v2.1.161`：逆向分析确认 GrowthBook 被 firstParty auth 门控 → `tengu_sepia_moth` 默认 false → `_Y8()=false` → auto-compact 永不触发。影响 Zhipu(glm)/Bedrock/Vertex/Foundry/任何 custom `ANTHROPIC_BASE_URL`。v2.1.150 正常。
- `~/.clawgod/cli.original.cjs`（2.1.183）auto-compact gate：
  ```js
  function X(){if(!S7())return!1;if(uG())return!1;if(!ct("tengu_sepia_moth",!1))return!1;return Ec("precomputeCompactionEnabled",!0).value}
  ```
  - `S7()`：`function S7(){if(st(process.env.CLAUDE_CODE_REMOTE)){...tengu_reactive_compact_remote...}return!0}` —— 仅 remote 模式检查，非 remote 不阻挡。
  - `uG()`：`function uG(){if(xr())return!1;return!!ct("tengu_amber_redwood3","")}` —— 默认 ""（falsy）不阻挡。
  - **`if(!ct("tengu_sepia_moth",!1))return!1`** —— `ct()` 是 GrowthBook flag resolver，默认 `!1=false`。第三方 GrowthBook 不可用 → 返回默认 false → `!false`... → `return!1` → auto-compact 禁用。
- `~/.clawgod/features.json` 当前覆盖的 tengu flags：`tengu_harbor, tengu_session_memory, tengu_amber_flint, tengu_auto_background_agents, tengu_destructive_command_warning, tengu_immediate_model_command, tengu_desktop_upsell, tengu_malort_pedway, tengu_amber_quartz_disabled, tengu_prompt_cache_1h_config, tengu_moth_copse, tengu_umber_petrel, tengu_sepia_cormorant, tengu_sedge_lantern, tengu_billiard_aviary`。
- **`tengu_sepia_moth` 不在列表中** → 未被 clawgod 覆盖。

## 影响

第三方 API 用户（含当前会话使用的 glm 系列）长会话上下文增长到模型硬限时不自动压缩，触发 "ran out of context" 紧急恢复而非优雅压缩。与 finding-04 的 1M 上下文 false green 叠加（上下文被限 200k + 不自动压缩），长会话稳定性显著下降。

## 修复方向

在 `~/.clawgod/features.json`（及生成它的 install 脚本）中新增 `"tengu_sepia_moth": true`。需先确认 clawgod 的 GrowthBook override 机制（`growthBookOverrides` patch + `CLAUDE_INTERNAL_FC_OVERRIDES`/features.json 注入路径）能让 `ct("tengu_sepia_moth")` 读到该覆盖值；若 `ct()` 对第三方走默认分支不读本地覆盖，则需额外 patch 强制该 flag 为 true。

## 建议动作

`cs-issue`，P1。先验证 features.json 注入路径对 `tengu_sepia_moth` 是否生效，再决定纯配置修复还是需 patch。
