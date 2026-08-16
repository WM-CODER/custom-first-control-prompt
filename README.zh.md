# @deepseek-ai/dsh-custom-first-control-prompt

[English](README.md) | 中文

部署方配置的提示词前缀。有序的系统提示词段渲染在部署 persona 之前，配置的 user/assistant 参考对话在首个 turn 之前一次性注入会话日志。静态内容在每次请求中逐字节一致地渲染，从而保持前缀缓存复用。

> 安装 / 部署 / 调试中遇到过的阻碍与测试方法见
> [DEBUG-NOTES.zh.md](DEBUG-NOTES.zh.md)（web fail-loud 根因、同 id 重复 insert、
> 种子消息 turn/step、API 验证链路等，路径全部脱敏）；一键安装见 [INSTALL.md](INSTALL.md)；
> 跨机完整实测流程见 [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md)（含 npm 部署打框架补丁的
> 完全版改造），方案分析见 [PLAN-A-REVISED.md](PLAN-A-REVISED.md)。

## 配置

```yaml
- id: custom-first-control-prompt
  name: '@deepseek-ai/dsh-custom-first-control-prompt'
  config:
    sections:
      - name: house-rules
        order: -50
        text: |
          …stable system text…
    history:
      - user: …
        assistant: …
    includeSubagents: false
```

| 键 | 默认值 | 含义 |
|---|---|---|
| `sections` | — | 有序的系统提示词片段。缺省或为空时不注册任何内容。 |
| `sections[].name` | 必填 | 条目名；注册表所见为 `custom-first-control-prompt:<name>`。 |
| `sections[].order` | 必填 | 在全部段中的渲染位置。出厂约定：harness identity 为 −100，persona 为 0，工具指导为 100–199；小于 0 的值前置到 persona 之前。 |
| `sections[].enabled` | `true` | `false` 时条目保留在配置中但不注册。 |
| `sections[].text` | 必填 | 静态段文本。不要放入时间戳等易变值：任何变化都会从首个变化的 token 起破坏前缀复用。 |
| `history` | — | 在首个 turn 之前注入的有序 `user`/`assistant` 参考对话；两者文本都必须非空，且不得包含框架保留标签（大小写不敏感：`<user>`、`<assistant>`、`<exchange>`、`<custom-history` 及所有闭合标签），因为内嵌标签会破坏框架向模型承诺的对话结构。缺省或为空时不注入。 |
| `includeSubagents` | `false` | `false` 时跳过 header meta 标记为 subagent 来源的会话。 |
| `historyMode` | `reapply` | 参考对话的应用模式，见下方「预置历史」。 |
| `seedMode` | `hook` | 对话式种子的注入机制：`hook`（A 路线，框架 `agent-loop/session-seed` 种子边界，需含钩子的主线构建）或 `append`（B 路线，`agent/session-start` + `Session.append()`，**不依赖框架钩子/补丁，npm 0.1.x 部署可用**）。见「对话式种子机制（B 路线）」。 |
| `reapplyAfterCompaction` | — | 兼容别名：`true` 映射为 `historyMode: 'reapply'`，`false` 映射为 `'session-start'`；显式 `historyMode` 优先。 |

配置错误会使插件加载失败并指明出错条目：角色不成对、文本为空、section 重名或 order 非有限数。

## 对话式种子机制（B 路线）

会话开始的参考历史默认走 **A 路线**（`agent-loop/session-seed` 钩子，在会话创建时经 `sessions.prepare` 种子边界进入日志）。npm 0.1.x 发布物（含 rc.6）**实测无此钩子**，此时默认落到**基础档（`<custom-history>` 帧）**。

**B 路线（`seedMode: "append"`）** 让 npm 部署**不修改框架**也能拿到对话式完全版：`seedMode` 取 `append` 时，插件在 `agent/session-start` 用 `Session.append()` 把每对参考历史写成**真实闭合的交替 user/assistant 消息**（与 A 路线同款气泡与模型体验），并**不再注册钩子监听、不做 pre-step 帧回退**（本模式只做会话开头的这一次注入；`historyMode` 在 `seedMode: "append"` 下被忽略）。

**面板启用**：设置 → 「自定义优先控制提示词」→ 配置 tab → 「对话式种子机制」下拉选 **Append (route B)** 并保存。首次打开若显示 A/hook，说明客户端缓存了旧资源——**硬刷新**（Ctrl+Shift+R）后即正确。

**验证是否有 B 在生效**：新建会话，调 `session.history`——种子轮次应排在 `permission/preset` 等系统事件**之后**，且整个日志**没有 `session/end-seed`**（A 路线有该边界标记）。

**已知限制**：
- **fork 含种子会话会失败**（无 seed 边界放宽的框架）：fork 会把父日志前缀作为子会话 seed 传入 `sessions.prepare`，被边界校验拒绝。需要 fork 请用 A 路线（打框架补丁或等含钩子/放宽的主线构建）。
- **turn 编号重复**：B 的种子在 `session-start` 才 append，真实首轮从 `turn:1` 独立开始，日志里种子 `turn:1/2` 与真实 `turn:1/2` 撞号；不影响模型消息顺序，但前端按「轮次」分组/统计会出现两个「轮次 1」。

## 系统段

每个启用的条目在插件加载时通过 `ctx.systemPrompt.section()` 注册，因此与出厂段完全一样参与每次组装：变量插值、scope 遮蔽与组装 waterfall 全部适用。静态配置文本在每次组装中渲染结果一致，这正是请求前缀保持可复用的原因。

