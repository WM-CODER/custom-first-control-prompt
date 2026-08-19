# 单文件夹安装手册（给 AI 的安装说明）

目标：用户把**本文件夹**交给 AI 并说「安装」后，AI 在目标机器的 dsh web 部署上完成：
1. 核心插件（`@wm-coder/dsh-custom-first-control-prompt`）安装 —— 持久，重启不丢；
2. 管理面板（正式客户端包 `@wm-coder/dsh-client-ui-custom-first-control-prompt`，位于 `client-ui/`）安装 —— 持久，**web 重启后仍在**，无需重装。

**给 AI 的默认决策（照此执行，无需询问用户）**：先跑 `install.ps1`（或手动执行
方式 A 的两条命令）；装完直接可用——核心包自带 bundle 层（`dsh.bundle` 声明），
`dsh plugin add` 的对账会**自动激活核心行 + 面板行**（含中性示例配置），
**不需要手写任何 patch 行**；验证按 1.4 走面板「LLM 监听」。自定义配置用
`cordis.patch.yml.template` 的**带 id 定向覆盖**（或面板「配置编辑」），
**绝不**在 profile patch 里复制 `- insert:` 行（同 id 重复会让 web 起不来）。

> 安装/调试踩过的问题与测试方法见同目录 [DEBUG-NOTES.zh.md](DEBUG-NOTES.zh.md)
> （含「同 id 重复 insert 会让 web 起不来」等关键坑的根因与规避）；
> 另一台机器的完整实测流程见 [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md)。

## 获取插件（从远端仓库）

本插件以单仓库形式发布在 GitHub `WM-CODER/custom-first-control-prompt`：
内容已做脱敏处理（不含任何机器的用户名、绝对路径、凭据或会话标识）。两种获取方式：

```powershell
# 方式 1：git clone（推荐，可 git pull 跟进更新）
git clone https://github.com/WM-CODER/custom-first-control-prompt.git
# 方式 2：GitHub 页面 Code → Download ZIP，解压后得到同一目录
```

后续步骤中的 `<folder>` 一律指克隆/解压得到的目录。注意：获取到的目录
**不含 `node_modules`**（依赖链是本机安装态，见 1.1）也**不含构建缓存**
（sourcemap / tsbuildinfo 不入库）；核心插件产物 `lib/`、面板包 `client-ui/`、
包内 bundle 层 `cordis.patch.yml`、安装脚本与文档均随仓库分发，自包含。

## 前置条件

- 本机已有可运行的 dsh web 部署（默认 http://127.0.0.1:3080）。
- **dsh 版本要求（关键，跨机器必查）**：部署必须是 **0.1.x 新线**（npm dist-tag `next`，
  当前为 **0.1.0-rc.6**；注意 0.1.0-rc.5 并未发布到 npm）。确认方式：
  `<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-web-app/package.json` 的 `version`。
  老线（`latest`，0.0.1-rc.x）缺 Typert Remote 线路与相关槽位，本插件不兼容；
  请先按 dsh 升级流程把部署升到 `next` 线再继续。
- 本文件夹自包含：核心插件 `package.json` + 构建产物 `lib/`（含 `typert.host.js` 等）+
  bundle 层 `cordis.patch.yml`；客户端包在 `client-ui/`（`lib/client.js` 已构建，
  浏览器 bundle 无 Node 依赖）。本插件未发布 npm——方式 A 走 `dsh plugin add`
  （link 安装），方式 B 走 junction 直接挂载，都不需要发布。
- `DSH_HOME` 默认位于用户目录下的 `.dsh`（Windows：`%USERPROFILE%\.dsh`，Linux/macOS：
  `~/.dsh`）；更通用的推导方式：settings 文档路径（`<DSH_HOME>/settings.yaml`）的父目录
  即 `DSH_HOME`。
- **非 Windows 系统**：以下所有 `New-Item -ItemType Junction` 换成等价的符号链接
  （`ln -s <目标> <链接>`），其余步骤与验证方式完全一致。

### 0. 安装前检查（目标机器必做）

