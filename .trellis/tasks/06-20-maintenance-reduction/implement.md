# Implement — 维护成本降低执行计划

## 执行顺序(每步验完再下一步,分批 commit)

### Step 1 — R2 修 grep/EXECPATH bug ✅ done (27a8681)
- [x] wrapper 加 CLAUDE_CODE_EXECPATH → native binary(Linux/macOS/Windows)。
- [x] 同步 install.sh/install.ps1 内嵌 cli.cjs。
- [x] 实测 native binary 能当 ugrep(模拟 grep 函数调用)。
- 注:实际生效需用户下次启动 clawgod(新进程读新 env);当前会话 grep 仍旧 env 是预期。

### Step 2 — R1 删历史 optional 分支 ⏸ 留给用户下次(风险最高,需逐条判断)
- [ ] 读 patch.mjs,逐条评估 `optional: true` 条目(design D1 判据)。
- [ ] 删确定的历史分支;同步三处。
- [ ] 干净 repatch 2.1.183 + dry-run:0 failed、0 false-green、marker 全 present。
- commit: `chore(patch): drop legacy version-compat optional branches`
- 候选删除(注释含 "removed in vNx+" 或 "auto-bypass"):Computer Use subscription bypass、Computer Use gate bypass、Voice Mode enable、cI6/dI6 DISABLE_EXPERIMENTAL_BETAS、NI6 DISABLE_EXPERIMENTAL_BETAS、legacy Opus/Sonnet migration。
- 候选保留(仍有用,非纯兼容):Sub-agent model inherit、Remove "Not logged in" notice、Attachment filter bypass、Message list filter bypass。

### Step 3 — R3 清理无用文件 ✅ done (c6d6756)
- [x] 删 CHANGELOG.md、src/wiki/;src/.source-version 移出 git + .gitignore。
- [x] 顺手恢复 bypass.png(会话开始前被工作区删,README 要用,web/public 是软链指向它)。

### Step 4 — R3+R4 README 重写 ⏸ 留给用户下次(对外文案需过目)
- [ ] 重写 README.md/ZH/JP:版本支持措辞(targets latest/best-effort)、机制说明、删过时 patch 计数。
- commit: `docs: rewrite READMEs for 2.1.183 + version-support posture`
- 措辞参照 .trellis/spec/version-support.md。

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
