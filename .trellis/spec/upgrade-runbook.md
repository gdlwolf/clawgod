# Upgrade Runbook — Claude Code 升级操作手册(强制 SOP)

> 触发:Claude Code 上游发了新版本(本地 `claude --version` 或 npm/GitHub 有更新)。
> 强制等级:**MUST follow step-by-step**。跳步是历次事故的根因。

## 总原则

上游每次发版,**90% 的变更是 minified 标识符改名**。通配补丁(patch-engineering.md)让大部分改名**自动适应、用户无感**。本 SOP 处理的是"通配也没接住"的部分——通常是上游改了功能逻辑(低频)或锚点串本身变了。

## 6 步固定流程

### Step 1:确认上游最新版本
- `npm view @anthropic-ai/claude-code version`(注意:**别信 npmmirror 等国内镜像,有滞后**;以 npm 官方 + GitHub releases 为准)。
- GitHub `anthropics/claude-code` 的 `list_releases` 取最新 tag。
- 记录:最新版本号、本地版本号、changelog 关键条目(尤其 caching/thinking/provider/model 相关)。

### Step 2:重 extract + apply,dry-run 看哪些挂了
```bash
# 用新 native binary 重 extract + apply 当前 patch
node ~/.clawgod/repatch.mjs ~/.local/share/claude/versions/<新版本>
# dry-run 看 stale/warn
node ~/.clawgod/patch.mjs --dry-run
```
- 关注两类输出:
  - `❌ ... regex stale, sentinel still in source` → 上游改了,正则没 match 上,但目标还在(改 pattern)。
  - `⚠️ ... marker+sentinel absent — upstream renamed/removed` → 上游把目标整个移走/重写(重新定位)。

### Step 3:对照混淆名映射表定位改名
查本文件末尾的**混淆名映射表**(滚动更新)。若发现新改名,先在 cli.original.cjs 里 grep 定位新名:
```bash
# 注意:clawgod 环境下 grep 可能仍受 EXECPATH 影响,用 /usr/bin/grep 兜底
/usr/bin/grep -oP '.{0,40}<稳定串>.{0,120}' ~/.clawgod/cli.original.cjs
```
稳定串(flag 名/`firstParty`/env 名)是不变的,用它锚定找到改名后的函数。

### Step 4:用通配重写失配 patch + 加 marker
- 按 patch-engineering.md 第 2、3 条:通配 minified 名 + 稳定锚点 + patchedMarker。
- validate 锚定上下文(避免多义)。

### Step 5:验证 + 三处同步
- `node ~/.clawgod/patch.mjs --dry-run`:0 failed,失配的报真实 match(非 "already applied")。
- marker grep:每条改的 patch 的 `/*cg-xxx*/` 在 patched cli.original.cjs 里 present。
- `node --check ~/.clawgod/cli.original.cjs`。
- **三处同步**(src/patch.mjs = install.sh = install.ps1):
  ```bash
  python3 -c "
  import re
  src = open('src/patch.mjs').read()
  if not src.endswith('\n'): src += '\n'
  for f, pat in [('install.sh', r\"(cat > \\\"[^\\\"]*patch\\.mjs\\\" << 'PATCHER_EOF'\n).*?(PATCHER_EOF)\"),
                 ('install.ps1', r\"(\$patcherCode = @'\n).*?(\n'@)\")]:
      t = open(f).read()
      t2, n = re.subn(pat, lambda m: m.group(1)+src+m.group(2), t, flags=re.DOTALL)
      assert n==1, f'{f} sync failed'
      open(f,'w').write(t2)
  print('synced')
  "
  ```

### Step 6:干净重建 + commit
```bash
node ~/.clawgod/patch.mjs --revert          # 回 .bak(注意 .bak 是最早原始,版本可能旧)
node ~/.clawgod/repatch.mjs <新 native>     # 从新版重新 extract+apply
node ~/.clowgod/patch.mjs --dry-run         # 0 failed,全 marker present/already applied
```
- 更新本文件末尾的**混淆名映射表**(加新列)。
- 更新 `.trellis/workspace/gdl/patch-log.md`(加一条记录)。
- commit:`fix(patch): <新版本> compat — <改了什么>`。

## 混淆名映射表(滚动更新)

每次升级若有改名,**必须在此表加一列**。这是下次升级的定位地图。

| 功能 | 2.1.142 | 2.1.143 | 2.1.160 | 2.1.183 | 锚定稳定串 |
|---|---|---|---|---|---|
| firstParty 总开关 | ST | ST | ST | $M | `function X(){return Y()&&!Z()}` + 紧邻 cache-scope 调用 |
| system prompt 注入入口 | k9 | k9 | k9 | HAi | `.cli.systemPrompt` / `.cli.appendSystemPrompt` |
| OAuth scope 检查 | qq | qq | qq | Co | `function X(){if(!Y())return!1;return VU(Z()?.scopes)}` |
| provider 判定 | vq / Dq | vq / Dq | vq / Dq | Ir(合并) | `CLAUDE_CODE_USE_BEDROCK` |
| 1h cache TTL 决策 | ivH | ivH | ivH | M4e | `tengu_prompt_cache_1h_config` + `isUsingOverage` |
| global cache scope | FYH | FYH | FYH | Xve | `==="firstParty"\|\|==="anthropicAws"` 返回 |
| 默认上下文变量 | M86 | M86 | M86 | mxt | `var X=200000` + gti() 返回 |
| env bool parse | bH | bH | bH | st / Ge.属性 | `process.env.X` 包裹 |
| outputFormat 能力 | — | X(H){let $} | X(H){let $} | GNe(e){let t,n} | `claude-3-`+`claude-opus-4-0`+`claude-sonnet-4-0`+`return!0}` |
| messages beta header | parse(H,$) | parse(H,$) | parse(H,$) | parse(e,t) | `structured-outputs-2025-12-15` + `this.create` |
| adaptive thinking 开关 | — | — | — | vse | `MAX_THINKING_TOKENS` + `alwaysThinkingEnabled` |

## 常见坑(滚动更新)

- **npmmirror 镜像滞后**:`npm view` 走镜像可能版本落后。以 npm 官方/GitHub 为准。
- **`.bak` 是最早原始**:`patch.mjs --revert` 回到 install 时第一个 .bak(版本可能很旧,如 2.1.142)。revert 后必须 repatch 重新 extract 当前版本,别以为 revert 出来就是当前版本。
- **sub-agent 在第三方 API 环境可能不可用**(`1211 模型不存在`):升级调研若派 sub-agent 失败,主会话用 GitHub MCP + grep 自己做。
- **install 脚本内嵌 patch.mjs**:src/patch.mjs 改了必须同步 install.sh/install.ps1,否则重新 install 回退。
- **CHANGELOG.md 已删**:不要再建,变更记录靠 git log + 本 runbook + patch-log.md。
