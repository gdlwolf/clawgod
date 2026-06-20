<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

---

# 强制规范入口(AI 必读)

本仓库是 **clawgod**(Claude Code 运行时补丁,让第三方 API 用户用全功能)。改 patch / 升级 Claude Code 前,**必须先读**以下 spec(违反会触发线上 false-green 事故):

- **`.trellis/spec/patch-engineering.md`** — 补丁写作铁律(禁硬编码 minified 名、必带 patchedMarker、第三方守卫模式、新增 patch checklist)
- **`.trellis/spec/upgrade-runbook.md`** — Claude Code 升级 6 步 SOP + 滚动混淆名映射表(ST→$M、qq→Co…)
- **`.trellis/spec/version-support.md`** — 版本支持姿态(targets latest / older best-effort)

## 三条最高优先级约束

1. **禁止硬编码 minified 标识符**(ST/qq/vq/k9/M86…),必须 `[\w$]+` 通配 + 稳定锚点。历史教训:2.1.183 改名导致 12 条补丁静默失效。
2. **每条 patch 必须有 `patchedMarker`**(防 false-green)。sentinel 只做 stale 辅助。
3. **改完 src/patch.mjs 必须三处同步**:install.sh heredoc、install.ps1 patcherCode(脚本见 upgrade-runbook.md Step 5)。

## 快速上下文

- 核心:`src/patch.mjs`(补丁定义,~50 条)、`src/cli.cjs`(wrapper,设 env + drift detection)、`install.sh`/`install.ps1`(内嵌上述两份)。
- 运行时:`~/.clawgod/cli.original.cjs`(被 patch 的 Claude Code 源码)、`~/.clawgod/patch.mjs`、`~/.clawgod/.source-version`。
- 验证:`node ~/.clawgod/patch.mjs --dry-run`(0 failed,且失配应报 stale/marker-absent 而非 "already applied")。
- clawgod 环境下 `grep` 若失效(bun 拦截),用 `/usr/bin/grep` 兜底(根因:`CLAUDE_CODE_EXECPATH`,已在 cli.cjs 修复)。

