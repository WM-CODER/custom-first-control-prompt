# custom-first-control-prompt 完整安装与改造流程（跨机实测记录）

> 本文件是**另一台机器**（Windows + npm rc.5 部署）从零安装、启用 UI 面板、
> 并改造为「完全版（对话式种子）」的完整实测流程记录。所有命令均在该机器验证过。
> **脱敏约定**：文中所有路径均为占位符（`%USERPROFILE%`、`<DSH_HOME>`、`<checkout>`、
> `<插件目录>`），不含任何机器的用户名与真实绝对路径。
> 与发布侧 `INSTALL.md` 的关系：本文档是**实测记录**（补充验证细节与踩坑）；
> `INSTALL.md` 是通用手册。两处不一致时，以**各自机器上的实测为准**（框架/部署
> 版本不同行为可能不同），差异点已在「§8 反馈清单」列出。

## 0. 概念与档位

| 档位 | 含义 | 部署条件 |
|---|---|---|
| **基础档（帧）** | 参考历史合并为一条 `<custom-history>` 帧（user 角色）注入 | 框架**无** `agent-loop/session-seed` 钩子（npm 0.1.x 发布物，含 rc.6，均无） |
| **完全版（对话式）** | 参考历史以**真实交替 user/assistant 消息**注入（闭合轮次） | 框架**有**该钩子（需打框架补丁；见步骤 B） |

插件同一份代码自动适配：框架无钩子走帧路径，有钩子走对话式种子路径（钩子监听无条件注册）。

> **关键事实（已实测证实）**：npm 发布的 `@deepseek-ai/dsh-agent-loop@0.1.0-rc.6`
> **不含** `agent-loop/session-seed` 钩子（解包检查 `createAgent` 与 rc.5 相同）；
> 该钩子只存在于包含 `b1601bec35` 提交的主线构建（如从 dsh 仓库本地构建的部署）。
> 因此 npm 部署要完全版，**必须打框架补丁**（本仓库 `patches/` 提供
> `framework-planA.patch` 与其 rc.5 适配版 `framework-planA-rc5.patch`）。
> 详见 §8.1。

## 1. 前置检查（每台机器必做）

```powershell
# DSH_HOME（默认 %USERPROFILE%\.dsh）
$dsh = Join-Path $env:USERPROFILE '.dsh'

# 1) 部署版本：必须 0.1.x 新线
(Get-Content "$dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\package.json" -Raw | ConvertFrom-Json).version
#    实测：0.1.0-rc.5 / rc.6（npm 发布物；0.0.1-rc.x 老线不兼容）

# 2) 框架是否已含钩子（决定是否要做步骤 B）
Select-String -Path "$dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\*.js" -Pattern "session-seed"
#    命中 → 已含钩子（无需步骤 B，直接完全版）；无输出 → 需要步骤 B（npm 0.1.x 实测均无钩子）

# 3) bundle 是否自带插件/面板行（决定 patch 里写哪些行）
Select-String -Path "$dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\cordis.patch.yml" -Pattern "custom-first-control-prompt|ui-custom-first-control-prompt"
#    npm 0.1.x 实测：两行都不带 → patch 里核心行 + 面板行都要写
#    （仅当部署 bundle 确认自带面板行——如从含该行的主线构建的 web-app——才不写，
#      避免同 id 重复 insert 导致 web 起不来）

# 4) 网络（仅方式 A 需要；本机全程方式 B，离线可用）
npm view @deepseek-ai/dsh-web-app dist-tags --json   # 期望 next: 0.1.0-rc.6
```

## 2. 步骤 A：基础档安装（junction 方式，npm rc.5 已验证）

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
            text: "这是测试提示词"
        history:
          - user: "用户测试提示词1"
            assistant: "助手提示词1"
          - user: "用户测试提示词2"
            assistant: "助手提示词2"
        includeSubagents: false
        historyMode: "session-start"

    # 面板客户端行（npm 0.1.x 必须写；仅当 bundle 确认自带时删掉本行）
    - id: ui-custom-first-control-prompt
      name: '@deepseek-ai/dsh-client-ui-custom-first-control-prompt'