| 检查项 | 方法 | 通过标准 |
|---|---|---|
| dsh 版本为 `next` 线 | 看 `<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-web-app/package.json` 的 `version` | `0.1.x`（当前 `0.1.0-rc.6`）；`0.0.1-rc.x` 老线**不兼容** |
| pnpm 可用（仅方式 A 需要） | `pnpm --version` | 方式 A 的 `dsh plugin add` 依赖它；离线机器用方式 B（junction） |
| 网络（仅方式 A 需要） | — | `dsh plugin add` 会把 peer 声明的 dsh `0.1.x` 包从 registry 解析；离线机器用方式 B |

## 注入机制（安装者需要知道的部分）

`history`（参考对话）在插件加载时构建为深冻结的交替 user/assistant 消息序列，由
`llm/stream` waterfall 监听器前置到**每个普通对话请求**（克隆重分发，npm 0.1.x 开箱即用，
不依赖任何框架钩子/补丁）。会话日志**零写入**：真实 turn 从 1 编号、fork 是普通副本、
压缩无法遮蔽（每请求重新注入）。辅助调用（session-title、compaction）与手工请求不注入。

## 步骤 1：安装（两种方式）

### 方式 A（官方，推荐）：`dsh plugin add`

一条命令（或 `install.ps1` 自动执行）：

```powershell
dsh plugin --profile web add <folder> <folder>/client-ui
# 没有 dsh 命令行别名时用：
node <DSH_HOME>\profiles\node_modules\@deepseek-ai\dsh\lib\bin.js plugin --profile web add <folder> <folder>/client-ui
```

pnpm 把两个包以 link 依赖装进 `<DSH_HOME>/profiles/web`，CLI 对账读取核心包的
`dsh.bundle` 声明，**自动把包内 bundle 层（`cordis.patch.yml`：核心行 + 面板行 +
中性示例配置）激活进组合**——装完即用，无需手写 patch 行。依赖链（1.1）仍需先就位。

### 方式 B（离线 / 无 pnpm）：junction

`install.ps1 -Offline` 一键完成，或手动（1.1/1.2/1.3）。bundle 对账只在
`dsh plugin add` 内运行，junction 路径必须在 profile patch 里自带两行
（install.ps1 会自动追加；等价于 bundle 层内容）。

### 1.1 依赖链（两种方式都需要）

本地安装是 link 依赖：Node 从**被链接目录自己的** `node_modules` 解析插件的
`@deepseek-ai/schemastery`、`zod` 等导入，不会沿 profile 向上找。确认
`<folder>/node_modules` 存在且能解析这些依赖——junction 到部署自己的已发布安装即可
（`install.ps1` 自动做）：

```powershell
New-Item -ItemType Junction -Path <folder>\node_modules -Target <DSH_HOME>\profiles\node_modules
```

标准的 pnpm 部署都有该目录（0.1.x 线含插件全部依赖）。若不存在（非 pnpm 部署形态），
找到部署解析 `@deepseek-ai/dsh-*` 包所用的 node_modules 根目录并 junction 到它即可。
`zod` 是 Typert 生成产物（`lib/typert.host.js`）的运行时依赖，缺失会导致 web 启动在
typert-loader 阶段报 `ERR_MODULE_NOT_FOUND`。`client-ui/` **无需安装依赖**：
浏览器 bundle（`lib/client.js`）已把 zod 与 Remote 贡献内联，其 node 半（`lib/index.js`）为空壳。

### 1.2 方式 B 手动步骤：profile 注册 junction

```powershell
$dir = "<DSH_HOME>\profiles\web\node_modules\@wm-coder"
New-Item -ItemType Directory -Path $dir -Force
New-Item -ItemType Junction -Path "$dir\dsh-custom-first-control-prompt" -Target "<folder>"
New-Item -ItemType Junction -Path "$dir\dsh-client-ui-custom-first-control-prompt" -Target "<folder>\client-ui"
```

### 1.3 方式 B 手动步骤：profile patch 行

junction 模式没有对账，`<DSH_HOME>/profiles/web/cordis.patch.yml` 必须自带两行。
`install.ps1 -Offline` 会自动追加（与 bundle 层同内容）；手动追加时把本仓库根
`cordis.patch.yml` 的 `- insert:` 段并入 profile patch（顶层数组；已有条目则追加）。

> **铁律：两行只出现一次。** 方式 A 装完后 bundle 层已带这两行——此时若 profile
> patch 里还存在**旧安装遗留**的 `- insert:` 同 id 行（如手工时代的残留），
> 必须删掉（否则同 id 重复 → web fail-loud 起不来）。自定义配置永远用
> **带 id 的定向覆盖**（非 insert），见下节。`uninstall.ps1` 会外科手术式清理这两种行。