## 预置历史

会话创建时，插件通过 `agent-loop/session-seed` 瀑布为每对配置贡献**一轮完整闭合的平衡 turn**，模型看到的是**真实的 user/assistant 交替对话消息**，而非单条框架文本。`historyMode` 决定的是**压缩遮蔽后的回退**：

| 模式 | 创建时种子 | 压缩遮蔽后回退 | Token | 压缩免疫 |
|---|---|---|---|---|
| `session-start` | 对话式 turn | 无 | 固定 1 份 | 否（可能被遮蔽） |
| `reapply`（默认） | 对话式 turn | 最新种子帧被遮蔽后，下一请求注入一条 transcript 框架 | 固定 1 份 | 是（遮蔽后下一请求自动补回） |
| `per-request` | 对话式 turn | 每次模型请求都前置注入一条新框架（随 step 持久化） | 压缩间隔内随轮次累积 | 是（最彻底） |

> **框架含钩子时的真实行为（实测）**：`agent-loop/session-seed` 监听器在任何模式下都
> 无条件注入对话式种子；`reapply`/`per-request` 的 pre-step 逻辑仍会叠加注入帧——
> 即钩子部署 + `reapply`/`per-request` = **对话式种子 + 每请求一帧**（内容重复、
> token 翻倍）。因此**钩子部署下请用 `session-start`**（纯对话式，靠 `hasSeededHistory`
> 挡掉帧回退）。框架无钩子（npm 0.1.x 发布物）时无此问题，仅走帧路径/基础档。

`reapply` 是推荐默认：对话式种子轮次留在派生历史中直到被压缩遮蔽；此后下一请求注入一条新 transcript 框架（单条 user 消息）并保持 1 份。框架回退即原 transcript 格式，因此压缩前请求显示真实对话角色，压缩后请求仍可读。`session-start` 模式下监听器会扫描日志中是否已有本插件的注入，resume 与 fork 不会重复。

## 模型体验

### 部署系统段

#### 模型所见

配置段的文本按各自配置的 order 位置渲染——默认在 persona 之前——由 [dsh-system-prompt](../../core/system-prompt/README.md) 与出厂段一起渲染。

#### Token 影响

每个段在每次请求中重复出现，开销随渲染长度伸缩。

#### KV 缓存影响

段文本、order 与启用集合渲染一致时前缀稳定。任何变化都可能从首个变化的系统提示词 token 起破坏复用。

### 预置对话历史

#### 模型所见

第一条真实 prompt 之前出现真实的交替消息——每个配置的 `user` 文本一条 user 消息、每个配置的 `assistant` 文本一条 assistant 消息：

```markdown
[user]      configured user text 1
[assistant] configured assistant text 1
[user]      configured user text 2
[assistant] configured assistant text 2
```

压缩遮蔽种子轮次后，`reapply` 与 `per-request` 回退为 transcript 框架格式（单条 user 消息）：

```markdown
<custom-history source="custom-first-control-prompt">
The following exchanges are deployment-configured reference history; they did not occur in this session.
<exchange>
<user>configured user text</user>
<assistant>configured assistant text</assistant>
</exchange>
</custom-history>
```

#### Token 影响

`reapply` 与 `session-start` 模式为每请求固定 1 份参考对话；`per-request` 模式每轮追加一条持久化框架，压缩间隔内请求携带多份，直到压缩吸收较早的框架。

#### KV 缓存影响

三种模式都把参考对话放在消息序列首位且字节稳定，请求前缀保持可复用；`reapply` 与 `per-request` 不受 compaction 影响，`session-start` 的复用持续到 compaction 之前。

## 已知限制与延后工作

- **框架钩子仅在主线构建** — `agent-loop/session-seed` 钩子只存在于包含 `b1601bec35`
  提交的主线构建；**npm 0.1.x 发布物（含 rc.6）实测无此钩子**，此类部署自动落基础档
  （帧）。要完全版需打框架补丁（见 [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md) 步骤 B）。
- **钩子部署下请用 `session-start`** — 见「预置历史」注释：钩子存在时 `reapply`/
  `per-request` 会对话式种子与帧双重注入。
- **不支持会话中段修改** — `reapply` 与 `per-request` 模式下配置变更对下一个请求即时生效；`session-start` 模式只对新会话生效。合规的"静止时编辑"应追加带 source seq 引用的 surface 替换事件，已延后。
- **compaction 可能遮蔽持久 seed** — 仅当 `historyMode: 'session-start'` 时成立：对话式种子轮次是普通 surface 内容，compaction 之后可能从派生历史中消失，而系统段仍然保留。`reapply` 与 `per-request` 免疫此问题并回退到 transcript 框架。
- **`per-request` 会随请求轮次累积持久化框架** — 种子被遮蔽后，每轮请求都会在日志中追加一条框架 `user/message`；较早的框架随后会被 compaction 吸收，但压缩间隔内的请求会携带多份参考对话（Token 成本随轮次线性增长，直到压缩）。需要固定成本请用 `reapply`（默认）。
- **种子轮次占用轮次编号** — 对话式种子占用第 1..N 轮，第一个真实轮次从 N+1 开始。展示轮次编号的界面会看到偏移。
- **预置文本是模型可见的参考材料** — 框架已声明这些对话并未真实发生，但部署方应将其视为模型读取的提示词文本，而非可信通道。
