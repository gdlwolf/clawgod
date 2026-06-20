# Implement — 维护成本降低执行计划

## 执行顺序(每步验完再下一步,分批 commit)

### Step 1 — R2 修 grep/EXECPATH bug(最先做,因为后续探索都依赖 grep)
- [ ] 读 src/cli.cjs 现有 native binary 路径解析逻辑(drift detection 段)。
- [ ] 在 `require('./cli.original.cjs')` 前加 `CLAUDE_CODE_EXECPATH` 设置(Linux/macOS 用 versions/<latest>;Windows 分支查路径)。
- [ ] 同步 install.sh/install.ps1 内嵌 cli.cjs(如果有内嵌)。
- [ ] 实测:`grep -n SHELL src/cli.cjs` 在 clawgod 环境返回行号。
- [ ] commit: `fix(wrapper): point CLAUDE_CODE_EXECPATH at native binary (fix grep/ugrep)`

### Step 2 — R1 删历史 optional 分支
- [ ] 读 patch.mjs,逐条评估 `optional: true` 条目(design D1 判据)。
- [ ] 删确定的历史分支;同步 src/patch.mjs → install.sh heredoc → install.ps1 patcherCode(Python 同步脚本)。
- [ ] 干净 repatch 2.1.183 + dry-run:0 failed、0 false-green、marker 全 present。
- [ ] commit: `chore(patch): drop legacy version-compat optional branches`

### Step 3 — R3 清理无用文件(非 README)
- [ ] `git rm CHANGELOG.md`
- [ ] `git rm -r src/wiki/`
- [ ] `git rm --cached src/.source-version` + 加 .gitignore
- [ ] commit: `chore: remove stale CHANGELOG.md and src/wiki/; untrack .source-version`

### Step 4 — R3+R4 README 重写
- [ ] 重写 README.md(EN):版本支持措辞、机制说明、删过时 patch 计数。
- [ ] 重写 README_ZH.md、README_JP.md(结构一致)。
- [ ] commit: `docs: rewrite READMEs for 2.1.183 + version-support posture`

### Step 5 — R4 install 版本检测
- [ ] install.sh:读本地 native 版本,旧于最新则 echo 友好提示(非阻断)。
- [ ] install.ps1:同上。
- [ ] commit: `feat(install): friendly version-check notice for older Claude Code`

### Step 6 — R5 Trellis 规范
- [ ] 写 .trellis/spec/patch-engineering.md
- [ ] 写 .trellis/spec/upgrade-runbook.md(含混淆名映射表)
- [ ] 写 .trellis/spec/version-support.md
- [ ] AGENTS.md 顶部加强制入口
- [ ] 建 .trellis/workspace/gdl/patch-log.md(首条记录本次)
- [ ] commit: `docs(spec): add patch-engineering, upgrade-runbook, version-support + AGENTS.md entry`

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
