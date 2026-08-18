# custom-first-control-prompt 完整安装与改造流程（跨机实测记录，v2）

> 本文件是**另一台机器**（Windows + npm rc.5 部署）从零安装、启用 UI 面板、
> 并配置参考历史注入的完整实测流程记录。所有命令均在该机器验证过。
> **脱敏约定**：文中所有路径均为占位符（`%USERPROFILE%`、`<DSH_HOME>`、`<checkout>`、
> `<插件目录>`），不含任何机器的用户名与真实绝对路径。
> 与发布侧 `INSTALL.md` 的关系：本文档是**实测记录**（补充验证细节与踩坑）；
> `INSTALL.md` 是通用手册。两处不一致时，以**各自机器上的实测为准**（框架/部署
> 版本不同行为可能不同），差异点已在「§8 反馈清单」列出。
> **v2 相对 v1**：新增 §2.5 Route C（intercept，推荐）、§9 生产就绪与升级 SOP、
> `verify-deploy.ps1` 健康检查；补充「插件目录更新 ≠ web 进程生效」硬纪律。

## 0. 概念与档位

| 参考历史注入路线 | 机制 | 框架依赖 | 适用 |
|---|---|---|---|
| **A：hook（框架钩子）** | `agent-loop/session-seed` 瀑布，会话创建时进 seed 边界 | 需框架补丁 / 含 `b1601bec35` 的主线构建 | 官方主线 |
| **B：append（默认）** | `agent/session-start` 时 `Session.append` 完整闭合轮次 | **无**（任何 0.1.x） | 通用；fork 带参考会话时受 seed 边界限制（见 §2.6） |
| **C：intercept（推荐 npm 0.1.x）** | `llm/stream` 克隆请求、前置参考交换后重新派发 | **无** | npm 0.1.x（rc.5/rc.6）部署，**首选** |

- 配置键：`seedMode: 'hook' | 'append' | 'intercept'`（**默认 `append`**）。
- **基础档（单帧）**：`seedMode` 为 `hook` 且框架无钩子时，自动退化为会话创建时注入
  一条 `<custom-history>` 帧（user 角色）。
- 同一份插件代码自动适配，互不干扰（各分支分别在返回前注册自己的监听器，不会双重注入）。

> **关键事实（已实测证实）**：npm 发布的 `@deepseek-ai/dsh-agent-loop@0.1.0-rc.6`
> **不含** `agent-loop/session-seed` 钩子（解包检查 `createAgent` 与 rc.5 相同）；
> 该钩子只存在于包含 `b1601bec35` 提交的主线构建。因此 **npm 0.1.x 部署若要走
> 对话式种子，推荐 Route C（intercept，§2.5），完全不需要框架补丁**；
> 只有在你确实想让 seed 进入「会话创建即持久化」的 seed 边界（Route A）时，
> 才需要框架补丁（步骤 B）。

## 1. 前置检查（每台机器必做）

```powershell
# DSH_HOME（默认 %USERPROFILE%\.dsh）
$dsh = Join-Path $env:USERPROFILE '.dsh'

# 1) 部署版本：必须 0.1.x 新线
(Get-Content "$dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\package.json" -Raw | ConvertFrom-Json).version
#    实测：0.1.0-rc.5 / rc.6（npm 发布物；0.0.1-rc.x 老线不兼容）

# 2) 是否已有框架钩子（决定 Route A 是否可用；B/C 不需要）
Select-String -Path "$dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\*.js" -Pattern "session-seed"
#    命中 → Route A 可用；无输出 → npm 0.1.x 均无，走 B 或 C

# 3) bundle 是否自带插件/面板行（决定 patch 里写哪些行）
Select-String -Path "$dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\cordis.patch.yml" -Pattern "custom-first-control-prompt|ui-custom-first-control-prompt"
#    npm 0.1.x 实测：两行都不带 → patch 里核心行 + 面板行都要写
#    （仅当部署 bundle 确认自带面板行——如从含该行的主线构建的 web-app——才不写，
#      避免同 id 重复 insert 导致 web 起不来）
```

