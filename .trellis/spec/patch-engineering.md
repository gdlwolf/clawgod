# Patch Engineering — clawgod 补丁写作铁律(强制)

> 适用范围:对 `src/patch.mjs`(及 install.sh/install.ps1 内嵌副本)的任何修改。
> 强制等级:**MUST**。违反会被 trellis-check 拦截,且历史上每次违反都导致过线上事故(2.1.183 false-green)。

## 1. 版本定位

clawgod **targets the latest Claude Code**(见 version-support.md)。不为旧版本专门写兼容分支。但补丁写作方式(见下)天然让上游改名时大概率自适应——这是"降本手段",不是"兼容包袱"。

## 2. 禁止硬编码 minified 标识符(最高优先级)

Claude Code 每次发版几乎都会重命名 minified 标识符(函数名/参数名/变量名)。**硬编码这些名 = 下次发版必断**。

- ❌ 禁止:`function ST\(\)\{return w86\(\)\}`、`!qq\(\)`、`let H=`、`var M86=`、`bH\(process\.env\.X\)`
- ✅ 必须:函数名/参数名/变量名一律用 `[\w$]+` 通配捕获。
- ✅ 只允许硬锚定**稳定串**(跨版本不变):
  - provider 字面量:`firstParty` / `anthropicAws` / `gateway` / `foundry` / `bedrock` / `vertex`
  - GrowthBook flag 名:`tengu_xxx`(如 `tengu_sepia_moth`、`tengu_prompt_cache_1h_config`)
  - 环境变量名:`ANTHROPIC_BASE_URL` / `CLAUDE_CODE_*` / `ANTHROPIC_MODEL` 等
  - API 字面量:`anthropic.com` / `structured-outputs-2025-12-15` / `cache_control`
  - 模型名片段:`claude-3-` / `claude-opus-4-0` / `claude-sonnet-4-0`

```js
// ❌ 会断
pattern: /function ST\(\)\{return w86\(\)\}/g
// ✅ 自适应
pattern: /function ([\w$]+)\(\)\{return [\w$]+\(\)&&![\w$]+\(\)\}/g
```

## 3. 每条 patch 必须有 patchedMarker(防 false-green)

历史上 12 条补丁静默失效(false-green)的根因:sentinel 检查"旧源码片段消失",上游改名后旧片段也消失 → 误判"已应用"。

- 每条 patch 的 replacer 必须注入一个**唯一 marker**(注释或特殊串,如 `/*cg-xxx*/`)。
- 声明 `patchedMarker: '<marker>'`,引擎在 0-match 时检查 marker 是否存在:present=真已应用,absent=stale/上游改名(可见告警,而非静默误判)。
- sentinel 只用于辅助 stale 检测,不能单独作为"已应用"判据。

```js
{
  name: 'Bypass firstParty master switch',
  pattern: /function ([\w$]+)\(\)\{return [\w$]+\(\)&&![\w$]+\(\)\}/g,
  replacer: (m, fn) => `function ${fn}(){/*cg-st-bypass*/return!0}`,
  patchedMarker: '/*cg-st-bypass*/return!0',   // ← 必须
  sentinel: 'function ST(){return w86()}',      // 辅助,旧版未patch形态
  validate: (match, code) => { /* 多义时锚定上下文 */ },
}
```

## 4. 第三方守卫统一模式

凡是为"第三方 API 用户"解锁的功能(`ANTHROPIC_BASE_URL` 指向非 anthropic.com),守卫一律用同一 idiom,注入函数入口:

```js
if(process.env.ANTHROPIC_BASE_URL&&!/anthropic\.com/i.test(process.env.ANTHROPIC_BASE_URL))return <禁用值>;
```

- `<禁用值>`:该函数在第三方时应返回的值(如 `!1` 禁用某特性、`null` 不注册工具)。
- 必须保留官方模型用户的原有路径(守卫只对第三方生效)。
- 参考:`web_search` 禁用、`outputFormat` 禁用、`adaptive-thinking` 禁用 都是此模式。

## 5. 新增/修改 patch 的 checklist

- [ ] 选稳定锚点(flag 名/字面量/env 名),minified 名全用 `[\w$]+`。
- [ ] 写通配正则;若可能多义,加 `validate(match, code)` 用附近稳定串锚定。
- [ ] replacer 注入唯一 `/*cg-xxx-<功能>*/` marker。
- [ ] 声明 `patchedMarker`(必) + `sentinel`(辅)。
- [ ] **禁止** `code.indexOf(match[0])`(match 是字符串,`[0]` 取首字符 → 潜伏 bug)。用 `code.indexOf(match)`。
- [ ] `node src/patch.mjs --dry-run` 看是否真实 match(不是 "already applied")。
- [ ] **三处同步**:`src/patch.mjs` = install.sh heredoc = install.ps1 patcherCode(用同步脚本,见 upgrade-runbook.md)。
- [ ] `node --check ~/.clawgod/cli.original.cjs` 语法 OK。
- [ ] 干净 revert + repatch 验证 marker present。
- [ ] commit message 说明锚点选型理由。

## 6. 历史教训(必读)

- **2.1.183 false-green 事故**:12 条 patch 因硬编码 ST/qq/vq/k9/M86/bH/ivH/FYH + sentinel 不可靠,全部静默失效,dry-run 仍报 "already applied"。修复见 commit 914df90(patchedMarker 引擎 + 通配化)。**这是本规范第 2、3 条的直接来源,不可放松。**
- **validate match[0] bug**:`code.indexOf(match[0])` 取字符串首字符,定位到源码最前面,validate 永远误判。必须 `indexOf(match)`。
- **install 脚本内嵌不同步**:src/patch.mjs 改了但 install.sh/install.ps1 内嵌没跟 → 重新 install 回退到旧 patch。必须三处同步。
