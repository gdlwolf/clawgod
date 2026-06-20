# Design — 维护成本降低

## 总策略

不谈"兼容/不兼容",只谈"上游改名(高频) vs 上游改逻辑(低频)"两类事件的成本。通配 + patchedMarker 把高频事件成本降到接近 0;清理历史分支降低心智负担;规范把经验固化成新会话可加载的硬约束。

## D1. 自适应补丁(R1)

### 保留(不回退)
- 914df90 的 `patchedMarker` 引擎 + 主循环安全网 + 12 条通配化 patch。
- adaptive-thinking guard、tengu_sepia_moth(auto-compact)。

### 删除(历史包袱)
- patch.mjs 里所有 `optional: true` 且注释含 "removed in v2.1.x+" 的条目——它们是为多版本兼容留的后路,通配已覆盖。逐条评估:
  - `Computer Use subscription bypass` (optional, v2.1.143+ auto-bypass) → 删
  - `Computer Use gate bypass` (optional) → 删
  - `Voice Mode enable` (optional, removed v2.1.143+) → 删
  - `cI6()/dI6() DISABLE_EXPERIMENTAL_BETAS gate` (optional) → 删
  - `NI6() DISABLE_EXPERIMENTAL_BETAS gate` (optional) → 删
  - `Sub-agent model inherit` (optional, sentinel 旧) → 评估保留(功能有用,非纯兼容分支)
  - `Remove "Not logged in" notice` (optional) → 评估
  - `Attachment filter bypass` / `Message list filter bypass (legacy/s_8)` (optional) → 评估
  - `Unlock legacy Opus/Sonnet migration` (optional, removed v2.1.160+) → 删
- 判据:注释明确"removed in vNx+"或"auto-bypass via X"的删;仍有实际功能且当前版本存在的留(install.sh/install.ps1 同步删)。

### 验证
- 干净 revert + repatch 2.1.183,dry-run 0 failed、0 false-green。
- 关键 marker grep 全 present。

## D2. grep/EXECPATH bug 修复(R2)

### 根因(已查证)
cli.original.cjs 的 `EnvironmentOverrides` 设 `CLAUDE_CODE_EXECPATH = process.execPath`;Claude Code 内置 grep 函数 fallback `_cc_bin=/home/aaa/.local/bin/claude`(=clawgod launcher),`exec -a ugrep "$_cc_bin" -G ...` → launcher 不认 `-G` → bun help + error。

### 修复
在 src/cli.cjs 的 `require('./cli.original.cjs')` **之前**设:
```js
process.env.CLAUDE_CODE_EXECPATH ??= <native claude binary path>;
```
native binary 路径解析(复用 drift detection 已有逻辑):
- Linux/macOS:`~/.local/share/claude/versions/<latest>`(readdir 取最大版本号,已在 cli.cjs drift 段实现)。
- Windows:npm 全局或 `~/.bun` 下的 native,需查 `process.platform === 'win32'` 分支(impl 阶段确认精确路径;若复杂则 Windows 暂用 `process.argv[0]` 兜底并加 TODO)。
- 若解析不到(无 native binary),不设(让默认 fallback 生效,行为同现状,不恶化)。

### 验证
- clawgod 环境跑 `grep -n SHELL src/cli.cjs` 返回行号(不再 bun help)。
- `type grep` 仍显示 Claude Code 函数,但调用结果正确。

## D3. 文件清理(R3)

| 操作 | 目标 | 注意 |
|---|---|---|
| `git rm` | CHANGELOG.md | 历史在 git log |
| `git rm -r` | src/wiki/ | 旧 wiki 残留 |
| `git rm --cached` + .gitignore | src/.source-version | 运行时产物 |
| 重写 | README.md / README_ZH.md / README_JP.md | 保留语言切换链接结构、install URL、badge;bypass.png 引用保留;措辞改"targets latest" |

README 重写要点:
- 版本支持措辞:"targets the latest Claude Code; older versions may work but are not guaranteed"。
- 机制说明:auto re-extract + re-patch on launch(drift detection);通配补丁自适应改名。
- 删掉过时的 patch 编号计数(如 "48 patches")——改成动态描述或移除。
- 三份语言保持结构一致(EN/ZH/JP)。

## D4. 版本检测(R4)

install.sh/install.ps1:在 patch 前,读本地 native binary 版本(已有 drift detection 逻辑可复用),与上游最新(npm view 或 GitHub release)比较。若本地版本 < patch 目标版本过多,echo 友好提示(非 exit):
```
[clawgod] Note: your Claude Code (2.1.170) is older than the latest. ClawGod targets the latest; older versions may work but are not guaranteed. Consider upgrading Claude Code.
```
不阻断 install(尽力而为)。