## 2. 步骤 A：基础安装在（junction 方式，npm rc.5 已验证）

### A1. 依赖链 junction（插件目录 → 部署依赖根）

```powershell
New-Item -ItemType Junction -Path "<插件目录>\node_modules" -Target "$dsh\profiles\node_modules"
```

### A2. profile 注册（两个包的 junction）

```powershell
$dir = "$dsh\profiles\web\node_modules\@deepseek-ai"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
New-Item -ItemType Junction -Path "$dir\dsh-custom-first-control-prompt" `
  -Target "<插件目录>"
New-Item -ItemType Junction -Path "$dir\dsh-client-ui-custom-first-control-prompt" `
  -Target "<插件目录>\client-ui"
```

### A3. patch 行（cordis.patch.yml，两行都要写——npm 0.1.x bundle 不自带）

```yaml
- insert:
    - id: custom-first-control-prompt
      name: '@deepseek-ai/dsh-custom-first-control-prompt'
      config:
        sections:
          - name: "system"
            order: -50
            text: "system 01"
        history:
          - user: "user01"
            assistant: "assist01"
          - user: "user02"
            assistant: "assist02"
        includeSubagents: false
        historyMode: "session-start"
        seedMode: "intercept"      # ← 主推 Route C（npm 0.1.x）；不写则默认 append

    # 面板客户端行（npm 0.1.x 必须写；仅当 bundle 确认自带时删掉本行）
    - id: ui-custom-first-control-prompt
      name: '@deepseek-ai/dsh-client-ui-custom-first-control-prompt'
```

> **样例提示词一律用中性占位文本**（如 `system 01` / `user01/assist01`）——
> 指令性文本（如 "end every reply with a period."）会让模型循环。
> 配置类变更（cordis.patch.yml）走 HMR 热重载（几秒），**无需重启**。

