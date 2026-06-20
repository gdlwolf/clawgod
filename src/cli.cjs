#!/usr/bin/env bun
const { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, renameSync } = require('fs');
const { join, basename } = require('path');
const { homedir } = require('os');
const { spawnSync } = require('child_process');

const clawgodDir = join(homedir(), '.clawgod');

// ─── Drift detection ───────────────────────────────────────
// On Linux/macOS, the native Claude binary lives in
// ~/.local/share/claude/versions/<version>.  If the user upgraded
// Claude Code through the official installer (or auto-update), a
// newer binary may exist there while our .source-version is stale.
// Re-extract + re-patch transparently on next launch.
const versionsDir = join(homedir(), '.local', 'share', 'claude', 'versions');
const sourceVerFile = join(clawgodDir, '.source-version');
if (process.platform !== 'win32' && existsSync(versionsDir)) {
  try {
    const entries = readdirSync(versionsDir, { withFileTypes: true });
    const vers = entries
      .filter(e => e.isFile() || e.isDirectory())
      .map(e => e.name)
      .filter(n => /^[\d.]+$/.test(n))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (vers.length > 0) {
      const latest = vers[0];
      const stamped = existsSync(sourceVerFile)
        ? readFileSync(sourceVerFile, 'utf8').trim()
        : '';
      if (stamped !== latest) {
        const binPath = join(versionsDir, latest);
        const repatch = join(clawgodDir, 'repatch.mjs');
        if (existsSync(repatch) && existsSync(binPath)) {
          const r = spawnSync(process.execPath, [repatch, binPath], {
            cwd: clawgodDir,
            stdio: 'inherit',
          });
          if (r.status !== 0) {
            console.error(`[clawgod] drift: re-patch to ${latest} failed (exit ${r.status})`);
          }
        }
      }
    }
  } catch (e) {
    // Non-fatal: if we can't detect drift, proceed with current patch
  }
}

// One-time migration: earlier wrapper versions set CLAUDE_CONFIG_DIR=~/.clawgod,
// which made Claude Code read/write ~/.clawgod/.claude.json instead of the
// native ~/.claude.json (the file holding MCP config, project history, session
// index). Move it back transparently on first run after upgrade.
const nativeClaudeJson = join(homedir(), '.claude.json');
const strayClaudeJson = join(clawgodDir, '.claude.json');
if (existsSync(strayClaudeJson) && !existsSync(nativeClaudeJson)) {
  try { renameSync(strayClaudeJson, nativeClaudeJson); } catch {}
}

const providerDir = clawgodDir;
const configFile = join(providerDir, 'provider.json');

const defaultConfig = {
  apiKey: '',
  baseURL: 'https://api.anthropic.com',
  model: '',
  smallModel: '',
  timeoutMs: 60000,
};

let config = { ...defaultConfig };
if (existsSync(configFile)) {
  try {
    const raw = JSON.parse(readFileSync(configFile, 'utf8'));
    config = { ...defaultConfig, ...raw };
  } catch {}
} else {
  mkdirSync(providerDir, { recursive: true });
  writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2) + '\n');
}

const hasProviderApiKey = !!config.apiKey;

if (hasProviderApiKey) {
  process.env.ANTHROPIC_API_KEY = config.apiKey;
  if (config.baseURL) process.env.ANTHROPIC_BASE_URL = config.baseURL;
  if (config.model) process.env.ANTHROPIC_MODEL = config.model;
  if (config.smallModel) process.env.ANTHROPIC_SMALL_FAST_MODEL = config.smallModel;
  if (config.baseURL && !/anthropic\.com/i.test(config.baseURL)) {
    process.env.ANTHROPIC_AUTH_TOKEN ??= config.apiKey;
  }
} else if (config.baseURL && config.baseURL !== defaultConfig.baseURL) {
  process.env.ANTHROPIC_BASE_URL ??= config.baseURL;
}

if (config.timeoutMs) {
  process.env.API_TIMEOUT_MS ??= String(config.timeoutMs);
}
process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ??= '1';
process.env.DISABLE_INSTALLATION_CHECKS ??= '1';
// Use system ripgrep (extracted vendor rg path was build-time-baked; system
// rg is the most reliable fallback under Bun runtime).
process.env.USE_BUILTIN_RIPGREP ??= '1';

