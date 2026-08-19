# 调试与排障笔记（custom-first-control-prompt × dsh web）

> 本文件记录本插件在 dsh web 部署上从开发到实装过程中实际遇到过的阻碍、根因、规避与
> 验证方法，供部署方（或「安装/排查 AI」）按图索骥。
> **隐私约定**：所有路径均为占位符（`<DSH_HOME>`、`<folder>`、`<repo>`、`<workspace>`、
> `<session-id>`），不含任何机器的用户名、绝对路径、凭据或真实会话标识；经此文件换机器照抄
> 不会泄漏本机信息。
>
> **现状（v3，2026-08-19）**：插件已收敛为**单一注入机制**——`llm/stream` 请求路径拦截
> （原「路线 C」即插件本体），包名 `@wm-coder/*`，`seedMode`/`historyMode` 配置与
> A/B 路线、框架补丁全部移除。下文历史章节中的路线讨论（A=hook / B=append / C=intercept）
> 均为**当时的实测记录**，机制结论仍有效，配置键已不存在。

## 0. 铁律（先读）

- dsh web 的插件加载是 **fail-loud**：任一插件行加载失败（语法错误、缺失产物、重复 id）
  会让**整个 web 起不来**，而不是跳过该插件。因此：
  1. 任何改动先过「构建门禁 + 独立测试实例」（见 §4），**不要直接在唯一在用的 web 上试**；
  2. 排障优先在**独立测试 home** 上复现，确认无误再同步到正式部署。
- 恢复顺序：屏蔽插件行（`<DSH_HOME>/profiles/web/cordis.patch.yml` 删除该 `insert` 或加
  `disabled: true`）→ `web-safe` 逃生 profile 重启 → 修产物后回归。

## 0.3 Changelog 2026-08-19：C-only 收敛 + 进入插件生态

**收敛决策**：只保留请求路径注入（原 C 路线）作为插件本体；移除 `seedMode`（三路线
选择器）、`historyMode`、`reapplyAfterCompaction` 配置与 A（hook）/B（append）实现、
`patches/` 框架补丁、`PLAN-A-REVISED.md`、`profile-web.patch.yml`。`invariant.ts`
改为空伴生（请求路径零日志写入，无可校验对象；保留文件仅为满足构建工厂的测试伴生
制度）。面板设置页移除两个模式下拉。

**生态合规**（独立插件产品定位）：
- 包名 `@deepseek-ai/dsh-*` → `@wm-coder/dsh-*`（核心 + 面板），不再冒用官方 scope；
  框架依赖（`@deepseek-ai/dsh-llm` 等官方包）的 peer 引用保持不变。
- `repository` 指向本仓库（原指 deepseek-harness 官方仓库，会误导归属）；
  新增 MIT `LICENSE`；版本 0.1.0-rc.6 → 0.2.0（配置字段删除属破坏性变更）。
- **构建流水线**：构建工厂（harness 仓库内副本）保持 `@deepseek-ai` 工厂名（workspace
  约束强制 release member 指向官方仓库），产物镜像到分发目录后**字符串重写**为产品名
  （21 个 js/d.ts：`client.js` 的运行时 `remote` 导入、d.ts 类型声明、patch 行渲染字符串），
  与 sourcemap 本机路径清洗同一模式。uninstall.ps1 兼容清理新旧两个 scope 的 junction。
- 升级注意：junction 目标 scope 变为 `node_modules\@wm-coder\`，patch 行 `name` 同步改；
  旧安装先 `uninstall.ps1`（双向清理）再 `install.ps1`。

## 0.2 Changelog 2026-08-19：面板「第一条消息看不到注入请求」定论 + dock 完整列表

**现象**：用户开监听后发第一条真实消息，面板只看到 `#2 [session-title]`（无注入），
看不到带注入的对话请求；第二条消息起才看到 `#3`（带注入）。**模型侧注入一直正常**
（模型回复能引用种子内容）。

**排查过程（三轮）**：
1. 第一轮误判为 session-title 干扰 → 加 `purpose` 字段区分请求（保留为正式能力）；
2. 第二轮加服务端 waterfall trace（临时 `src/trace.ts`，写 `~/.dsh/logs/cfcp-trace.log`）
   证明 **#1 对话请求确实进了 ring**（entry=1, msgs=7, seed 标记为真）——采集层无丢失；