### A4. 安装后健康检查

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\verify-deploy.ps1"
```

一键检查：插件可解析（含 Config）、组合含核心+面板两行、boot manifest 含面板包、
面板 bundle 路由 200、web 进程在跑、seedMode 生效。

## 2.5 主推：Route C（intercept，npm 0.1.x 零框架改动对话式种子）

- **机制**：在 `llm/stream` 瀑布处**克隆**每次普通对话请求，把参考交换前置到
  `messages`，用 `ctx.llm.stream(cloned)` **重新派发**；带重入保护，原请求对象不改动，
  也**不写入会话日志**（模型请求层注入，前缀缓存友好）。
- **配置**：`cordis.patch.yml` 设 `seedMode: "intercept"`（见 A3），HMR 生效。
- **验证（决定性，实测通过）**：
  1. 建会话并发一条消息，问模型「你看到了几条参考对话」；
  2. 模型能复述出 `user01/assist01`、`user02/assist02` 即注入成功——且**会话 history
     里没有任何 seed 事件**（注入发生在请求层，符合预期）；
  3. 出现 `assistant/chunk` 的 usage 比裸请求显著大（注入内容计入请求 token）；
  4. web `stderr` 无报错。
- **优点**：不碰框架、不改日志、不占轮次编号、压缩免疫（每请求重新注入最新配置）。
- **已知限制**：参考交换只存在于模型请求体（会话页/历史不显示这些交换为独立消息）；
  `includeSubagents` 过滤对 C 同样生效。

## 3. 备选：步骤 B：Route A（框架钩子，`seed-mode: hook`，需框架补丁）

> 仅当你需要「会话创建即把参考对话持久化为闭合轮次」（seed 边界语义）时走此路线。
> npm 0.1.x 无钩子，**必须先打框架补丁**；否则 `hook` 模式自动退化为基础档（单帧）。

### B1. 备份部署产物（回滚用，务必先做）

```powershell
$bak = "$dsh\profiles\backup-<版本>-lib-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
foreach ($p in @('dsh-agent-loop','dsh-session')) {
  New-Item -ItemType Directory -Path "$bak\$p\lib" -Force | Out-Null
  Copy-Item "$dsh\profiles\node_modules\@deepseek-ai\$p\package.json" "$bak\$p" -Force
  Get-ChildItem "$dsh\profiles\node_modules\@deepseek-ai\$p\lib" -File | ForEach-Object {
    Copy-Item $_.FullName "$bak\$p\lib" -Force
  }
}
```

### B2. 修改 checkout 源码

```powershell
# <checkout> = 对应版本官方源码，需 git 工作区干净
git apply "<插件目录>\patches\framework-planA-rc5.patch"
```

改动两处（等价于主线 `b1601bec35` 引入的钩子）：`agent-loop/src/index.ts` 的
`createAgent` 加 `agent-loop/session-seed` 瀑布；`session/src/index.ts` 的
`assertMessageEventShape` 放宽 assistant 来源（model 需 provider/model；plugin 需非空名）。

### B3-B5. 重建 → 同步 → 重启（与 A 相同）

```powershell
pnpm build:lib:host                       # <checkout> 根目录，约 1 分钟
# 产物同步：若部署 lib 与 checkout 硬链接则自动；否则按 §3.4 文件级拷贝
powershell -ExecutionPolicy Bypass -File "<插件目录>\restart-web.ps1"
```

### B6. 验证（Route A，决定性）

API 建会话 → `session.history`：应看到**完整闭合轮次** + `session/end-seed`
（`turn/start → step/start → user/message(kind:'user') → assistant/message(带 turn/step)
→ step/end → turn/end(completed)` 为一轮，两对参考即两轮）。

## 4. UI 面板启用（npm 0.1.x 必须，bundle 不自带；连同 §2R 一起）

面板客户端行（见 A3 第二行）写入且 **web 运行的是当前插件版本**后生效，
**浏览器刷新（F5）**即可见：
- 设置 → 「自定义优先控制提示词」页面（预览/配置编辑/RAW/LLM 监听）
- 设置 → 插件 → `@deepseek-ai/dsh-custom-first-control-prompt` 卡片（两个开关）
- 对话输入框上方「自定义提示词」条（监听默认关闭）

验证：`Invoke-WebRequest http://127.0.0.1:3080/` 的 HTML 应含
`dsh-client-ui-custom-first-control-prompt`（boot manifest）；面板 bundle 路由应 200：
`/plugins/@deepseek-ai/dsh-client-ui-custom-first-control-prompt/client.js`。

> **硬纪律（本机实测踩过）**：**更新插件目录（git fetch/reset）后，运行中的 web
> 进程仍加载旧插件代码（Node ESM 模块缓存）**——目录更新 ≠ 进程生效。
> 不重启会出现：旧版面板保存仍覆盖面板行、`seedMode` 新值（如 `intercept`）被旧版
> 面板归一成 `hook`、UI 面板行丢失等「看起来莫名失效」的问题。
> **任何插件目录更新后必须重启 web**（`restart-web.ps1`），再验证。

## 5. 回滚与逃生

### 逃生脚本（web 起不来时一键恢复可启动状态）

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\escape.ps1"
```

做三件事（幂等）：① 从 `profiles\backup-<版本>-lib-*` 还原框架产物；
② 给 `cordis.patch.yml` 追加两行 disabled 覆盖（保留原配置）：
```yaml
- id: custom-first-control-prompt
  disabled: true
- id: ui-custom-first-control-prompt
  disabled: true