// 强制使用系统 bash 而非 Bun shell 执行 shell 命令，避免 Bun 的 shell
// 解析器在处理 pipeline + 复杂参数时出现的 Invalid Argument 错误。
process.env.SHELL = '/bin/bash';

// ─── 第三方 API 智能优化 ─────────────────────────────────
// 当检测到使用非 api.anthropic.com 的 baseURL 时，自动应用
// 第三方 API 兼容配置，避免 400 错误同时保持功能完整。
const isThirdParty = config.baseURL && !/anthropic\.com/i.test(config.baseURL);

if (isThirdParty) {
  // 1. 禁用 beta headers — 避免第三方 API 不认识的 beta 导致 400
  //    (NI6() 补丁已确保 Tool Search 不受此影响)
  process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS ??= '1';

  // 2. 确保 Tool Search 启用（覆盖 DISABLE_EXPERIMENTAL_BETAS 的影响）
  process.env.ENABLE_TOOL_SEARCH ??= 'auto:0';

  // 3. 合理的超时（第三方 API 通常比官方慢）
  process.env.API_TIMEOUT_MS ??= String(config.timeoutMs || 120000);

  // 4. 流看门狗超时（慢响应不误判为断连）
  process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS ??= '120000';

  // 5. 将 CLAUDE.md 注入 system prompt 的 `system` 参数
  //    第三方 API 的 system prompt 中不包含 CLAUDE.md 内容（它是作为 userContext
  //    传递的），导致模型不遵守 CLAUDE.md 的指令。通过 CLAUDE_CODE_APPEND_SYSTEM_PROMPT
  //    将其追加到 system prompt 末尾，每次 API 请求都携带。
  const claudeMdDirs = [
    join(process.cwd(), 'CLAUDE.md'),
    join(process.cwd(), '.claude', 'CLAUDE.md'),
    join(homedir(), 'CLAUDE.md'),
  ];
  let claudeMdContent = '';
  for (const p of claudeMdDirs) {
    if (existsSync(p)) {
      try {
        const md = readFileSync(p, 'utf8').trim();
        if (md) claudeMdContent += (claudeMdContent ? '\n\n---\n\n' : '') + md;
      } catch {}
    }
  }
  if (claudeMdContent) {
    process.env.CLAUDE_CODE_APPEND_SYSTEM_PROMPT ??=
      `\n\n<user_claude_md>\n${claudeMdContent}\n</user_claude_md>`;
  }
}

const featuresFile = join(providerDir, 'features.json');
if (!process.env.CLAUDE_INTERNAL_FC_OVERRIDES && existsSync(featuresFile)) {
  try {
    const raw = readFileSync(featuresFile, 'utf8');
    JSON.parse(raw);
    process.env.CLAUDE_INTERNAL_FC_OVERRIDES = raw;
  } catch {}
}

// ─── CLAUDE_CODE_EXECPATH → native binary ─────────────────
// Claude Code's built-in Bash `grep`/`find` shell functions do
// `exec -a ugrep "$CLAUDE_CODE_EXECPATH" -G ...` (they reuse the claude
// binary as a bundled ugrep/bfs). The default fallback for that env is
// `$(command -v claude)`, which under clawgod points at THIS bun launcher
// (no ugrep capability) → every `grep` call dies with bun's
// "error: Invalid Argument '-G'". Point it at the real native Claude binary
// instead. Best-effort: if we can't resolve it, leave the env unset so the
// default fallback still applies (no worse than before).
if (!process.env.CLAUDE_CODE_EXECPATH) {
  try {
    let nativeBin = '';
    if (process.platform === 'win32') {
      for (const cand of [
        join(homedir(), '.bun', 'bin', 'claude.exe'),
        join(homedir(), '.local', 'bin', 'claude.orig.exe'),
      ]) {
        if (existsSync(cand)) { nativeBin = cand; break; }
      }
    } else {
      const vDir = join(homedir(), '.local', 'share', 'claude', 'versions');
      if (existsSync(vDir)) {
        const latest = readdirSync(vDir, { withFileTypes: true })
          .filter(e => e.isFile() || e.isDirectory())
          .map(e => e.name)
          .filter(n => /^[\d.]+$/.test(n))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
        if (latest) {
          const p = join(vDir, latest);
          if (existsSync(p)) nativeBin = p;
        }
      }
    }
    if (nativeBin) process.env.CLAUDE_CODE_EXECPATH = nativeBin;
  } catch {}
}

require('./cli.original.cjs');
