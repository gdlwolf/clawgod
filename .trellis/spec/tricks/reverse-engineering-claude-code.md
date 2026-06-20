# 逆向 Claude Code 隐藏功能的方法

> 状态：初稿
> 创建：2026-05-28

## 目标

通过逆向 `cli.original.cjs`（混淆后的 JS，14.5MB）发现 Anthropic 隐藏的 CLI 功能及其门禁条件。

## 方法分类

### 方法一：从已知功能出发找同类（推荐）

Claude Code 的隐藏功能遵循高度一致的模式。找一个已知功能（如 `ultraplan`），搜它的关键词触发函数，然后找旁边的同类。

**具体步骤**：

```bash
# 1. 找已知功能的实现模式
rg 'ultraplan' cli.original.cjs
# → 找到 tL8(H){return _B6(H,"ultraplan")}

# 2. 找出 _B6 的所有调用 —— 每个参数都是一个关键词触发功能
rg '_B6\(H,"' cli.original.cjs
# → tL8(H,"ultraplan")
# → tA4(H,"ultrareview")
# → AB6(H,"ultrawork")    ← 发现隐藏功能
```

**原理**：混淆器将所有相关函数合并在一起，`_B6()` 的调用方不会分散。

### 方法二：搜所有 `CLAUDE_CODE_*` 环境变量

Anthropic 的环境变量命名规约是 `CLAUDE_CODE_<功能名>`。这是你最直接的发现入口。

```bash
rg 'CLAUDE_CODE_' cli.original.cjs | rg -v 'env\.CLAUDE_CODE_' | rg -o 'CLAUDE_CODE_\w+' | sort -u
```

列出所有被代码引用的 env var，逐一测试。

**已发现的有用变量**：
- `CLAUDE_CODE_WORKFLOWS` — ultrawork 门禁
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` — Agent Teams
- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` — 禁用 beta header
- `CLAUDE_CODE_APPEND_SYSTEM_PROMPT` — 追加 system prompt

### 方法三：搜 `tengu_*` 特征标志

所有 GrowthBook 功能开关都以 `tengu_` 开头。搜它们可以得到功能的完整清单。

```bash
rg -o 'tengu_\w+' cli.original.cjs | sort -u
```

结合 ClawGod 的 `features.json` 看哪些还没被覆盖。

### 方法四：搜 system prompt 中注入的文本

隐藏功能通常在 system prompt 中有对应文本。搜索含有关键词的字符串。

```bash
rg 'ultrawork\|ultraplan\|ultrathink\|workflow' cli.original.cjs
```

找到字符串后，往回追引用该字符串的代码路径，就能找到门禁函数。

### 方法五：搜门禁函数模式

隐藏功能通常有一个门禁函数，结构如下：

```javascript
function XX(){
  if(cached !== undefined) return cached;
  if(!uH(process.env.CLAUDE_CODE_XXX)) return false;
  return v$("tengu_xxx", true);
}
```

```bash
# 找所有门禁函数（检查 env var + 调用 v$ 的模式）
rg -B2 'uH\(process\.env\.CLAUDE_CODE' cli.original.cjs
```

## 常用逆向命令速查

```bash
# 找关键词触发功能
rg '_B6\(H,"' cli.original.cjs

# 找所有 CLAUDE_CODE_ 环境变量
rg -o 'CLAUDE_CODE_\w+' cli.original.cjs | sort -u

# 找所有 tengu_ 特征标志
rg -o 'tengu_\w+' cli.original.cjs | sort -u

# 找所有 inject 到 system prompt 的附件类型
rg 'ultra\w+_request:' cli.original.cjs

# 找门禁函数（env var + feature flag）
rg -B5 'uH\(process\.env\.CLAUDE_CODE' cli.original.cjs
```

## 注意事项

- `cli.original.cjs` 在 `~/.clawgod/` 下，ClawGod 已打补丁
- 混淆名（如 `_B6`、`tL8`、`AB6`）版本间可能变化，但相邻函数的位置关系通常不变
- 搜字符串（如 `"ultrawork"`）比搜混淆名更可靠，因为字符串常量不会被混淆
