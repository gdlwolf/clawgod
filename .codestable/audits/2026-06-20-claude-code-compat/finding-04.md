---
doc_type: audit-finding
audit: 2026-06-20-claude-code-compat
finding_id: bug-04
nature: bug
severity: P0
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 04：2.1.183 混淆名系统性重命名 → 批量第三方 patch false green

## 速答

Claude Code 2.1.183 对 minified 标识符做了大规模重命名，clawgod 一批硬编码旧混淆名（`ST/k9/qq/vq/Dq/ivH/FYH/M86/bH`）的补丁正则全部不再命中；又因为这些旧名在源码中彻底消失，dry-run 的 sentinel 缺失被误判为 "already applied"。结果是**多个核心第三方限制解除补丁静默失效**，包括 firstParty 总开关 ST()、1h 缓存 TTL、全局缓存 scope、Advisor、1M 上下文窗口。

## 根因证据

`~/.clawgod/cli.original.cjs`（v2.1.183）混淆名存活检查（`grep -c 'function X('`）：

| 旧名 | 计数 | 2.1.183 实际 |
|---|---|---|
| `function ST(` | 0 | `function $M(){return SRr()&&!jNe()}` |
| `function k9(` | 0 | `function HAi(e){...}`（见 finding-03） |
| `function qq(` | 0 | `function Co(){if(!gb())return!1;return VU(mi()?.scopes)}` |
| `function vq(` / `function Dq(` | 0 / 0 | `function Ir(){...CLAUDE_CODE_USE_BEDROCK?"bedrock":...}` |
| `function ivH(` | 0 | `function M4e(e){...}` |
| `function FYH(` | 0 | `function Xve(){...}` |
| `M86` 标识符 | 0 | 默认上下文变量改名 |

## 确认 false green 的 patch（本轮新发现，均有源码证据）

1. **Bypass ST() firstParty gate**（`src/patch.mjs:185-189`）
   - 正则 `function ST\(\)\{return [\w$]+\(\)\}` 硬编码 `ST`；2.1.183 是 `$M(){return SRr()&&!jNe()}`，不匹配。
   - sentinel `function ST(){return w86()}` absent → dry-run 误报 "already applied, sentinel absent"。
   - 影响：`$M()` 是 firstParty 总开关，Advisor、global cache scope（`Xve` 内 `if(!$M())return!1`）、thinking display（`As=Is&&$M()&&hxt(u)`）都依赖它。失效波及面最大。

2. **Unlock 1h cache TTL**（`src/patch.mjs:524-534`）
   - 正则 `if\(!qq\(\)\|\|[\w$]+\.isUsingOverage\)return!1;` 硬编码 `qq`；2.1.183 是 `if(!Co()||Ix.isUsingOverage)return!1;`，不匹配。
   - patched marker `/* patched: bypass auth check for 1h cache */` 计数 0（未注入）。
   - 源码 `M4e(e)`：`if(!Co()||Ix.isUsingOverage)return!1;...` —— `Co()`=OAuth scope 检查，第三方 API key 用户 `Co()=false` → `return!1` → 1h cache 被禁。
   - 调用点证实：`let k=M4e(e.querySource)?"1h":void 0` → 第三方 k=void → 仅 5 分钟缓存 TTL。
   - sentinel `!qq()||bZ.isUsingOverage)return!1;` absent → 误报已应用。

3. **Unlock global cache scope**（`src/patch.mjs:547-551`）
   - 正则 `...let H=([\w$]+)\(\);return H==="firstParty"\|\|H==="anthropicAws"\}` 硬编码 `let H=`；2.1.183 是 `function Xve(){if(!$M())return!1;if(!Pu())return!1;let e=Ir();return e==="firstParty"||e==="anthropicAws"}`，用 `let e=`，不匹配。
   - sentinel `H==="firstParty"||H==="anthropicAws"}` absent（用 `e`）→ 误报已应用。
   - 影响：第三方缓存 scope 仍为 local，不跨会话持久化。

4. **Enable Advisor tool**（`src/patch.mjs:445-449`）
   - 正则 `if\(bH\(process\.env\.CLAUDE_CODE_DISABLE_ADVISOR_TOOL\)\)return!1;if\(vq\(\)!=="firstParty"\|\|!([\w$]+)\(\)\)return!1;` 硬编码 `bH(`/`vq()`；2.1.183 是 `if(st(process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL))return!1;if(Ir()!=="firstParty"||!$M())return!1;`，不匹配。
   - sentinel `DISABLE_ADVISOR_TOOL))return!1;if(vq()!=="firstParty"` absent → 误报已应用。

5. **Raise default context window 200k→1M**（`src/patch.mjs:492-496`）
   - 正则 `var M86=200000` 硬编码 `M86`；2.1.183 中 `M86` 标识符计数 0（改名），不匹配。
   - sentinel `var M86=200000` absent → 误报已应用。
   - 影响：第三方模型上下文窗口回到 200k（对应 issue #68522）。

## 与上一轮 finding 的关系

上一轮 finding-01（beta header `parse(H,$)`→`parse(e,t)`）、finding-02（outputFormat `GNe` 形态）、finding-03（`k9`→`HAi`）同属此根因。**合计 8 个确认 false green**，根因统一为 2.1.183 混淆名重命名 + 硬编码 patch 正则。

## 待验证（疑似同因，未逐一确认源码）

`Auto-mode unlock`（sentinel `AUTO_MODE)}function aM$`）、`Fast Mode`（`vq()!=="firstParty"`）、`Send User File`（`vq()!=="firstParty"||`）、`10MB image`（`vq()==="firstParty"&&`）、`Auto Mode`（`if(X()!=="firstParty")return rQ=Ha(!1)`）等凡是硬编码 `vq/Dq/qq/bH/ST` 的 patch 均疑似失效；使用 `[\w$]+` 通配的 patch（USER_TYPE、GrowthBook、pY、web_search、Channels、auto-memory）需逐个复核 sentinel 是否仍可靠。

## 影响

clawgod 在 2.1.183 上，多个第三方限制解除补丁静默失效，dry-run 汇总行 `36 applied, 0 failed` 掩盖了问题。第三方 API 用户实际仍受：firstParty 总开关门控（Advisor/cache scope/thinking display）、5 分钟缓存 TTL、local-only 缓存 scope、200k 上下文窗口限制。

## 修复方向

1. **根因修复**：把所有硬编码混淆名（`ST/k9/qq/vq/Dq/ivH/FYH/M86/bH` 及具体变量名 `H/$/e/t`）的 patch 正则改为 `[\w$]+` 通配 + `validate()` 上下文锚定（像 `web_search`、`auto-memory` patch 那样）。
2. **sentinel 机制修复**：sentinel 不能只检查"旧源码片段消失"——对 false green 无防护。应改为检查"patched marker 存在"（`sentinelAbsence: true` 模式），或对每条 patch 增加 patched-marker 断言。
3. 修复后必须对 installed `cli.original.cjs` 做 marker 检查，不能只看 dry-run `0 failed`。

## 建议动作

`cs-issue`，P0。这是系统性退化，影响 clawgod 核心价值（第三方限制解除）。建议作为一个统一 issue 重写所有硬编码 patch，而非逐条修。