```
③ 输出重启指引（脚本不自动杀进程/启动）。

### 恢复

1. 删掉 cordis.patch.yml 末尾的 disabled 追加段；
2. 重新执行所需步骤（Route C 只需改 seedMode；Route A 需重打补丁+重建+重启）。

## 6. 注意事项（实测踩坑汇总）

1. **`seedMode` 三值 + 默认 `append`**：npm 0.1.x 想对话式种子优先 `intercept`（C）；
   `hook`（A）在无钩子框架退化为单帧基础档。
2. **目录更新必须重启 web**（Node ESM 缓存）——见 §4 硬纪律；配置类变更（patch）HMR 即可。
3. **面板「配置编辑」保存**：新版（含 `016d3d5`）会保留文件里的手动行（面板行）；
   **旧版运行时**（进程加载旧代码）保存仍会**整文件重建**、丢掉面板行并把未知
   `seedMode` 归一成 `hook`——尽量保持 web 跑最新插件版本。
4. **面板行 npm 0.1.x 必须写、bundle 自带时别重复写**：同 id 重复 insert → web 起不来。
5. **样例提示词用中性占位文本**，勿用指令性语句（会导致模型循环）。
6. **Route A 钩子生效后 historyMode 建议 `session-start`**：`reapply`/`per-request`
   会与对话式 seed **双重注入**。Route B/C 不受 historyMode 干扰（B/C 分支各自独立）。
7. **启动方式**：`restart-web.ps1`（部署内 `dsh\lib\bin.js web`）与你惯用启动方式
   （如 checkout CLI）等价但进程不同；**别双开**（EADDRINUSE），换启动器先停旧的。
8. **部署产物与 checkout 可能硬链接**：重建 checkout 会直接改部署文件；改框架前必备份
   （§3.1）。
9. **default export 历史问题**：旧版丢 `Config`（schema 校验失效）；当前发布版已修复。

## 7. 分发物相关文件清单

| 文件 | 作用 |
|---|---|
| `verify-deploy.ps1` | **部署健康检查**（生产就绪，§9.1；一键诊断插件/面板/进程/seedMode） |
| `escape.ps1` | 逃生脚本（还原产物 + 屏蔽插件行 + 重启指引） |
| `restart-web.ps1` | 独立进程重启 web（kill → 启动 → 健康检查 → 日志） |
| `install.ps1` / `uninstall.ps1` | 一键安装 / 卸载（junction + patch 行 / 还原） |
| `patches/framework-planA.patch` | Route A 框架补丁（通用意图，基线按版本核对） |
| `patches/framework-planA-rc5.patch` | Route A 的 rc.5 适配补丁（可正/反向应用） |
| `PLAN-A-REVISED.md` | 路线分析（B/C 即其「路线 B 纯插件」方案的产品化） |
| `$dsh\profiles\backup-<版本>-lib-*` | 框架产物备份（escape.ps1 回滚来源） |
| `$dsh\logs\web-restart-*.log` 等 | 重启/运行日志 |

---

## 8. 反馈清单（供插件作者，全部为 npm 0.1.x 部署实测观察）

> 以下为实测观察，按严重程度排列。每条给出：现象 → 影响 → 建议。
> 其中多数已在本仓库后续修订中处理（见括号标注）。

### 8.1 「next 线 0.1.0-rc.6 已内置钩子」与发布物不符（已核实）

- 实测 npm `dsh-agent-loop@0.1.0-rc.6` 无钩子；钩子只存在于含 `b1601bec35` 的主线构建。
- 处理：文档已修正；建议插件侧加运行时探测（未发射钩子时日志告警「当前为 …」）消除静默降级。

### 8.2 `framework-planA.patch` 基线不明（已处理）

已随附 `framework-planA-rc5.patch`（正/反向可应用），INSTALL.md 说明按部署版本选择。

### 8.3 完全版在 npm 0.1.x 上的验证路径（已处理）

本 v2 明确「npm 0.1.x 走 Route C（§2.5）零框架补丁」，框架自然部署无需打补丁。

### 8.4 钩子生效后与 historyMode 的交互（建议）

Route A + `reapply`/`per-request` 会双重注入；README 模式矩阵建议补「框架含钩子时
三种模式真实行为」。Route B/C 已天然隔离。

### 8.5-8.7 src/lib 不一致、陈旧 chunk、default export 丢 Config（均已处理）

已对齐 src 与 lib、删除陈旧 chunk + 门禁、移除 default export。

### 8.8 空配置时插件完全静默（待办建议）

`history`/`sections` 为空时不注册任何监听器且无日志。建议 apply 对空配置打 info/warn。

### 8.9 正式部署启动方式未文档化（已处理）

已随附 `restart-web.ps1` 与启动/双开注意。

### 8.10-8.12 版本号统一、panel/ 遗留、回滚流程缺失（均已处理）

已统一版本号；`panel/` 属历史遗留建议 README 声明废弃；已随附 `escape.ps1`。

### 8.13 目录更新 ≠ web 进程生效（本机新踩，建议文档/工具化）

- **现象**：git 更新插件目录（junction 指向它）后，运行中的 web 仍加载旧插件代码；
  旧版面板保存导致面板行丢失、`intercept` 被归一成 `hook`，面板 UI 与配置行为异常且
  无任何提示。
- **建议**：README/INSTALL 明确「插件目录更新后必须重启 web」；可考虑给插件增加版本
  指纹（`package.json` version 或构建哈希），面板 UI 显示「服务端加载版本 vs 目录版本」，
  不一致时提示重启。

### 8.14 `seedMode` 非法/未知值被面板静默归一（待办建议）

- **现象**：旧版面板 `buildPatch` 只认 `append`/`hook`，把未知值（如 `intercept`）静默
  写回 `hook`，无告警。
- **建议**：schema 校验 + 写回后自检/告警，而非静默归一。

---

## 9. 生产就绪建议（部署 / 升级 / 发布纪律）

### 9.1 每次变更后跑健康检查

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\verify-deploy.ps1"
```