3. 第三轮锁定 UI 缺陷：dock 展开区**只渲染 latest 一条**请求，而 #1（对话+注入）与
   #2（title）相隔仅 2ms，latest 永远是 #2，#1 被 UI 折叠遮蔽。

**修复**：`Dock.tsx` 展开区从单条改为**完整请求列表**（`requests.map`，每条一行、
最新默认展开 `open={request === latest}`）；行内显示 `#序号 · [purpose] 模型 · 消息数 · 时间`。
临时 trace 在验证通过后已全部移除。

**派生结论（设计行为，非 bug）**：`[session-title]` 辅助请求**不含**注入是正确行为
（`purpose !== undefined` 即放行）——避免污染标题生成与浪费 token。首条消息触发
「对话 + title」两个请求，面板应看到两个条目，只有对话那条带注入。

**构建坑（重要，构建产物相关）**：per-package `pnpm exec tsdown`（entry 指向 `src/`）
会绕过根 workspace 构建的装饰器 lowering，产出**裸 `@Remote(`** 的 `lib/index.js`
（Node 无法解析，web 起不来）——这正是 §1.1 记录的坑。**正确构建方式**：仓库根
`pnpm run build:lib:host`（tsc + tsdown workspace 模式 + typertPlugin）。
构建后必须跑 `verify-build.ps1` 门禁（本次正是门禁 #2「无裸 @Remote」拦住了坏产物），
并删除未被 index.js 引用的 stale `seed-*.js` chunk（`clean: false` 堆积；C-only 后
bundle 自包含，通常无 chunk）。

## 0.1 Changelog 2026-08-18：C 路线（`seedMode: "intercept"`）落地 + B 路线根因定论

**B 路线 bug 根因（实测定论）**：`Session.append()` 播种的会话里，用户发第一条真实消息后，
真实 assistant 回复会**遮蔽**注入的 assistant 消息。机制链条：
1. `ReactLoopAgent` 构造时（`agent-loop/src/agent.ts`）从日志读取最新 `turn/start` 作为
   `lastTurn` 水位线——时机在 `agent/session-start` 触发**之前**，此时读到 0；
2. `agent/session-start` 触发后 B 路线 append 种子 turn 1..N；
3. 首个真实 turn = `lastTurn + 1` = 1，与种子 turn 1 **撞号**；
4. surface 折叠按 turn 键去重，真实 assistant 消息覆盖同 turn 的种子消息。
另：`Session.append()` 永不更新 `header.seedLength`（仅 `sessions.prepare({seed})` 边界写入），
inbox 按 `events.slice(header.seedLength ?? 0)` 投影，无法区分种子与真实事件。
结论：B 与 DSH Session 的 seed 边界机制**结构性不兼容**，npm 0.1.x 上请用 C 路线；
B 保留仅作 A/B/C 对比测试。

**C 路线机制**：`llm/stream` waterfall（`{ prepend: true }`）识别普通对话请求
（`purpose === undefined && sessionId !== undefined`，subagent 按 `session.header.origin` 过滤），
**克隆** options、前置一次构建冻结的交替种子消息（`buildSeedMessages`）、`ctx.llm.stream(cloned)`
重新分发（WeakSet 按请求对象身份防递归）。三重封锁的规避论证：
- 深冻结（`markAgentLoopRequest(deepFreeze(...))`）：从不 mutation 原对象，构造全新对象；
- waterfall `next()` 无替换参数：放弃原调用链，经 `ctx.llm.stream()` 重启分发（waterfall 支持短路）；
- agent-loop 不变式校验 `messages === deriveMessages()`：克隆体无 loop 标记，`isAgentLoopRequest`
  直接放行。
**不可行路径备忘**：adapter 包装不可行——`LlmRuntime.adapters` 为私有 Map，无公开 API
获取已注册 adapter 实例供 delegate。

**合规取舍（model-visible ⟺ logged）**：C 注入消息不落日志。曾计划写插件自有声明事件
（`custom-first-control-prompt/injected` + `ignorable: true`），**框架现状物理不可行**：
`Session.append()` 公共 API 不支持 ignorable 信封，且 `KNOWN_SESSION_EVENT_TYPES` 明确
「下游插件事件的注册面推迟到有消费者时再做」——自定义事件类型写入日志会导致重启后 load
被 `assertEventsSupported` 拒绝，会话不可用。定选：reconstruction = 会话日志 + 部署配置
（cordis.patch.yml）+ 插件版本；面板「LLM 监听」可实时看到注入后的请求。

