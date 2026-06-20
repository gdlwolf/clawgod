# ClawGod

[![Latest](https://img.shields.io/github/v/release/gdlwolf/clawgod?style=flat&label=Latest)](https://github.com/gdlwolf/clawgod/releases/latest)
[![Compat](https://img.shields.io/github/actions/workflow/status/gdlwolf/clawgod/compat-daily.yml?branch=main&style=flat&label=Compat)](https://github.com/gdlwolf/clawgod/actions/workflows/compat-daily.yml)
[![Claude tested](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/gdlwolf/clawgod/badges/claude-version.json&style=flat)](https://github.com/gdlwolf/clawgod/actions/workflows/compat-daily.yml)

> 给 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 的运行时补丁 —— 让第三方 API(非官方 Anthropic 端点)用户也能用全部功能。

**ClawGod 不是第三方客户端**,而是覆盖在官方 Claude Code 之上的运行时补丁。它只针对**最新版** Claude Code;旧版本**尽力而为**(补丁匹配稳定特征而非版本专属名,大概率能用),但不保证。Claude Code 升级时,ClawGod 在下次启动自动重新 extract + 重新打补丁。

> **AI 维护者必读**:改动补丁 / 升级 Claude Code 前,先读 [AGENTS.md](AGENTS.md) 顶部强制入口 + `.trellis/spec/`(patch-engineering / upgrade-runbook / version-support)。本项目维护规范沉淀在那里,不是在本 README。

---

## 快速开始(人类用户)

### 前置依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| **Claude Code**(native binary) | ClawGod 补的是官方 Bun 独立二进制 | [`claude.ai/install.sh`](https://claude.ai/install.sh)(macOS/Linux)/ [`claude.ai/install.ps1`](https://claude.ai/install.ps1)(Windows) |
| **ripgrep** | Claude Code 的 Grep 工具依赖 | `brew install ripgrep` / `apt install ripgrep` / `winget install BurntSushi.ripgrep.MSVC` |
| **Node.js ≥ 18** | 补丁器运行时 | [nodejs.org](https://nodejs.org) |
| **Bun** | 补丁后 cli.js 的运行时;缺失自动装 | [bun.sh](https://bun.sh),`bun upgrade --canary` 跟随上游 |

### 安装

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/gdlwolf/clawgod/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/gdlwolf/clawgod/main/install.ps1 | iex
```

绿色 logo = 已打补丁。橙色 logo = 原版。

![ClawGod Patched](bypass.png)

### 命令

```bash
claude              # 已打补丁的 Claude Code(替换官方 launcher)
clawgod             # 同上,显式且 guaranteed 的入口(Windows 上 claude.exe 可能遮蔽 claude.cmd)
claude.orig         # 原版未打补丁(自动备份)
```

### 配置第三方 API

`~/.clawgod/provider.json` 首次运行自动创建。设 `apiKey` 可跳过 OAuth,指向任意 Anthropic 兼容端点:

```json
{
  "apiKey": "sk-ant-...",
  "baseURL": "https://api.anthropic.com",
  "model": "",
  "smallModel": "",
  "timeoutMs": 3000000
}
```

- **`apiKey` 已设** → 注入为 `ANTHROPIC_API_KEY`,与 `~/.claude/settings.json` 隔离。支持 Anthropic / DeepSeek / OpenAI 兼容网关。非 Anthropic 的 `baseURL` 会同时设 `ANTHROPIC_AUTH_TOKEN`(网关鉴权)。
- **`apiKey` 为空** → 走 OAuth,`claude auth login` 一次;`~/.claude` 继续托管 subagents/skills/MCP。

### 更新 / 卸载

直接 `claude update` 即可(已补丁为走 ClawGod 自己的 installer,一步拉最新 + 重打补丁)。卸载:`bash ~/.clawgod/install.sh --uninstall`。

---

## 它做了什么

ClawGod 用正则补丁解锁官方 Claude Code 对"非 firstParty 用户"的功能限制,主要类别:

- **内部用户模式** (`USER_TYPE="ant"`):解锁隐藏命令、调试日志、GrowthBook 覆盖。
- **firstParty 门禁解除**:`ST()/$M()` 总开关、Advisor、Channels、Auto Mode、Fast Mode、Send User File、10MB image、1M 上下文等,让第三方 API 用户也能用。
- **第三方 API 缓存/智能优化**:1h prompt cache TTL、global cache scope、auto-memory、移除 adaptive thinking(避免网关 400)。
- **限制移除**:CYBER_RISK_INSTRUCTION、URL 限制、cautious actions 等指令。
- **视觉**:品牌色 → 绿色(一眼区分已打补丁)。

完整补丁清单见 [`src/patch.mjs`](src/patch.mjs)(每条补丁带注释说明目标与机制)。

---

## 工作原理(简版)

1. 从 `~/.local/share/claude/versions/<version>` 定位官方 native Bun 二进制。
2. 从 `__BUN` 段 extract 内嵌 `cli.js` 源码 + `.node` 原生模块到 `~/.clawgod/vendor/`。
3. 用 `~/.clawgod/patch.mjs` 对 cli.js 施加正则补丁(版本无关,匹配稳定特征)。
4. `claude`/`clawgod` launcher(`~/.clawgod/cli.cjs`)在 Bun 运行时下跑补丁后的 cli.js,并设第三方 API 环境变量 + drift detection。
5. 每次启动,wrapper 比对 `~/.clawgod/.source-version` 与本地最新 native 版本;用户升级 Claude Code 后自动 re-patch。

> v2.1.113+ npm 包不再直接含 cli.js,而是 dispatch 到平台专属 Bun 独立二进制 —— ClawGod 适配这一形态。

---

## 版本支持姿态

- **Targets the latest Claude Code**:全力支持。
- **Older versions**:best-effort(通配补丁大概率自适应),不保证、不发专门兼容分支。
- **升级跳版本**:drift detection + repatch 自动处理,通常无需手动干预。

详见 [`.trellis/spec/version-support.md`](.trellis/spec/version-support.md)。

## License

GPL-3.0 — 与 Anthropic 无关,风险自负。

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=gdlwolf/clawgod&type=date&legend=top-left)](https://www.star-history.com/?repos=gdlwolf%2Fclawgod&type=date&legend=top-left)