`verify-deploy.ps1` 检查项（失败给红色提示 + 处置建议）：
1. 插件包可解析（node import，插件对象含 `Config`）；
2. 组合（`--dump-config`）含核心行 + 面板行、`seedMode` 符合预期；
3. boot manifest（首页 HTML）含面板包；面板 bundle 路由 200；
4. web 进程在跑（端口 3080 监听）、HTTP 200；
5. 插件目录 git HEAD 与远端是否一致（提示「目录是否有本地差异」）；
6.（可选）Route C 时提示：若刚更新目录，**必须重启 web** 才加载新代码。

### 9.2 升级 SOP（插件目录新版本）

```powershell
git -C "<插件目录>" fetch origin
git -C "<插件目录>" reset --hard origin/main    # 假设远端单主线
powershell -ExecutionPolicy Bypass -File "<插件目录>\verify-deploy.ps1"   # 变更前基线
powershell -ExecutionPolicy Bypass -File "<插件目录>\restart-web.ps1"     # 必须重启
powershell -ExecutionPolicy Bypass -File "<插件目录>\verify-deploy.ps1"   # 变更后确认
```

> 铁律：`reset --hard` 会丢弃插件目录本地未提交文件（含你的运维脚本/文档）——
> 先备份到插件目录外（如 `$dsh` 或独立目录）。

### 9.3 框架 / 部署维护

- 每次 `pnpm build:lib:host` 前先 `escape.ps1` 约定的备份或 §3.1 备份；
- `restart-web.ps1` 日志在 `$dsh\logs\`，排障先看 `web.stderr.log` 尾部；
- 部署产物若与 checkout 硬链接，任何 checkout 重建都会改动部署——只在明确意图时执行。

### 9.4 发布纪律建议（给作者 / 分发侧）

1. **停止强制更新单 squash**：多次 `forced update` 让 `git pull` 变成 `fetch+reset`，
   协作易踩「目录与远端不一致」；建议每个里程碑打带版本 tag，普通提交正常增值历史。
2. **发布说明（CHANGELOG）**：每个版本记录破坏性变更（如「移除 default export」、
   「面板写回保留手动行」等），否则下游无法判断是否需要重启/迁移。
3. **src ↔ lib 一致性门禁前置**：`verify-build.ps1` 纳入「构建后整目录镜像 + 关键形状
   对照 + 无陈旧 chunk」为**发布前必跑**（而非可选）。
4. **版本指纹可观测**：`package.json` version 与插件运行时上报（如面板显示当前加载版本），
   帮助定位「目录已更新但进程未重启」这类问题。
