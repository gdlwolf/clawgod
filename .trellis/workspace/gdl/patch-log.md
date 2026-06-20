# Patch Log — clawgod 补丁维护流水

> 每次升级 Claude Code / 改 patch,在此追加一条简短记录。聚焦:目标版本、踩的坑、新发现的混淆名映射。
> 详细 SOP 见 `.trellis/spec/upgrade-runbook.md`;写作铁律见 `.trellis/spec/patch-engineering.md`。

---

## 2026-06-20 — 2.1.183 大修(patchedMarker 引擎 + 通配化)

**目标版本**:2.1.183(上游 npm + GitHub 最新 = 本地,无 2.1.184+)。

**起因**:2.1.183 大规模重命名 minified 标识符,12 条第三方补丁静默失效(false-green),dry-run 仍报 "already applied",实际第三方用户丢失 1h cache TTL、global cache scope、Advisor、1M 上下文、Send File、10MB image、auto-mode、MAX_CONTEXT_TOKENS、beta-header strip、outputFormat guard、CLAUDE.md 注入、ST firstParty 总开关。

**根因**:
1. 补丁硬编码旧混淆名(ST/qq/vq/k9/M86/bH/ivH/FYH),新版改名后正则失配。
2. sentinel 检查"旧源码片段消失",旧名消失后 sentinel 也消失 → 误判"已应用"。
3. `validate` 里 `code.indexOf(match[0])` 取字符串首字符(潜伏 bug),通配化后才暴露。

**修复**(commit 914df90):
- 引入 `patchedMarker` 机制:0-match 检查注入 marker 是否存在(present=已应用,absent=stale/改名),彻底防 false-green。
- 主循环加安全网:matches>0 但 marker 已 present 则跳过(防前缀匹配型 patch 重复注入)。
- 12 条补丁全部 `[\w$]+` 通配化 + 稳定锚点 + 唯一 marker。
- 新增 adaptive-thinking 第三方守卫(issue #68551:网关 400/挂起)。
- features.json 加 `tengu_sepia_moth:true`(issue #65585:第三方 auto-compact)。
- 修 validate `match[0]` bug。

**新混淆名映射**(详见 upgrade-runbook.md 表):ST→$M、k9→HAi、qq→Co、vq/Dq→Ir、ivH→M4e、FYH→Xve、M86→mxt、bH→st/Ge.属性。

**坑**:
- npmmirror 镜像滞后,`npm view` 版本落后,以 GitHub releases 为准。
- `.bak` 是最早原始(2.1.142),`--revert` 后必须 repatch 重新 extract 当前版本。
- install.sh/install.ps1 内嵌 patch.mjs,改 src 必须三处同步(Python 脚本)。
- sub-agent 在第三方 API 环境 `1211 模型不存在`,升级调研主会话自己做。

## 2026-06-20 — grep/CLAUDE_CODE_EXECPATH 修复(commit 27a8681)

**现象**:clawgod 环境下 `grep` 全部失效,报 bun "error: Invalid Argument '-G'"。

**根因**:Claude Code 内置 grep shell 函数 `exec -a ugrep "$CLAUDE_CODE_EXECPATH" -G ...`,env fallback 到 `$(command -v claude)` = clawgod launcher(bun,无 ugrep 能力)。

**修复**:wrapper(cli.cjs)把 `CLAUDE_CODE_EXECPATH` 指向真实 native binary(`~/.local/share/claude/versions/<latest>`)。实测 native binary 能正确响应 ugrep 调用。

## 2026-06-20 — 维护成本降低治理(commit c6d6756 + 本批)

**清理**:删 CHANGELOG.md(停 2.1.143)、删 src/wiki/(旧 wiki 残留)、src/.source-version 移出 git(死残留,运行时用 ~/.clawgod/.source-version)。

**姿态调整**:确立 "targets latest / older best-effort" 版本支持姿态(version-support.md),放弃 "works with any version" 旧承诺。补丁保持通配自适应(降本,非兼容包袱)。

**规范建立**:.trellis/spec/ 三份(patch-engineering / upgrade-runbook / version-support)+ AGENTS.md 强制入口 + 本 patch-log。