**实机验证（rc.5 部署）**：会话日志仅含真实 turn 1/2、零种子消息、四个种子文本零泄漏；
行为证据——问模型「重复我们最早的那条用户消息」，模型答出配置的 `用户测试提示词1`
（日志里最早的真实用户消息是乱码占位，模型不可能从日志得知），注入到达模型实锤；
fork 正常；web stderr 无 invariant 失败。

**类型 shim**：`src/index.ts` 本地声明 `agent-loop/session-seed` 事件（镜像补丁框架签名）——
未打补丁的框架（含本仓库主线）的 Events 无此成员，hook 分支否则无法通过类型检查；
框架日后合并钩子时应删除该 shim（相同签名合并为无害重复 overload）。

**测试约定**：`tests/plan-a.spec.ts` 的 3 个 hook 依赖用例标了 `it.skip`
（需打补丁框架，本仓库主线无钩子）；路线 B/C 用例全活。新增 `tests/intercept.spec.ts`
（buildSeedMessages 单测）与 `tests/intercept-e2e.spec.ts`（装配：注入形态/log 干净/
每请求一致/purpose 与 hand-built 过滤/subagent 过滤/fork 回归）。

## 0.2 Changelog 2026-08-19：面板「第一条消息看不到注入请求」定论 + dock 完整列表

**现象**：用户开监听后发第一条真实消息，面板只看到 `#2 [session-title]`（无注入），
看不到带注入的对话请求；第二条消息起才看到 `#3`（带注入）。**模型侧注入一直正常**
（模型回复能引用种子内容）。

**排查过程（三轮）**：
1. 第一轮误判为 session-title 干扰 → 加 `purpose` 字段区分请求（保留为正式能力）；
2. 第二轮加服务端 waterfall trace（`src/trace.ts`，写 `~/.dsh/logs/cfcp-trace.log`）
   证明 **#1 对话请求确实进了 ring**（entry=1, msgs=7, seed 标记为真）——采集层无丢失；
3. 第三轮锁定 UI 缺陷：dock 展开区**只渲染 latest 一条**请求，而 #1（对话+注入）与
   #2（title）相隔仅 2ms，latest 永远是 #2，#1 被 UI 折叠遮蔽。

**修复**：`Dock.tsx` 展开区从单条改为**完整请求列表**（`requests.map`，每条一行、
最新默认展开 `open={request === latest}`）；行内显示 `#序号 · [purpose] 模型 · 消息数 · 时间`。
删除不再使用的 requestSummary 单条渲染。临时 trace（trace.ts、poll.ts console.log、
index.ts/panel.ts trace 调用）在验证通过后已全部移除。

**派生结论（设计行为，非 bug）**：`[session-title]` 辅助请求**不含**注入是 C 路线
scope 过滤的正确行为（`purpose !== undefined` 即放行）——避免污染标题生成与浪费 token。
首条消息触发「对话 + title」两个请求，面板应看到两个条目，只有对话那条带注入。

**构建坑（重要，构建产物相关）**：per-package `pnpm exec tsdown`（entry 指向 `src/`）
会绕过根 workspace 构建的装饰器 lowering，产出**裸 `@Remote(`** 的 `lib/index.js`
（Node 无法解析，web 起不来）——这正是 §1.1 记录的坑。**正确构建方式**：仓库根
`pnpm run build:lib:host`（tsc + tsdown workspace 模式 + typertPlugin），
包级 `tsdown.config.ts` 已删除以防再次误用。构建后必须跑 `verify-build.ps1` 五项门禁
（本次正是门禁 #2「无裸 @Remote」拦住了坏产物），并删除未被 index.js 引用的
stale `seed-*.js` chunk（`clean: false` 堆积）。



## 1. Web 拉起阻碍（fail-loud 的各类根因）

### 1.1 裸装饰器语法（Node 解析失败）

- 现象：web 启动即崩；Node 报对 `lib/index.js` 的 **parse 错误**（`@Remote(...)` 裸露）。
- 根因：rolldown/tsdown **从 `src` 直接打包**时不会执行 TC39 装饰器转换，`@Remote('name')`
  原样留在 ESM 产物里，Node 先解析后执行，无法加载。