### 自定义配置（两种方式通用）

安装后想改提示词内容，两个入口等价：
- **面板**：设置 → 「自定义优先控制提示词」→ 配置编辑（保存生成定向覆盖，保留其它行）；
- **手工**：把 `cordis.patch.yml.template` 的内容（带 id 的定向 patch，**非 insert**）
  追加到 profile patch 并改成自己的内容。覆盖语义：同 id 的 config 后写胜出。
- 临时停用：覆盖里写 `disabled: true`；彻底卸载：`dsh plugin --profile web remove
  @wm-coder/dsh-custom-first-control-prompt @wm-coder/dsh-client-ui-custom-first-control-prompt`
  （或 `uninstall.ps1`，会连带清理 junction 与 patch 残留）。

配置类变更（cordis.patch.yml）走 HMR 热重载（几秒），**无需重启**。

### 1.4 验证（面板「LLM 监听」）

聊天 transcript **看不到**种子消息是预期行为（注入只走请求路径，零日志写入）。正确验证方式：
1. 对话输入框上方展开「自定义提示词」dock 条，点「开始」监听；
2. 新开会话发送第一条真实消息；
3. dock 展开区应出现**完整请求列表**：普通对话请求（无 `[purpose]` 徽标，如
   `#3 · 9 条消息`——数量 = 2×种子对 + 真实消息序列）点开后**前几条就是注入的
   user/assistant 种子消息**；`[session-title]` 等辅助请求（相隔毫秒级的那条）
   **不含**注入是设计行为（scope 过滤，避免污染标题生成）；
4. 模型的回复应能引用种子内容（如答出「用户测试提示词1」相关上下文）。
注意请求按到达顺序编号，最新一条默认展开。装完先跑
`powershell -ExecutionPolicy Bypass -File verify-deploy.ps1` 做整体健康检查；
更多验证手段见 `DEBUG-NOTES.zh.md` §4（门禁 / 单测 / 独立测试实例 + API 链路）。

## 步骤 2：管理面板（随方式 A 自动激活）

方式 A 下 bundle 层已带面板行，无需任何额外操作；方式 B 由 install.ps1 一并写入。
重启 web 后：

- **对话输入框上方**：可展开/收起的「自定义提示词」条（`conversation.input.dock`），
  **监听默认关闭**，点「开始」后显示最近 30 条**真实 LLM 明文请求**（`llm/stream` 采集），
  条上有开始/停止、清空、隐藏按钮；展开后是**完整请求列表**（每条一行，最新默认展开），
  行内显示 `#序号 · [purpose 徽标] 模型 · 消息数 · 时间`，点开任一条看系统提示词与
  全部消息正文；
- 设置 → 「自定义优先控制提示词」页面：预览 / 配置编辑 / RAW /
  **LLM 监听**（同样有开始/停止、清空按钮）；profile patch 无行时编辑器显示
  当前生效的组合配置（bundle 层默认值），保存即生成 profile 覆盖；
- 设置 → 插件 → `@wm-coder/dsh-custom-first-control-prompt` 卡片：「显示输入框上方条状 inspector」
  与「监听 LLM 请求」两个开关（被隐藏的 dock 条从这里恢复）；
- 若插件未安装，面板自动保持休眠，不影响 web 启动。

## 备注

- 面板写回 `cordis.patch.yml` 走 `fs.writeText` + `danger-full-access` 沙箱策略，可能触发写入审批。
- 面板通过 `settings.prepareDocument()` 推导 `DSH_HOME`（跨机器通用）；若该服务返回 undefined，
  面板会报「无法定位补丁文件路径」，由 AI 视环境调整 `src/panel.ts` 的 `patchPath` 逻辑。
- 配置语义（跳过坏条目而非崩溃）：空 text / 空历史对会被核心插件跳过并告警，不会导致 web 拉不起来。
- 一键脚本：`install.ps1`（官方 add 主线 / `-Offline` junction 回退）、`uninstall.ps1`
  （官方 remove + 双向 scope junction 清理 + patch 行外科剥离）、`verify-deploy.ps1`
  （部署健康检查，含安装模式探测）、`verify-build.ps1`（产物质量门禁）。
