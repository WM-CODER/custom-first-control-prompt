# custom-first-control-prompt 完整安装与改造流程（跨机实测记录，v3）

> 本文件是**另一台机器**（Windows + npm rc.5 部署）从零安装、启用 UI 面板、
> 并配置参考历史注入的完整实测流程记录。所有命令均在该机器验证过。
> **脱敏约定**：文中所有路径均为占位符（`%USERPROFILE%`、`<DSH_HOME>`、`<checkout>`、
> `<插件目录>`），不含任何机器的用户名与真实绝对路径。
> 与发布侧 `INSTALL.md` 的关系：本文档是**实测记录**（补充验证细节与踩坑）；
> `INSTALL.md` 是通用手册。两处不一致时，以**各自机器上的实测为准**（框架/部署
> 版本不同行为可能不同），差异点已在「§8 反馈清单」列出。
> **v3 相对 v2**：插件收敛为**单一注入机制**（原 Route C 即插件本体，包名改为
> `@wm-coders/*`，移除 seedMode/historyMode 配置与 A/B 路线及框架补丁流程）；
> v2 的三路线实测记录保留在 §8 反馈清单中作为历史。

## 0. 概念与机制

参考历史注入机制：`llm/stream` 瀑布处**克隆**每次普通对话请求，把配置的参考交换
（深冻结的交替 user/assistant 消息）前置到 `messages`，用 `ctx.llm.stream(cloned)`
**重新派发**；带重入保护，原请求对象不改动，也**不写入会话日志**（模型请求层注入，
前缀缓存友好）。**零框架依赖**（npm 0.1.x 开箱即用，无需任何补丁或钩子）。

> **关键事实（已实测证实）**：npm 发布的 `@deepseek-ai/dsh-agent-loop@0.1.0-rc.6`
> **不含** `agent-loop/session-seed` 钩子（解包检查 `createAgent` 与 rc.5 相同）；
> 该钩子只存在于包含 `b1601bec35` 提交的主线构建。本插件的请求路径机制正是为
> npm 0.1.x 部署设计——完全不需要框架补丁。

## 1. 前置检查（每台机器必做）

```powershell
# DSH_HOME（默认 %USERPROFILE%\.dsh）
$dsh = Join-Path $env:USERPROFILE '.dsh'

# 1) 部署版本：必须 0.1.x 新线
(Get-Content "$dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\package.json" -Raw | ConvertFrom-Json).version
#    实测：0.1.0-rc.5 / rc.6（npm 发布物；0.0.1-rc.x 老线不兼容）

# 2) bundle 是否自带插件/面板行（决定 patch 里写哪些行）
Select-String -Path "$dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\cordis.patch.yml" -Pattern "custom-first-control-prompt|ui-custom-first-control-prompt"
#    npm 0.1.x 实测：两行都不带 → patch 里核心行 + 面板行都要写
#    （仅当部署 bundle 确认自带面板行——如从含该行的主线构建的 web-app——才不写，
#      避免同 id 重复 insert 导致 web 起不来）
```

## 2. 步骤 A：安装

> **v3.1 起安装正规化**：核心包自带 `dsh.bundle` 声明（包内 `cordis.patch.yml`
> bundle 层：核心行 + 面板行 + 中性示例默认配置）。**方式 A（官方）**
> `dsh plugin add` 的对账自动激活该层——装完即用，**无需手写 patch 行**；
> **方式 B（离线 junction）**没有经过对账，需在 profile patch 自带同样的两行。
> 自定义配置永远用**带 id 的定向覆盖**（非 insert），见 `cordis.patch.yml.template`。

### A0. 方式 A（官方，推荐）：dsh plugin add

```powershell
# 依赖链先就位（A1），然后一条命令装两个包：
node "$dsh\profiles\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile web add "<插件目录>" "<插件目录>\client-ui"
```