- 解法：
  - tsdown 入口指向 **tsc 产物** `lib/types/*.js`（tsc 负责装饰器转换），并 `clean: false`
    保留 tsc 输出；
  - tsconfig **不要**开 `experimentalDecorators`——legacy 转换会让 Typert 在**运行时**抛
    `Remote decorators require a public instance method with a string name`（编译期不报，
    误导性强）。
- 门禁：`verify-build.ps1` 第 2 项（无裸 `@Remote(`）与第 3 项（入口 import 冒烟）。

### 1.2 Typert 生成产物 / 依赖缺失

- 现象：web 启动到 typert-loader 阶段报 `ERR_MODULE_NOT_FOUND`。
- 根因：lib 缺少 Typert 生成的 `typert.host.js` / `typert.remote-client.js`，或依赖链中
  `zod` 不可解析（`typert.host.js` 运行时依赖 zod）。
- 解法：构建产物必须含 5 类文件：`index.js`、`invariant.js`、`seed-<hash>.js`、
  `typert.host.js`、`typert.remote-client.js`（`verify-build.ps1` 第 5 项）；
  `<folder>/node_modules` junction 到部署的 `profiles/node_modules`（该目录含 zod 与 dsh
  全家桶），或明确提供可解析 zod 的依赖根。
- 注意：**面板包 `client-ui/` 无需依赖**——其浏览器 bundle 已内联 zod 与 Remote 贡献。

### 1.3 同 id 重复 insert（patch 叠加）

- 现象：web 起不来，loader/组合报**重复 id**。
- 根因：同一插件 id 同时出现在 **web bundle 自带 patch**（只有从含该行的主线构建的
  web-app 才自带 `- id: ui-custom-first-control-prompt`）与 **profile patch**
  （`<DSH_HOME>/profiles/web/cordis.patch.yml`）。
- 解法（关键）：
  - **npm 0.1.x 发布物 bundle 不带面板行**（实测 rc.6 亦无）→ profile 默认写
    「核心插件行 + 面板行」两行（`cordis.patch.yml.template` 即此形态）；
  - **仅当**部署 bundle 确认自带面板行（本地主线构建的 web-app）时，profile 才删掉
    面板行，只保留核心插件行（`profile-web.patch.yml` 即此形态）。
- 简化经验：核心行只出现一次（profile 或 bundle 二选一），面板行同理。

### 1.4 dsh 版本错位

- dsh 老线（npm `latest`，0.0.1-rc.x）缺 Typert Remote 线路与相关槽位，本插件不兼容；
  必须是 **`next` 线**（0.1.x，当前 0.1.0-rc.6；注意 0.1.0-rc.5 **未发布到 npm**）。
- 确认：`<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-web-app/package.json` 的
  `version` 是否 0.1.x。
- **完全版钩子只在主线构建**：`agent-loop/session-seed` 钩子仅存在于包含
  `b1601bec35` 提交的主线构建（如从 dsh 仓库本地构建的部署）；**npm 0.1.x 发布物
  （含 rc.6）实测均无此钩子**（解包检查 `createAgent` 与 rc.5 相同）。npm 部署要
  完全版需打 `patches/framework-planA-rc5.patch`（或适配对应版本的补丁）并重建框架，
  否则自动落基础档（帧）。本机"两处验证过"指：含钩子的仓库构建部署（完全版）与
  测试 home（同构建）。

## 2. 插件行为 / 前端问题

### 2.1 种子 `assistant/message` 缺 `turn`/`step` → 前端崩溃 + 「加载历史」挂起

- 现象：新会话控制台报
  `conversation Definition "assistant-step" published invalid turn undefined`；
  会话历史加载卡死。
- 根因：web 组装器读 `event.data.turn` / `event.data.step` 定位 assistant-step；
  真实 `assistant/message` 数据形状是 `{ turn, step, message, usage? }`（见
  agent-loop 的 step 输出），种子缺少即崩。
- 解法：`buildSeedEvents` 的 assistantData 必须带 `turn`/`step`；
  `verify-build.ps1` 第 4 项检查 **index.js 实际引用**的 seed chunk 含
  `assistantData = { turn,` 与 `turn, step,`（不是任意一个 seed-*.js——陈旧 chunk 会骗过检查）。

### 2.2 种子 user 消息渲染成「注入上下文」而非用户气泡

