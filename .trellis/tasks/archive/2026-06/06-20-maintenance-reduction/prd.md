# 降低 clawgod 维护成本:自适应补丁 + 清理 + Trellis 治理

## Goal(目标价值,非技术)

让 clawgod 在 Claude Code 高频迭代、维护者跳版本升级的场景下,**维护成本最低**。用户升级 Claude Code(含跳版本)时,clawgod 尽量自动适应、无需维护者紧急发版;同时清掉历史包袱、修掉阻塞性 bug、建立可被新会话自动加载的维护规范。

## Confirmed Facts(已确认事实)

- Claude Code 上游迭代频繁(2026-05 到 2026-06 一个月内 2.1.150→2.1.183)。
- 每次升级 90% 的变更是 **minified 标识符改名**(ST→$M、qq→Co、vq/Dq→Ir、k9→HAi、M86→mxt、bH→st、ivH→M4e、FYH→Xve);功能逻辑、`firstParty`/`tengu_xxx`/env 名等稳定串不变。
- 上一轮 false-green 事故(12 条补丁静默失效)的根因是**硬编码 minified 名 + sentinel 不可靠**,已在 commit 914df90 用"通配 + patchedMarker"修好。
- clawgod wrapper(src/cli.cjs)覆盖了 `claude` 命令,导致 Claude Code 内置 `grep` shell 函数把 clawgod launcher 当 ugrep 调用,`grep` 全面失效(根因:`CLAUDE_CODE_EXECPATH` fallback 到 `/home/aaa/.local/bin/claude` = clawgod launcher,而 launcher 无 ugrep 能力)。
- `CHANGELOG.md` 停在 2.1.143/Patch#48,与实际严重脱节;`src/wiki/` 是旧 wiki 残留;`src/.source-version`(内容 2.1.143)是运行时产物却被 git 跟踪。
- `.trellis/spec/` 为空;`.trellis/workspace/gdl/journal-1.md` 仅 1 条记录;无任何 patch 写作/升级规范。
- README.md 第 24 行宣称 "works with any version",与"只锁当前版本"的现实有出入。
- web 站点(web/、index.html、CNAME、bypass.png、build.sh)仍在运营 clwadgod.0chen.cc,**保留**。

## Requirements(需求)

### R1. 自适应补丁(降本核心,代码层)
- 保留并巩固 914df90 的"通配 `[\w$]+` + patchedMarker"机制——不回退。
- 删除 patch.mjs 里所有为旧版本兼容而留的 `optional: true` 历史分支(纯清理)。
- 补丁只锚定稳定特征(minified 名用通配,字面量/flag 名/env 名硬锚定),使上游改名时 drift detection 自动重 patch、用户无感。

### R2. 修复 grep/CLAUDE_CODE_EXECPATH bug(用户点名)
- 在 wrapper(src/cli.cjs)把 `CLAUDE_CODE_EXECPATH` 指向真实 native Claude 二进制,使 Claude Code 内置 grep 函数调到对的二进制;Linux/macOS/Windows 三平台都要正确解析路径。
- 副作用已确认极小(EXECPATH 仅用于子进程 env 传递 + grep 函数,无决策逻辑读它)。

### R3. 整理无用文件
- 删 `CHANGELOG.md`(过期且与 git log 脱节)。
- 删 `src/wiki/`(旧 wiki 残留,已被 .codestable/.trellis 取代)。
- `src/.source-version` 移出 git(加 .gitignore)——它是运行时动态产物。
- 重写 `README.md` / `README_ZH.md` / `README_JP.md`:反映 2.1.183 现状 + 新机制 + 版本支持措辞。
- 保留:`LICENSE`、web 站点资产、bypass.png。

### R4. 版本支持姿态(产品层,非阻断)
- install.sh/install.ps1 检测本地 Claude Code 版本;若明显旧于 patch 目标版本,给**友好提示**(非阻断)"建议升级到最新 Claude Code"。
- README 措辞从 "works with any version" 改为 "targets the latest Claude Code; older versions may work but are not guaranteed"。
- compat-daily CI 语义保持(每日验证最新版兼容),不强行改为"告警"。

### R5. Trellis 维护规范(新会话可加载)
- `.trellis/spec/patch-engineering.md`(强制):patch 写作铁律——只锁最新版、禁硬编码 minified 名、必带 patchedMarker、第三方守卫统一模式、新增 patch checklist。
- `.trellis/spec/upgrade-runbook.md`(强制 SOP):上游发新版时的固定 6 步流程 + 滚动混淆名映射表。
- `.trellis/spec/version-support.md`(强制):版本支持声明(targets latest / best-effort older / not guaranteed)。
- `AGENTS.md` 顶部加强制入口:"改 patch/升级前必读 spec/patch-engineering.md + upgrade-runbook.md"。
- `.trellis/workspace/gdl/patch-log.md`(建议流水):每次升级的简短记录。

## Acceptance Criteria

- [ ] R1:patch.mjs 无 `optional: true` 旧版本分支;`node ~/.clawgod/patch.mjs --dry-run` 在干净 2.1.183 上 0 failed、无 false-green;install.sh/install.ps1 内嵌同步。
- [ ] R2:clawgod 环境下 `grep -n X file` 正常返回(不再触发 bun help);三平台路径解析正确(至少 Linux 实测通过)。
- [ ] R3:CHANGELOG.md、src/wiki/ 已删;src/.source-version 在 .gitignore 且不再 tracked;三份 README 重写完成。
- [ ] R4:install 脚本含版本检测+友好提示;README 含新版本支持措辞。
- [ ] R5:三份 spec 文件存在且非空;AGENTS.md 含强制入口;patch-log.md 建档。
- [ ] 全程分批 git commit,每个独立单元一个 commit,可精确回退;最终工作区干净。

## Out of Scope

- 不回退 911df90 通配化(那是降本基础)。
- 不强制阻断旧版用户(只提示)。
- 不重写 web 站点内容(只保留)。
- 不引入 YAML 规范格式(用 Markdown)。

## Open Questions

- 无(brainstorm 已收敛)。
