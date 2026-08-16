# @deepseek-ai/dsh-client-ui-custom-first-control-prompt

`custom-first-control-prompt` 核心插件的网页面板界面。本包是面板的**浏览器半边**：只负责 UI，不持有任何业务状态。所有数据——profile patch 配置、捕获的请求环形缓冲、dock 可见性——都存放在宿主端的 `PanelService` 中，通过 Typert Remote 命名空间 `custom-first-control-prompt-panel` 传输。

## 界面

- **输入框上方 dock 条**（`conversation.input.dock`，id `cfcp`）：位于消息输入框上方、可折叠的条状面板。实时显示 LLM 请求监听状态（默认**关闭**）、请求数量、以及最近一次捕获的纯文本请求；开始/停止、清空、隐藏按钮都在这里。被隐藏的条可以通过设置里的插件卡片重新打开。
- **设置页**（`settings.section`，id `cfcp-prompt`）：四个标签页——
  - **预览**：当前真正组装进系统提示词的段落。
  - **配置**：编辑段落、参考历史对话、子代理开关、历史应用方式；可保存或清空（插件本身保留安装）。
  - **RAW**：完整的 `cordis.patch.yml` 文本与导入。
  - **LLM 监听**：开始/停止、清空，以及捕获的请求环形缓冲（来自 `llm/stream` 的真实纯文本请求）。
- **插件卡片**（`settings.plugin.item`）：dock 条可见性与监听开关，附带实时请求数量。

## Remote 接口

所有操作都来自宿主端面板服务（Typert 生成），每次调用都需要指明所属会话：

```ts
const result = await ctx.remote['custom-first-control-prompt-panel']['config-read'](sessionId)
if (result.ok) use(result.value) else show(result.error.message)
```

本包只依赖核心插件的类型——浏览器打包产物中不包含任何运行时代码引用。