pnpm 以 link 依赖装入两包，CLI 对账读取 `dsh.bundle` 声明并把 bundle 层激活进组合
（`dsh.profile.bundles` 自动追加）。`install.ps1`（不带参数）即此流程的封装。
卸载对应 `dsh plugin remove`（或 `uninstall.ps1`）——依赖与 bundle 层一起干净移除。

### A1. 依赖链 junction（插件目录 → 部署依赖根；两种方式都需要）

```powershell
New-Item -ItemType Junction -Path "<插件目录>\node_modules" -Target "$dsh\profiles\node_modules"
```

### A2. 方式 B（离线）profile 注册（两个包的 junction）

```powershell
$dir = "$dsh\profiles\web\node_modules\@wm-coder"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
New-Item -ItemType Junction -Path "$dir\dsh-custom-first-control-prompt" `
  -Target "<插件目录>"
New-Item -ItemType Junction -Path "$dir\dsh-client-ui-custom-first-control-prompt" `
  -Target "<插件目录>\client-ui"
```

### A3. 方式 B（离线）patch 行（junction 模式没有对账，profile 必须自带两行）

```yaml
- insert:
    - id: custom-first-control-prompt
      name: '@wm-coders/dsh-custom-first-control-prompt'
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

    # 面板客户端行
    - id: ui-custom-first-control-prompt
      name: '@wm-coders/dsh-client-ui-custom-first-control-prompt'
```

> **样例提示词一律用中性占位文本**（如 `system 01` / `user01/assist01`）——
> 指令性文本（如 "end every reply with a period."）会让模型循环。
> 配置类变更（cordis.patch.yml）走 HMR 热重载（几秒），**无需重启**。
> **方式 A 装完后 bundle 层已带这两行**：profile patch 里的旧 `- insert:` 同 id 行
> 必须删掉（根列表重复 → web 起不来）；`uninstall.ps1` 会外科式清理。

### A4. 安装后健康检查

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\verify-deploy.ps1"
```

一键检查：插件可解析（含 Config）、组合含核心+面板两行、boot manifest 含面板包、
面板 bundle 路由 200、web 进程在跑、安装模式探测（官方 add / junction）。

## 2.5 注入机制与验证（决定性，实测通过）

- **机制**：在 `llm/stream` 瀑布处**克隆**每次普通对话请求，把参考交换前置到
  `messages`，用 `ctx.llm.stream(cloned)` **重新派发**；带重入保护，原请求对象不改动，
  也**不写入会话日志**（模型请求层注入，前缀缓存友好）。
- **配置**：`cordis.patch.yml` 的 `history` 数组（见 A3），HMR 生效。
- **验证**：
  1. 建会话并发一条消息，问模型「你看到了几条参考对话」；
  2. 模型能复述出 `user01/assist01`、`user02/assist02` 即注入成功——且**会话 history
     里没有任何 seed 事件**（注入发生在请求层，符合预期）；
  3. 出现 `assistant/chunk` 的 usage 比裸请求显著大（注入内容计入请求 token）；
  4. web `stderr` 无报错；
  5. 面板「LLM 监听」可直接看到注入后的完整请求（种子消息在前，普通对话请求
     无 `[purpose]` 徽标；session-title 等辅助请求不含注入是设计行为）。
- **优点**：不碰框架、不改日志、不占轮次编号、压缩免疫（每请求重新注入最新配置）。
- **已知限制**：参考交换只存在于模型请求体（会话页/历史不显示这些交换为独立消息）；
  `includeSubagents` 过滤同样生效。

## 4. UI 面板启用

方式 A（`dsh plugin add`）下面板行随 bundle 层自动激活；方式 B（离线 junction）
由 A3 第二行自带。面板行存在且 **web 运行的是当前插件版本**后，
**浏览器刷新（F5）**即可见：
- 设置 → 「自定义优先控制提示词」页面（预览/配置编辑/RAW/LLM 监听）
- 设置 → 插件 → `@wm-coders/dsh-custom-first-control-prompt` 卡片（两个开关）
- 对话输入框上方「自定义提示词」条（监听默认关闭）

验证：`Invoke-WebRequest http://127.0.0.1:3080/` 的 HTML 应含
`dsh-client-ui-custom-first-control-prompt`（boot manifest）；面板 bundle 路由应 200：
`/plugins/@wm-coders/dsh-client-ui-custom-first-control-prompt/client.js`。