- 现象：新会话显示成「两条助手文本 / 上下文行」，用户侧不像普通用户气泡，观感像伪造。
- 根因：web 渲染器按 `source.kind` 分类：`'user'` → 普通用户气泡；
  `'plugin'`（含本插件）→ 注入上下文行。
- 解法：对话式种子的 user 消息用 `source.kind: 'user'`（role 仍为 user，会话边界不拦）；
  **assistant 侧保留 `source.kind: 'plugin'`**——会话边界只接受 model 或 plugin 来源的
  assistant，且渲染器不要求其具备 model 字段。

### 2.3 伪造声明文本（"did not occur in this session"）

- 该字符串只存在于 `src/seed.ts` 的 `TRANSCRIPT_FRAME_INTRO`（`<custom-history>` 框架路径：
  基础档 / `reapply`、`per-request` 的压缩回退 / 旧会话残留）。
- 对话式种子（`session-start`）不生成该文本：新会话的"参考历史"就是前排真实交替消息，
  模型不会被明示「会话是伪造的」。
- 已注入过框架的**旧会话**日志残留属历史数据，不会自动消失；如需验证请用新会话。

### 2.4 重复播种（resume/fork 后参考历史翻倍）

- 根因：`hasSeededHistory` / `latestSeededSeq` 若只认 **user 侧 plugin 来源**，而对话式
  种子 user 侧已改为 `kind:'user'`，检测会失效 → resume/fork 再次播种。
- 解法：检测同时认两种事件形状——`user/message` 的 `data.source` 与
  `assistant/message` 的 `data.message.source`，plugin 来源命中即视为已播种
  （assistant 侧 plugin 来源是持久标记）。

### 2.5 Typert Remote 命名空间读取（inject 门控）

- 面板服务以 `super(ctx, 'custom-first-control-prompt-panel')` 注册命名空间子服务；
  客户端**不要**用 `ctx.remote.<ns>` 属性访问（被 inject 门控，未声明取不到），而是
  `ctx.get('remote.<ns>')`（可选存在性判断；缺失时折叠为统一错误结果，界面降级不崩）。
- Typert 装饰器必须用 **TC39 标准形** `(value, context)`；`experimentalDecorators`
  编译能过但运行时报「Remote decorators require a public instance method」。

## 3. 分发 / 构建踩坑

### 3.1 仓库与分发目录 lib 分叉

- tsdown `clean: false` 会**堆积陈旧 `seed-<hash>.js`**；若镜像不完整，分发目录的
  `index.js` 可能引用旧 chunk（例如旧构建不含 turn/step）。
- 解法：每次构建后整目录镜像，再跑 `verify-build.ps1` 第 4 项（检查 index.js **实际引用**
  的 chunk 内容）。

### 3.2 沙箱 / 审批

- 受限文件沙箱下 `tsdown` 写仓库目录会被拒（EACCES），而 `tsc` 可能因增量跳过而"假成功"；
  构建命令需要仓库目录的写入权限。
- 沙箱禁用审批时，被拒即失败，**不要绕路径**（例如受限沙箱下用管道捕获外部程序输出会因
  命名管道被禁而报 EPERM——该拒绝是文档化边界，不做变通重试）。

### 3.3 PowerShell 细节（写运维脚本时）

- 参数名不要叫 `$Home`（只读内置变量会吞掉赋值）→ 用 `-DshHome`。
- 删除 junction 用 `[System.IO.Directory]::Delete($link, $false)`（`Remove-Item` 在
  junction 上出现过 `NullReferenceException`）。
- 启动测试 web 用**后台任务 + 轮询端口**；`Start-Job` 在旧 PowerShell 下不可靠。
- 进程被强杀时退出码显示为 1（无 signal 标记），需与真实命令失败区分。

## 4. 测试方法

### 4.1 构建门禁（每次改源码后必跑）

```
powershell -ExecutionPolicy Bypass -File <folder>\verify-build.ps1        # 快速 5 项
powershell -ExecutionPolicy Bypass -File <folder>\verify-build.ps1 -Full  # + 测试 home E2E
```

