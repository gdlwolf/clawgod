# Implement — 维护成本降低执行计划

## 执行顺序(每步验完再下一步,分批 commit)

### Step 1 — R2 修 grep/EXECPATH bug ✅ done (27a8681)
- [x] wrapper 加 CLAUDE_CODE_EXECPATH → native binary(Linux/macOS/Windows)。
- [x] 同步 install.sh/install.ps1 内嵌 cli.cjs。
- [x] 实测 native binary 能当 ugrep(模拟 grep 函数调用)。
- 注:实际生效需用户下次启动 clawgod(新进程读新 env);当前会话 grep 仍旧 env 是预期。

### Step 2 — R1 删历史 optional 分支 ❌ 取消(决定保留)
- **决定:不删**。`optional: true` 旧分支在新版本里 0 匹配会自动 skip(dry-run 显示 `not present in this version`),不打扰、不出错、不需维护。删它们的判断成本和风险(可能误删仍有效的)远高于保留成本。
- 这与"targets latest,不为旧版写新分支"策略一致:不为旧版**新增**投入,但已存在的旧分支让它**自废弃**,不主动删除。
- 未来若某条 optional 分支确认 100% 无用且碍事,再单独评估删除,不做批量清理。

### Step 3 — R3 清理无用文件 ✅ done (c6d6756)
- [x] 删 CHANGELOG.md、src/wiki/;src/.source-version 移出 git + .gitignore。
- [x] 顺手恢复 bypass.png(会话开始前被工作区删,README 要用,web/public 是软链指向它)。

### Step 4 — R3+R4 README 重写 ✅ done (c56a090)
- [x] 决定:只要 ZH 一份 README.md(不要 EN/JP),定位为 AI 维护者先读的项目导览。
- [x] 重写 README.md:顶部"AI 维护者必读 → AGENTS.md + spec"指针、人类快速开始、机制说明、版本支持姿态;删过时 patch 计数(23/24+)。
- [x] 删 README_ZH.md / README_JP.md(ZH README 已是 canonical,仅任务文档引用过,web 用绝对 URL 不受影响)。

## 完成标志 ✅
- 6 个 Step 全部完成(Step 2 按决定取消,保留 optional 分支自废弃)。
- 每个 Step 独立 commit,工作区干净。
- 新会话进项目:AGENTS.md + spec 自动指引 patch 维护;README 是项目导览。
- 唯一未落地:grep 修复需用户重启 clawgod 生效(当前会话 env 已定)。

### Step 5 — R4 install 版本姿态告知 ✅ done (038b9b1)
- [x] install.sh/install.ps1 末尾加 "targets LATEST, older best-effort" 告知(替代复杂版本检测,best-effort 姿态下不该阻断)。

### Step 6 — R5 Trellis 规范 ✅ done (9b1dc6c + e358157)
- [x] .trellis/spec/patch-engineering.md、upgrade-runbook.md(含混淆名映射表)、version-support.md。
- [x] AGENTS.md TRELLIS:END 之后加强制入口 + 三条最高优先级约束。
- [x] .trellis/workspace/gdl/patch-log.md(首条记录本次)。
- [x] 移除 Trellis 框架无关模板(backend/frontend/guides),只保留 patch 相关 spec + tricks。

## 验证命令(每步通用)
- `node ~/.clawgod/patch.mjs --dry-run`(0 failed)
- `node --check ~/.clawgod/cli.original.cjs`
- `grep -n <marker> ~/.clawgod/cli.original.cjs`(grep 修复后才能用)
- `diff src/patch.mjs` vs install.sh/install.ps1 内嵌(Python 脚本)
- `git status` 每步确认范围

## 回退点
- 每步独立 commit → `git revert <sha>` 精确回退。
- Step 2 删错 optional:dry-run 报 stale 可见,单独恢复该条。
- cli.original.cjs 被改坏:`node ~/.clawgod/patch.mjs --revert`(从 .bak)。

## 完成标志
- 6 个 commit 全部落地。
- R1-R5 全部 acceptance 打勾。
- 工作区干净(只剩无关 untracked)。
- 新会话进项目能通过 AGENTS.md/spec 自动获知 patch 规范。