> **硬纪律（本机实测踩过）**：**更新插件目录（git fetch/reset）后，运行中的 web
> 进程仍加载旧插件代码（Node ESM 模块缓存）**——目录更新 ≠ 进程生效。
> 不重启会出现：旧版面板行为残留（写回覆盖手动行、配置项错乱）、
> UI 面板行丢失等「看起来莫名失效」的问题。
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
2. 重新执行所需步骤（改 patch 配置 HMR 即生效；目录更新则需重启 web）。

## 6. 注意事项（实测踩坑汇总）

1. **目录更新必须重启 web**（Node ESM 缓存）——见 §4 硬纪律；配置类变更（patch）HMR 即可。
2. **面板「配置编辑」保存**：新版会保留文件里的手动行（面板行）；
   **旧版运行时**（进程加载旧代码）保存仍会**整文件重建**、丢掉面板行——
   尽量保持 web 跑最新插件版本。
3. **面板行 npm 0.1.x 必须写、bundle 自带时别重复写**：同 id 重复 insert → web 起不来。
4. **样例提示词用中性占位文本**，勿用指令性语句（会导致模型循环）。
5. **启动方式**：`restart-web.ps1`（部署内 `dsh\lib\bin.js web`）与你惯用启动方式
   （如 checkout CLI）等价但进程不同；**别双开**（EADDRINUSE），换启动器先停旧的。
6. **部署产物与 checkout 可能硬链接**：重建 checkout 会直接改部署文件；改框架前必备份。
7. **default export 历史问题**：旧版丢 `Config`（schema 校验失效）；当前发布版已修复。

## 7. 分发物相关文件清单

| 文件 | 作用 |
|---|---|
| `verify-deploy.ps1` | **部署健康检查**（生产就绪，§9.1；一键诊断插件/面板/进程） |
| `escape.ps1` | 逃生脚本（还原产物 + 屏蔽插件行 + 重启指引） |
| `restart-web.ps1` | 独立进程重启 web（kill → 启动 → 健康检查 → 日志） |
| `install.ps1` / `uninstall.ps1` | 一键安装 / 卸载（junction + patch 行 / 还原；uninstall 兼容清理旧 `@deepseek-ai` scope 安装） |
| `verify-build.ps1` | 产物质量门禁（语法/裸装饰器/导入冒烟/注入实现内联/typert 工件） |
| `LICENSE` | MIT |
| `$dsh\profiles\backup-<版本>-lib-*` | 框架产物备份（escape.ps1 回滚来源） |
| `$dsh\logs\web-restart-*.log` 等 | 重启/运行日志 |

---

## 8. 反馈清单（供插件作者，全部为 npm 0.1.x 部署实测观察）

> 以下为实测观察，按严重程度排列。每条给出：现象 → 影响 → 建议。
> 其中多数已在本仓库后续修订中处理（见括号标注）。
> **注**：v2 时代（三路线：A=hook 框架钩子 / B=append 会话追加 / C=intercept 请求拦截）
> 的路线相关条目保留为历史记录；v3 起插件收敛为单一请求路径机制（原 C 路线即本体），
> A/B 路线与 `seedMode`/`historyMode` 配置已移除。

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
2. 组合（`--dump-config`）含核心行 + 面板行；
3. boot manifest（首页 HTML）含面板包；面板 bundle 路由 200；
4. web 进程在跑（端口 3080 监听）、HTTP 200；
5. 插件目录 git HEAD 与远端是否一致（提示「目录是否有本地差异」）；
6. 若刚更新目录，提示**必须重启 web** 才加载新代码。

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

- 本插件 v3 不再修改框架产物，`escape.ps1` 备份仅用于历史回滚；框架自身维护仍建议先备份；
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
