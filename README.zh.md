# @wm-coders/dsh-custom-first-control-prompt

[English](README.md) | 中文

部署方配置的提示词前缀。有序的系统提示词段渲染在部署 persona 之前，配置的 user/assistant 参考对话被注入到**每一个普通对话请求**中——作为真实的交替 user/assistant 消息前置在请求路径上（`llm/stream` 请求拦截，会话日志零写入）。静态内容在每次请求中逐字节一致地渲染，从而保持前缀缓存复用。

## 安装

```bash
# 从 GitHub 安装（推荐 — 构建产物已提交，无需构建审批）
dsh plugin --profile web add github:WM-CODER/custom-first-control-prompt

# 从 npm 安装
dsh plugin --profile web add @wm-coders/dsh-custom-first-control-prompt

# 从本地目录安装（开发用）
dsh plugin --profile web add ./path/to/custom-first-control-prompt
```

安装后重启 web 应用（`dsh --profile web` 或运行 `restart-web.ps1` / `restart-web.sh`）。

卸载：

```bash
dsh plugin --profile web remove @wm-coders/dsh-custom-first-control-prompt
```

> 安装 / 部署 / 调试中遇到过的阻碍与测试方法见
> [DEBUG-NOTES.zh.md](DEBUG-NOTES.zh.md)（web fail-loud 根因、同 id 重复 insert、
> API 验证链路等，路径全部脱敏）；一键安装见 [INSTALL.md](INSTALL.md)；
> 跨机完整实测流程见 [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md)。

## 配置