```

> **样例提示词一律用中性占位文本**（如 `用户测试提示词1/助手提示词1`）——
> 指令性文本（如 "end every reply with a period."）会让模型循环。
> 配置变更走 HMR 热重载（几秒），无需重启。

### A4. 验证（基础档）

- 解析：`node -e "import('@deepseek-ai/dsh-custom-first-control-prompt').then(m => { const p = m.default ?? m; console.log(Object.keys(p).join(',')) })"`（在 `$dsh\profiles\web` 下）
  期望含 `Config`（当前发布版已无 default export）。
- 运行时：新会话若框架无钩子，首条请求前应见 `<custom-history>` 帧（基础档路径）。

## 3. 步骤 B：完全版改造（框架加钩子，仅当步骤 1-2 无钩子时）

> 本质：把 `patches/framework-planA.patch` 的意图适配到对应版本框架源码。
> 原 patch 在 rc.5 上 `git apply` 全部失败（基线不匹配），本流程使用仓库内的
> **rc.5 适配版** `patches/framework-planA-rc5.patch`（正向/反向均可应用）。

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

在 `<checkout>`（对应版本官方源码，需干净）执行：

```powershell
git apply "<插件目录>\patches\framework-planA-rc5.patch"
```

改动内容（两处，等价于主线 `b1601bec35` 引入的钩子）：

1. `packages/core/agent-loop/src/index.ts` — `createAgent()` 加
   `agent-loop/session-seed` 瀑布（收集 seed 事件传入 `sessions.prepare`），
   外加 `SessionEvent` 类型导入与事件声明（见 patch 全文）。
2. `packages/core/session/src/index.ts` — `assertMessageEventShape` 的
   assistant 分支放宽：model 来源需 provider/model；plugin 来源需非空插件名。

### B3. 重建 host 库

```powershell
# 在 <checkout> 根目录执行（约 1 分钟）
pnpm build:lib:host
```

### B4. 同步产物到部署

- 若部署 `profiles\node_modules\@deepseek-ai\dsh-agent-loop` / `dsh-session` 的
  `lib/` 与 checkout 产物是**硬链接**，重建即自动同步（用哈希验证过）。
- 非硬链接环境：文件级拷贝（不要 `Copy-Item -Recurse`，会跟随包内 junction）：
  ```powershell
  foreach ($p in @('dsh-agent-loop','dsh-session')) {
    Get-ChildItem "<checkout>\packages\core\$($p -replace 'dsh-','')\lib" -File | ForEach-Object {
      Copy-Item $_.FullName "$dsh\profiles\node_modules\@deepseek-ai\$p\lib" -Force
    }
  }
  ```

### B5. 重启 web（必须，框架代码变更 HMR 不生效）

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\restart-web.ps1"
# 独立进程执行：kill 端口监听进程 → node <部署>\dsh\lib\bin.js web 启动 → 健康检查
# 日志：$dsh\logs\web-restart-*.log / web.stdout.log / web.stderr.log
```

> 注意：`restart-web.ps1` 用部署内 `dsh\lib\bin.js` 启动（与 checkout CLI
> `apps/cli` 等价但进程不同）；若你用自己惯用方式启动，先停掉它再启动，别双开（EADDRINUSE）。

### B6. 验证（完全版，决定性）

```powershell
# API 建会话 → 查历史：应看到完整闭合轮次 + session/end-seed
$base = "http://127.0.0.1:3080/api"
$body1 = @{ type='client-request'; rpcId='v1'; method='session.create'; payload=@{ cwd='<工作区>' } } | ConvertTo-Json -Depth 5
(Invoke-WebRequest -Uri "$base/session.create" -Method Post -ContentType 'application/json' -Body $body1 -UseBasicParsing).Content
# 取 sessionId，然后：
$body2 = @{ type='client-request'; rpcId='v2'; method='session.history'; payload=@{ sessionId='<sessionId>' } } | ConvertTo-Json -Depth 6
(Invoke-WebRequest -Uri "$base/session.history" -Method Post -ContentType 'application/json' -Body $body2 -UseBasicParsing).Content
```

期望（中性占位配置 + `session-start`，2 对参考历史）：

```
seq0  turn/start        {turn:1}
seq1  step/start        {turn:1, step:1}
seq2  user/message      "用户测试提示词1"  source.kind:'user'   ← 真实用户气泡
seq3  assistant/message assistant-0  plugin source，带 turn/step
seq4  step/end / seq5  turn/end(completed)
seq6-11  turn 2（用户测试提示词2 对）同样闭合
seq12 session/end-seed
seq13+ 系统事件
```

## 4. 步骤 C：UI 面板启用（npm 0.1.x 必须，bundle 不自带）

面板客户端行（见 A3 的第二行）写入后 HMR 生效，**浏览器刷新（F5）**即可见：
- 设置 → 「自定义优先控制提示词」页面（预览/配置编辑/RAW/LLM 监听）
- 设置 → 插件 → `@deepseek-ai/dsh-custom-first-control-prompt` 卡片（两个开关）
- 对话输入框上方「自定义提示词」条（监听默认关闭）