## D5. Trellis 规范(R5)

### .trellis/spec/patch-engineering.md(强制)
- 只锁最新版 Claude Code,不为旧版留兼容分支。
- **禁止硬编码 minified 标识符**:函数名/参数名/变量名用 `[\w$]+`,只硬锚定 `firstParty`/`anthropicAws`/`gateway`/`foundry`/`tengu_xxx`/env 名/`anthropic.com`/`structured-outputs-*` 等稳定串。
- **每条 patch 必须有 `patchedMarker`**(防 false-green);sentinel 只做 stale 预警。
- 第三方守卫统一:`if(process.env.ANTHROPIC_BASE_URL&&!/anthropic\.com/i.test(process.env.ANTHROPIC_BASE_URL))return <val>;`。
- 新增/改 patch checklist:选稳定锚点 → 写通配正则 → 加 validate(多义时) → 加 patchedMarker → dry-run 看 stale/marker → 三处同步(src/install.sh/install.ps1) → node --check → commit。
- 禁止 `code.indexOf(match[0])`(取首字符 bug),用 `indexOf(match)`。

### .trellis/spec/upgrade-runbook.md(强制 SOP)
上游发新版时的固定流程:
1. 确认上游最新(`npm view @anthropic-ai/claude-code version` + GitHub releases;**别信 npmmirror 等镜像滞后**)。
2. `node ~/.clawgod/repatch.mjs <新 native binary>` 重 extract + apply;`node ~/.clawgod/patch.mjs --dry-run` 看哪些报 stale/warn。
3. 对照**混淆名映射表**(见下,滚动更新)定位改名;用通配重写失配 patch + 加 marker。
4. 验证 patched marker present + `node --check`。
5. **三处同步**:`diff src/patch.mjs` vs install.sh heredoc vs install.ps1 patcherCode(用 Python 脚本,见 commit 914df90 经验)。
6. 干净 revert + repatch 验证 + commit。

**混淆名映射表**(滚动更新):
| 功能 | 2.1.142 | 2.1.143 | 2.1.160 | 2.1.183 |
|---|---|---|---|---|
| firstParty 总开关 | ST | ST | ST | $M |
| system prompt 注入 | k9 | k9 | k9 | HAi |
| OAuth scope 检查 | qq | qq | qq | Co |
| provider 判定 | vq/Dq | vq/Dq | vq/Dq | Ir(合并) |
| 1h cache TTL | ivH | ivH | ivH | M4e |
| global cache scope | FYH | FYH | FYH | Xve |
| 默认上下文变量 | M86 | M86 | M86 | mxt |
| env bool parse | bH | bH | bH | st / Ge.<env> |

### .trellis/spec/version-support.md(强制)
- Targets the latest Claude Code.
- Older versions: best-effort(通配大概率能用),not guaranteed,不发专门兼容分支。
- install 友好提示旧版用户升级,不阻断。
- drift detection + repatch.mjs 是版本切换机制;用户升 Claude Code 后下次启动自动重 patch。

### AGENTS.md 强制入口
顶部追加:
```
## 强制规范入口(AI 必读)
- 改 patch / 升级 Claude Code 前,必读:
  - .trellis/spec/patch-engineering.md(patch 写作铁律)
  - .trellis/spec/upgrade-runbook.md(升级 SOP + 混淆名映射表)
  - .trellis/spec/version-support.md(版本支持姿态)
```

### .trellis/workspace/gdl/patch-log.md(建议流水)
每次升级记录:日期、目标版本、踩的坑、新混淆名映射。

## 风险与回退

- R1 删 optional 分支:若删错(某条仍在当前版本有用),dry-run 会报 stale/marker absent 可见 → 精确恢复。git 可回退。
- R2 EXECPATH:若路径解析错(尤其 Windows),不设 env(兜底同现状),不恶化。
- R3 README 重写:保留旧版在 git 历史,可恢复。
- 分批 commit:每项一个 commit,出问题精确回退。

## 提交策略(用户要求"做好 git 防弄乱")

分批 commit,每个独立单元一个:
1. `fix(wrapper): point CLAUDE_CODE_EXECPATH at native binary (fix grep/ugrep)` — R2
2. `chore(patch): drop legacy version-compat optional branches` — R1
3. `chore: remove stale CHANGELOG.md and src/wiki/; untrack .source-version` — R3(部分)
4. `docs: rewrite READMEs for 2.1.183 + version-support posture` — R3(README)+ R4 措辞
5. `feat(install): friendly version-check notice for older Claude Code` — R4
6. `docs(spec): add patch-engineering, upgrade-runbook, version-support specs + AGENTS.md entry` — R5