```yaml
- id: custom-first-control-prompt
  name: '@wm-coders/dsh-custom-first-control-prompt'
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
| `history` | — | 注入到每个普通对话请求的有序 `user`/`assistant` 参考对话；两者文本都必须非空，且不得包含保留标签（大小写不敏感：`<user>`、`<assistant>`、`<exchange>`、`<custom-history` 及所有闭合标签）。缺省或为空时不注入。 |
| `includeSubagents` | `false` | `false` 时跳过 header meta 标记为 subagent 来源的会话。 |

配置错误会使插件加载失败并指明出错条目：文本为空、section 重名或 order 非有限数。`sections` 的逐条问题（空名/重名/坏 order/空文本）与 `history` 的逐对问题（空文本/内嵌保留标签）会**降级为跳过该条并告警**，不会拖垮整个插件树。

## 注入机制

参考对话在插件加载时一次性构建为交替的真实 `Message` 对象（深冻结、跨请求共享引用），随后在每个普通对话请求上由 `llm/stream` waterfall 监听器前置注入：

- **克隆重分发**：循环构建的请求是深冻结且带 loop 标记的（`markAgentLoopRequest(deepFreeze(...))`），从不被修改；监听器克隆请求、前置种子消息、经 `ctx.llm.stream` 重新分发。克隆体无 loop 标记，agent-loop 的日志重建不变式不适用于它，被丢弃的原请求只是 `deriveMessages()` 的纯投影。
- **零日志写入**：种子消息只存在于请求路径，不进会话日志——真实 turn 编号从 1 开始无冲突、fork 是普通副本、压缩无法遮蔽参考历史（每个请求都重新注入）。
- **范围过滤**：辅助调用（`purpose` 标记，如 session-title、compaction）与手工构造请求（无 `sessionId`）直接放行不注入；subagent 来源会话默认跳过（`includeSubagents: true` 开启）。
- **面板验证**：聊天 transcript 看不到种子消息是预期行为；用面板「LLM 监听」直接查看注入后的真实请求（设置 → 「自定义优先控制提示词」→ LLM 监听，或对话输入框上方的 dock 条）。

**验证注入生效**：新建会话并提问一个只有注入历史才能回答的问题（如「重复我们最早的那条用户消息」），模型答出配置内容即生效；`session.history` 里看不到种子消息（日志干净是特性而非故障）。

**面板保存的语义**：面板「配置编辑」保存向 profile `cordis.patch.yml` 写入**带 id 的定向覆盖**（非 insert，绝不与 bundle 层的行撞 id），只更新本插件核心行（`custom-first-control-prompt`）的配置，**保留文件里其它所有内容**——其它条目、注释、以及旧安装遗留的行。profile 无本插件行时，编辑器显示当前生效的组合配置（bundle 层默认值），保存即生成覆盖。

## 系统段

每个启用的条目在插件加载时通过 `ctx.systemPrompt.section()` 注册，因此与出厂段完全一样参与每次组装：变量插值、scope 遮蔽与组装 waterfall 全部适用。静态配置文本在每次组装中渲染结果一致，这正是请求前缀保持可复用的原因。

## 模型体验

### 部署系统段

#### 模型所见

配置段的文本按各自配置的 order 位置渲染——默认在 persona 之前——由 [dsh-system-prompt](https://github.com/deepseek-ai/deepseek-harness) 与出厂段一起渲染。

#### Token 影响

每个段在每次请求中重复出现，开销随渲染长度伸缩。

#### KV 缓存影响

段文本、order 与启用集合渲染一致时前缀稳定。任何变化都可能从首个变化的系统提示词 token 起破坏复用。

### 参考对话历史

#### 模型所见

每个普通对话请求的消息序列头部出现真实的交替消息——每个配置的 `user` 文本一条 user 消息、每个配置的 `assistant` 文本一条 assistant 消息：

```markdown
[user]      configured user text 1
[assistant] configured assistant text 1
[user]      configured user text 2
[assistant] configured assistant text 2
[user]      the real prompt…
```

#### Token 影响

每请求固定 1 份参考对话（不随轮次累积，压缩也不影响——每个请求重新前置同一份冻结消息序列）。

#### KV 缓存影响

参考对话放在消息序列首位且字节稳定，请求前缀保持可复用。

## 已知限制与延后工作

- **聊天界面看不到参考历史** — 种子只存在于请求路径，会话 UI 既不显示交替消息也不显示框架行；模型可见内容的重建需要会话日志 + 部署配置（框架没有插件事件类型注册面，`Session.append` 也无法携带 `ignorable` 信封），这是对 harness 日志重建默认原则的有意偏离，已在此声明。
- **种子文本是模型可见的参考材料** — 部署方应将其视为模型读取的提示词文本，而非可信通道。
- **不支持会话中段修改** — 配置变更在 web 重启后对新请求生效；合规的"静止时编辑"应追加带 source seq 引用的 surface 替换事件，已延后。

## FAQ：面板 UI 与插件行是怎么进入组合的？

核心包声明了 `dsh.bundle`（包内 `cordis.patch.yml`），`dsh plugin add` 的对账会把这个
bundle 层激活进组合——**核心行 `custom-first-control-prompt`（服务端逻辑：系统段、
参考历史注入）与面板行 `ui-custom-first-control-prompt`（浏览器 UI：设置页、dock、
LLM 监听）一起出现**，无需手写任何 patch 行。卸载 `dsh plugin remove` 会把依赖与
bundle 层一起移除。

- **自定义配置**：不要复制 `- insert:` 行。在 profile 的 `cordis.patch.yml` 写
  **带 id 的定向 patch**（非 insert）覆盖 bundle 行的 config（后写胜出），样例见
  `cordis.patch.yml.template`；面板「配置编辑」保存生成的正是这种覆盖。
- **离线 junction 安装**没有经过对账，bundle 层不会激活——`install.ps1 -Offline`
  会把同样的两行写进 profile patch 代替。
- **重复 id 警告**：bundle 层已带这两行后，profile patch 里若还有旧安装遗留的
  `- insert:` 同 id 行 = **根列表重复 → web fail-loud 起不来**；`uninstall.ps1`
  会外科式清理这两种残留。