验证：`Invoke-WebRequest http://127.0.0.1:3080/` 的 HTML 应含
`dsh-client-ui-custom-first-control-prompt`（boot manifest）；面板 bundle 路由应 200：
`/plugins/@deepseek-ai/dsh-client-ui-custom-first-control-prompt/client.js`。

## 5. 回滚与逃生

### 逃生脚本（web 起不来时一键恢复可启动状态）

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\escape.ps1"
```

做三件事（幂等）：
1. 从 `profiles\backup-<版本>-lib-*`（B1 的备份）还原 dsh-agent-loop / dsh-session 产物；
2. 在 `cordis.patch.yml` 末尾追加两行 disabled 覆盖（保留原配置，恢复时删掉追加段即可）：
   ```yaml
   - id: custom-first-control-prompt
     disabled: true
   - id: ui-custom-first-control-prompt
     disabled: true
   ```
3. 输出重启指引（脚本不自动杀进程/启动）。

### 恢复完全版

1. 删掉 cordis.patch.yml 末尾的 disabled 追加段；
2. 重新执行步骤 B（`git apply framework-planA-rc5.patch`（checkout 干净时）→ 重建 → 重启）。

### 补丁存档

- `patches/framework-planA.patch`：通用意图补丁（基线未注明，按版本核对上下文）；
- `patches/framework-planA-rc5.patch`：rc.5 适配版，正向应用（checkout 干净时）/
  反向回滚（`git apply -R`）均验证可用。

## 6. 注意事项（实测踩坑汇总）

1. **钩子生效后 historyMode 必须用 `session-start`**：`reapply`/`per-request` 会与对话式种子
   **双重注入**（每请求再叠一帧）。`session-start` = 纯对话式种子（无帧文本）。
2. **面板行 npm 0.1.x 必须写、bundle 自带时别重复写**：同 id 重复 insert → web fail-loud 起不来。
3. **npm 0.1.x（含 rc.6）无钩子**（`dsh-agent-loop` 的 createAgent 与 rc.5 相同）——
   任何 npm 部署要完全版都要走步骤 B（或等真正含钩子的主线构建）。
4. **样例提示词用中性占位文本**，勿用指令性语句（会导致模型循环）。
5. **插件包更新（git 更新工作区）后需重启 web** 才生效（Node ESM 模块缓存）；配置类变更
   （cordis.patch.yml）HMR 秒级生效。
6. **部署产物与 checkout 可能硬链接**：重建 checkout 会直接改部署文件；修改前务必 B1 备份。
7. **restart-web.ps1 与惯用启动方式**：双开会 EADDRINUSE；用你自己的方式启动前先停掉脚本起的进程。
8. **default export 历史问题**：旧版插件默认导出丢 `Config`（schema 校验失效）；当前发布版
   已修复（无 default export，`unwrapExports` 返回含 Config 的完整导出）。

## 7. 分发物相关文件清单

| 文件 | 作用 |
|---|---|
| `escape.ps1` | 逃生脚本（回滚产物 + 屏蔽插件行 + 重启指引） |
| `restart-web.ps1` | 独立进程重启 web（kill → 启动 → 健康检查 → 日志） |
| `patches/framework-planA.patch` | 完全版框架补丁（通用意图，基线按版本核对） |
| `patches/framework-planA-rc5.patch` | rc.5 适配框架补丁（可正/反向应用） |
| `PLAN-A-REVISED.md` | 完全版方案分析（含备选路线 B：纯插件实现，零框架改动） |
| `$dsh\profiles\backup-<版本>-lib-*` | 框架产物备份（escape.ps1 的回滚来源，安装时创建） |
| `$dsh\logs\web-restart-*.log` 等 | 重启/运行日志 |

---

## 8. 反馈清单（供插件作者，全部为 npm 0.1.x 部署实测观察）

> 以下为实测观察，按严重程度排列。每条给出：现象 → 影响 → 建议。
> 其中多数已在本仓库后续修订中处理（见括号标注）。

### 8.1 「next 线 0.1.0-rc.6 已内置钩子」与发布物不符（最严重，已核实）

- **现象**：早期文档声称 npm `next` 线 0.1.0-rc.6 框架已内置 `agent-loop/session-seed`
  钩子、「无需打补丁」。实测 `npm pack @deepseek-ai/dsh-agent-loop@0.1.0-rc.6` 解包检查：
  `createAgent` 与 rc.5 完全相同，无瀑布、无钩子。
- **影响**：照早期文档升级到 rc.6 后仍是**基础档（帧）**，且**无任何提示**（静默降级）。
- **处理**：本仓库已修正文档（明确钩子只存在于含 `b1601bec35` 的主线构建；npm 0.1.x
  均无钩子；完全版需打框架补丁）；建议插件侧加运行时探测（检测钩子是否发射，未发射
  时日志告警「当前为基础档」）以消除静默降级（见 PLAN-A-REVISED.md 路线 B 亦规避）。

### 8.2 `framework-planA.patch` 基线不明、无法应用（已处理）

- **现象**：patch 在 rc.5 官方源码上 `git apply --check` 全部失败，且 patch 内无基线说明。
- **处理**：本仓库已随附 rc.5 适配版 `patches/framework-planA-rc5.patch`（正/反向均可应用），
  并在 INSTALL.md 说明按部署版本选择补丁。

### 8.3 完全版在 npm 0.1.x 上的验证路径未交代（已处理）

- **处理**：INSTALL.md 已明确「npm 部署完全版 = 打框架补丁（步骤 B）+ 重建 + 重启」的
  完整路径，本文档即为实测记录。

### 8.4 钩子生效后与 historyMode 的交互未文档化（双重注入）

- **现象**：插件在 `apply` 中**无条件**注册 `agent-loop/session-seed` 监听器（任何
  historyMode 都注入对话式种子）；同时 `reapply`/`per-request` 的 pre-step 逻辑仍会注入帧。
  实测：钩子部署 + `per-request` = **对话式种子 + 每请求一帧**（重复内容）；只有
  `session-start` 是纯对话式（且靠 `hasSeededHistory` 挡掉帧回退）。
- **建议**：README 模式矩阵补充「框架含钩子时三种模式的真实行为」一列/一节。

### 8.5 分发物 src 与 lib 曾长期不一致（已处理）

- **现象**：早期提交中 `lib/` 已含「user 侧 kind:'user' + 双形状检测」修复，但 `src/`
  仍是旧逻辑；且 `verify-build.ps1` 没有 src↔lib 一致性检查。
- **处理**：已对齐 src 与 lib，并建议 verify-build 增加「源码关键形状与产物一致」对照。

### 8.6 陈旧 `seed-*.js` chunk 曾随分发物发布（已处理）

- **现象**：早期提交的 `lib/` 含 4 个 seed chunk，其中 3 个未被引用
  （`files: ["lib/seed-*.js"]` 会全部发布）。
- **处理**：已删除陈旧 chunk，并新增 verify-build「no stale seed chunks」门禁（第 4b 项）。

### 8.7 default export 丢失 `Config` 的问题长期存在且无文档（已处理）

- **现象**：插件曾 `export default { name, inject, apply }`——loader 的 `unwrapExports`
  取 default 后插件对象**没有 `Config`**，schema 校验失效。
- **处理**：已移除 default export；验证命令建议改为检查插件对象形状
  （`m.default ?? m` 含 `Config`）。

### 8.8 空配置时插件完全静默，无可观测性（待办建议）

- **现象**：`sections: []` + `history: []` 时，插件正常加载但不注册任何监听器——无帧、
  无 seed、**无任何日志/告警**。用户会误以为插件失效。
- **建议**：apply 时对「配置为空」打一条 info/warn 日志，或在面板上显示「未配置」状态。

### 8.9 正式部署的启动方式未文档化（待办建议）

- **现象**：文档只给测试实例的启动命令；正式部署的启动方式（部署内 `dsh\lib\bin.js web`
  与 checkout CLI `apps/cli`）未说明。
- **处理**：本仓库已随附 `restart-web.ps1`（kill → 启动 → 健康检查 → 日志），并说明
  与惯用启动方式的并存注意（EADDRINUSE）。

### 8.10 版本号与文档不一致（已处理）

- **处理**：`package.json` 与文档已统一为 0.1.0-rc.6。

### 8.11 历史遗留目录 `panel/` 易混淆（待办建议）

- **现象**：`panel/`（cordis_define 时代的动态面板源码）与 `client-ui/`（正式面板）并存。
- **建议**：README 开头用一句话明确「`panel/` 已废弃，正式面板在 `client-ui/`」。

### 8.12 回滚/逃生流程缺失（已处理）

- **处理**：本仓库已随附 `escape.ps1`（还原产物备份 + disabled 覆盖 + 重启指引），
  与 `backup-<版本>-lib-*` 备份约定配套。