五项语义：① 所有 lib/*.js 按 ESM 语法检查；② 无裸 `@Remote(`；③ 入口 import 冒烟
（装饰器运行时校验 + 依赖解析）；④ 种子 assistant 事件带 turn/step（检查实际引用的
chunk）；⑤ typert 生成产物齐全。`-Full` 在独立测试 home（不同端口）起 web，经 API
`session.create` + `session.history` 校验种子形状。

### 4.2 单测（仓库内）

```
pnpm vitest run <repo>/packages/context/custom-first-control-prompt/tests/plan-a.spec.ts \
  <repo>/packages/context/custom-first-control-prompt/tests/custom-first-control-prompt.spec.ts \
  <repo>/packages/context/custom-first-control-prompt/tests/invariant.spec.ts
```

覆盖：对话式种子瀑布、三种 historyMode、`hasSeededHistory`（含形状重建）、
companion invariant 的种子消息校验。

### 4.3 独立测试实例 + API 手动链路（含真实模型）

1. 准备独立测试 home（含 web profile 与插件 junction，patch 与正式部署相同），
   `pnpm dsh web --port 309x` 指向测试 home；等待 `/` 返回 200。
2. `session.create` → 取 `sessionId`。
3. `session.history` → 断言种子：user 消息 `source.kind == 'user'`；assistant 消息带
   `turn`/`step`；轮次 1..N 闭合（`turn/start` 一次、`turn/end` 一次）。
4. `session.prompt` 发真实消息（如「请逐字引用本会话一开始出现的两段对话」），等待回复：
   **若回复引用种子内容 → 第一条真实消息的请求已含参考历史**（首条注入成立）。
5. 面板 LLM 监听（输入框上方 dock 或设置页「LLM 监听」tab 点「开始」）可直接查看真实
   请求明文，用于比对该链路结论。

请求体示例（PowerShell，端口与 id 为占位）：

```powershell
$body = @{ type='client-request'; rpcId='v1'; method='session.create'; payload=@{ cwd='<workspace>' } } | ConvertTo-Json -Depth 5
Invoke-WebRequest -Uri "http://127.0.0.1:309x/api/session.create" -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing

# history / prompt 同理：method='session.history', payload=@{ sessionId='<session-id>' }
#                     method='session.prompt',  payload=@{ sessionId='<session-id>'; mode='queue'; content=@(@{type='text'; text='…'}) }
```

### 4.4 超大会话

几十万事件的会话「加载历史」慢或挂起是**前端渲染性能问题**，不是本插件 bug；
验证与压测请用小会话。历史大的既有会话不要当作插件回归样本。

## 5. 应急恢复

- 屏蔽插件：`<DSH_HOME>/profiles/web/cordis.patch.yml` 删除核心行（或 `disabled: true`），
  热重载或重启即恢复。
- 逃生 profile：`pnpm dsh --profile web-safe web`（不含本插件的已发布组合）。
- 版本固定：每个里程碑在仓库打本地 git tag（修复前/后各打一个），可随时回滚构建产物并
  重新镜像分发目录。

## 6. 疑难现象速查表

| 现象 | 最可能根因 | 处置 |
|---|---|---|
| web 起不来，Node parse 错误 | 裸 `@Remote(`（从 src 打包） | 改从 tsc 产物打包（§1.1） |
| web 起不来，`ERR_MODULE_NOT_FOUND` | typert 产物缺失 / zod 不可解析 | 补产物 / 依赖 junction（§1.2） |
| web 起不来，客户端包解析失败 | 只装了核心包，bundle 自带面板行解析不到 `client-ui/` | **两包必须同装**（INSTALL.md §0 铁律） |
| web 起不来，重复 id | profile 与 bundle 重复 insert | 面板行按部署形态：npm 发布物默认写、bundle 自带时删（§1.3） |
| 新会话前端崩溃 / 历史挂起 | 种子 assistant 缺 turn/step | buildSeedEvents 补齐（§2.1） |
| 两条助手文本不配对 | 种子 user 侧 plugin 来源 | user 侧改 `kind:'user'`（§2.2） |
| 会话里出现伪造声明 | 框架路径/旧会话残留 | 用新会话验证（§2.3） |
| resume/fork 历史翻倍 | 检测只认 user 侧 | 形状重建检测（§2.4） |
| 面板调不通 | `ctx.remote.<ns>` 门控 | 改 `ctx.get('remote.<ns>')`（§2.5） |
| 分发 lib 与仓库不一致 | 陈 chunk / 镜像不全 | verify-build 第 4 项（§3.1） |