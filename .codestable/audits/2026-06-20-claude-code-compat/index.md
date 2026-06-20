---
doc_type: audit-index
audit: 2026-06-20-claude-code-compat
scope: ClawGod patcher compatibility against Claude Code CLI 2.1.183
created: 2026-06-20
updated: 2026-06-20
status: active
total_findings: 6
---

# Claude Code 兼容性审计报告

## 范围

审计本机 `claude`/`clawgod` 版本、仓库 `src/patch.mjs` 与已安装 `~/.clawgod/patch.mjs` 一致性、已提取的 `~/.clawgod/cli.original.cjs`，以及 patcher 对 Claude Code `2.1.183` 的 dry-run 结果。本轮新增上游版本/changelog/GitHub issue 调研（第三方 API 缓存与智能效果维度）。

## 版本与命令证据

- `claude --version` / `clawgod --version` / `~/.clawgod/.source-version`：均为 `2.1.183`。
- `~/.local/share/claude/versions/`：`2.1.178, 2.1.179, 2.1.181, 2.1.183`。
- `diff src/patch.mjs ~/.clawgod/patch.mjs`：无差异，仓库与已安装 patcher 一致。
- `node ~/.clawgod/patch.mjs --dry-run`：`36 applied, 14 skipped, 0 failed`，唯一显式警告 `Disable outputFormat json_schema ... (0 matches, sentinel absent — cannot verify)`。
- **上游版本**：`npm view @anthropic-ai/claude-code version` = `2.1.183`；GitHub `anthropics/claude-code` 最新 release = `v2.1.183`（2026-06-19）。**上游最新 = 本地 = 2.1.183，无 2.1.184+ 待审。** 用户"升级多个版本"是相对 journal 记录的 2.1.150 而言。

## 总评

**ClawGod 需要升级，且问题比上一轮估计更系统化。** 2.1.183 对 minified 标识符做了大规模重命名（`ST→$M`、`k9→HAi`、`qq→Co`、`vq/Dq→Ir`、`ivH→M4e`、`FYH→Xve`、`M86 改名`、`bH→st`），clawgod 一批硬编码旧混淆名的 patch 正则全部不再命中；又因旧名在源码中彻底消失，dry-run sentinel 缺失被误判为 "already applied"。**已确认 8 个 false green**（上一轮 3 + 本轮 5），涵盖 firstParty 总开关、1h 缓存 TTL、全局缓存 scope、Advisor、1M 上下文等核心第三方限制解除。

**第三方缓存维度**（用户重点关注）：
- 1h cache TTL、global cache scope 两个 patch 均 false green → 第三方仍 5 分钟缓存、不跨会话。
- 好消息：`cch` billing-header nonce 破坏第三方前缀缓存的问题（issue #68900，2.1.177 报告）**已由上游在 2.1.181/2.1.183 修复**——源码确认第三方不再注入 `cch` nonce。clawgod 无需处理。

**第三方智能效果维度**（用户重点关注）：
- thinking/reasoning 本身无新增 provider gate（印证 changelog 2.1.166 "3P providers unchanged"）。
- 但默认发送 `thinking:{type:"adaptive"}` 对不兼容的第三方网关导致 400/挂起/空（issue #68551），clawgod 未覆盖。
- 第三方 auto-compact 自 v2.1.161 失效（issue #65585），clawgod `features.json` 漏 `tengu_sepia_moth` flag。

## 发现清单

| # | 性质 | 严重度 | 置信度 | 标题 | 文件 |
|---|---|---|---|---|---|
| 1 | bug | P1 | high | beta header 清理补丁在 2.1.183 false green | [finding-01.md](finding-01.md) |
| 2 | bug | P1 | high | outputFormat/json_schema 第三方 API 禁用补丁已过期 | [finding-02.md](finding-02.md) |
| 3 | bug | P1 | high | CLAUDE.md system prompt 注入补丁已不命中新版入口 | [finding-03.md](finding-03.md) |
| 4 | bug | P0 | high | 2.1.183 混淆名系统性重命名 → 批量第三方 patch false green | [finding-04.md](finding-04.md) |
| 5 | bug | P1 | high | 第三方 API auto-compact 仍失效（tengu_sepia_moth 未覆盖） | [finding-05.md](finding-05.md) |
| 6 | bug | P1 | high | 第三方默认发送 adaptive thinking → 网关 400/挂起/空 | [finding-06.md](finding-06.md) |

## 按维度分布

| 性质 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| bug | 1 | 5 | 0 | 6 |
| security | 0 | 0 | 0 | 0 |
| performance | 0 | 0 | 0 | 0 |
| maintainability | 0 | 0 | 0 | 0 |
| arch-drift | 0 | 0 | 0 | 0 |
| **合计** | **1** | **5** | **0** | **6** |

## 上游调研结论（详见 research/upstream-and-issues.md）

- **版本**：上游 npm + GitHub 最新均 2.1.183，本地已最新。
- **changelog 命中**：2.1.181 修复第三方 base URL 缓存（attestation token）；2.1.166 明确 3P thinking 不变；2.1.172/173 1M 上下文与 `[1m]` 标准化；2.1.175 `enforceAvailableModels`。
- **issue 命中**：#68900（cch 缓存，上游已修）、#68551（adaptive thinking，未修）、#65585（auto-compact，未修）、#68522（>200k 上下文，对应 M86 false green）。
- **无需行动项**：cch billing-header 缓存问题（上游 2.1.183 已修，第三方不注入 cch）。

## 下一步建议

- **P0 优先修（finding-04）**：系统性重写所有硬编码混淆名的 patch 正则为 `[\w$]+` 通配 + `validate()` 锚定；同时修复 sentinel 机制——改为检查 patched-marker 存在（`sentinelAbsence:true`），不能只检查旧源码片段消失。建议作为一个统一 issue 处理，而非逐条修。此修复会连带恢复 ST bypass、1h cache TTL、global cache scope、Advisor、1M 上下文。
- **P1 同批修（finding-01/02/03/05/06）**：finding-01/02/03 是 finding-04 的具体实例，随根因修复一并解决；finding-05 补 `tengu_sepia_moth:true`（先验证 features.json 注入路径）；finding-06 加第三方 adaptive thinking 守卫。
- **验证要求强化**：修复后禁止只看 `0 failed`；必须对 installed `cli.original.cjs` 逐条做 patched-marker 存在性检查，并针对第三方 base URL 场景实测缓存命中与 thinking 兼容。
- **已解决**：cch 缓存问题无需 clawgod 行动。
