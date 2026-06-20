# Version Support Posture — clawgod 版本支持姿态(强制)

> 对外/对内的版本支持声明。install 脚本、README、CI 行为都以此为准。

## 声明

clawgod **targets the latest Claude Code**。

- **Latest(最新版)**:全力支持。patch 针对 latest 的源码形态写,drift detection 保证用户升级后自动 re-patch。
- **Older(旧版本)**:best-effort,不保证,不专门维护。通配补丁(patch-engineering.md)让旧版本**大概率能用**(因为认稳定特征不认具体版本名),但不承诺、不发专门兼容分支、不修旧版专属 bug。
- **用户升级 Claude Code(含跳版本)**:下次启动 clawgod 时,drift detection(repatch.mjs)自动重 extract + re-patch 新版,通常无需用户手动干预。

## 为什么是这个姿态(不是"只支持最新"也不是"兼容所有版本")

- **不"只支持最新 + 硬编码"**:Claude Code 迭代极频繁,硬编码 patch 每次改名都断,维护者被上游节奏绑架,成本不可接受。
- **不"兼容所有版本 + 多版本分支"**:为 N 个旧版本各写一套兼容分支,是纯负担,且 clawgod 用户基本都跟最新版。
- **折中(本姿态)**:patch 用通配认稳定特征 → latest 一定工作,older 大概率工作(免费红利),维护者只针对 latest 写、只在通配接不住时动手。维护成本最低。

## 落地要求

### install.sh / install.ps1
- 检测本地 Claude Code 版本。
- 若明显旧于上游最新,**友好提示**(非阻断):
  ```
  [clawgod] Note: your Claude Code (<本地版本>) is older than the latest (<最新版本>).
  ClawGod targets the latest; older versions may work but are not guaranteed.
  Consider upgrading Claude Code.
  ```
- **不 exit**(尽力而为,旧版可能照样能用)。

### README
- 措辞:`targets the latest Claude Code; older versions may work but are not guaranteed`。
- **不**宣称 "works with any version"(那是旧承诺,已作废)。
- 机制说明:auto re-extract + re-patch on launch(drift detection)。

### compat-daily CI
- 语义:每日验证**最新版**兼容。上游发新版 → CI 告警 → 维护者按 upgrade-runbook.md 跟进。
- 不验证多版本矩阵(成本不值)。

### 回应用户 issue
- "我在旧版 Claude Code 上 clawgod 不工作" → 建议升级到最新 Claude Code,再按 upgrade-runbook 确认 latest 是否 OK。不为旧版发兼容分支。
