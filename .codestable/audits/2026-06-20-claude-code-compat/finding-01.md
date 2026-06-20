---
doc_type: audit-finding
audit: 2026-06-20-claude-code-compat
finding_id: bug-01
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 01：beta header 清理补丁在 2.1.183 false green

## 速答

`Strip all beta headers in messages API when DISABLE_EXPERIMENTAL_BETAS=1` 在 Claude Code `2.1.183` 没有真正应用；dry-run 把 sentinel 缺失误判成已应用，但源码仍会无条件发送 `structured-outputs-2025-12-15` beta header。

## 关键证据

- `src/patch.mjs:224` — patch 名称是 `Strip all beta headers in messages API when DISABLE_EXPERIMENTAL_BETAS=1`，目标是当 `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` 时清空 messages API beta header。
- `src/patch.mjs:225` — 正则硬编码 `parse(H,$)`、`H.betas`、`$?.headers` 和 `this.create(H,$).then(`，依赖旧版混淆参数名。
- `src/patch.mjs:226` — replacement 预期插入 `_betas=process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS?...`。
- `src/patch.mjs:227` — sentinel 也硬编码旧版 `$` / `H` 形态，导致新版参数名变化时 sentinel 缺失会被误判为“already applied”。
- `~/.clawgod/cli.original.cjs:42` — 2.1.183 实际源码是 `parse(e,t){return t={...t,headers:Ss([{"anthropic-beta":[...e.betas??[],"structured-outputs-2025-12-15"].toString()},t?.headers])},this.create(e,t).then(...)}`，仍无条件加入 `structured-outputs-2025-12-15`。
- `~/.clawgod/cli.original.cjs` 全文搜索 `_betas=process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` 返回 `-1`，说明目标 marker 不存在。
- 本次对 installed source 的 regex 检查：旧 exact regex 命中 `0`，参数名放宽后的 beta regex 命中 `1`。

## 影响

第三方 API 用户即使通过 wrapper 设置了 `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`，`messages.parse()` 路径仍可能带上 `structured-outputs-2025-12-15` beta header。对不识别 Anthropic beta header 的第三方 API，这会继续触发 400 或兼容性错误。更严重的是 dry-run 输出显示该 patch “already applied”，维护者容易误以为旧修复仍有效。

## 修复方向

把该 patch 的正则和 sentinel 改成不依赖具体混淆参数名，并让 sentinel 检查验证 replacement marker 是否存在，而不是只检查旧源码片段是否消失。

## 建议动作

`cs-issue`，因为这是已确认的行为性 bug，修复范围应集中在 `src/patch.mjs` 的 pattern / replacer / sentinel，并需要重新跑 installed dry-run 与 marker 检查。
