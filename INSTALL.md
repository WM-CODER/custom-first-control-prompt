# 单文件夹安装手册（给 AI 的安装说明）

目标：用户把**本文件夹**交给 AI 并说「安装」后，AI 在目标机器的 dsh web 部署上完成：
1. 核心插件（`@deepseek-ai/dsh-custom-first-control-prompt`）安装 —— 持久，重启不丢；
2. 管理面板（正式客户端包 `@deepseek-ai/dsh-client-ui-custom-first-control-prompt`，位于 `client-ui/`）安装 —— 持久，**web 重启后仍在**，无需重装。

> 安装/调试踩过的问题与测试方法见同目录 [DEBUG-NOTES.zh.md](DEBUG-NOTES.zh.md)
> （含「同 id 重复 insert 会让 web 起不来」等关键坑的根因与规避）；
> 另一台机器的完整实测流程（含 npm rc.5 打框架补丁的完全版改造）见
> [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md) 与方案分析 [PLAN-A-REVISED.md](PLAN-A-REVISED.md)。

## 获取插件（从远端仓库）

本插件以单仓库形式发布在 GitHub `WM-CODER/custom-first-control-prompt`：
远端 main 只保留**一段历史**（单提交），内容已做敏感信息清洗（不含任何机器的用户名、
绝对路径、凭据或会话标识）。两种获取方式：

```powershell
# 方式 1：git clone（推荐，可 git pull 跟进更新）
git clone https://github.com/WM-CODER/custom-first-control-prompt.git
# 方式 2：GitHub 页面 Code → Download ZIP，解压后得到同一目录
```

后续步骤中的 `<folder>` 一律指克隆/解压得到的目录。注意：获取到的目录
**不含 `node_modules`**（依赖链是本机安装态，见 1.1）也**不含构建缓存**
（sourcemap / tsbuildinfo 不入库）；核心插件产物 `lib/`、面板包 `client-ui/`、
安装脚本、补丁与文档均随仓库分发，自包含。

## 前置条件

- 本机已有可运行的 dsh web 部署（默认 http://127.0.0.1:3080）。
- **dsh 版本要求（关键，跨机器必查）**：部署必须是 **0.1.x 新线**（npm dist-tag `next`，
  当前为 **0.1.0-rc.6**；注意 0.1.0-rc.5 并未发布到 npm）。确认方式：
  `<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-web-app/package.json` 的 `version`。
  老线（`latest`，0.0.1-rc.x）缺 Typert Remote 线路与相关槽位，本插件不兼容；
  请先按 dsh 升级流程把部署升到 `next` 线再继续。官方安装方式（方式 A）要求 `next` 线；
  手工 junction（方式 B）在 rc.5（本地构建部署）上也已验证可用。
- 本文件夹自包含：核心插件 `package.json` + 构建产物 `lib/`（含 `typert.host.js` 等）+ 依赖链
  `node_modules`（方式 B 见 1.1）；客户端包在 `client-ui/`（`lib/client.js` 已构建，浏览器 bundle 无 Node 依赖）。
  本插件未发布 npm，但两种安装方式都不需要发布——方式 A 走 `dsh plugin add`（link 安装），
  方式 B 走 junction 直接挂载。
- `DSH_HOME` 默认位于用户目录下的 `.dsh`（Windows：`%USERPROFILE%\.dsh`，Linux/macOS：
  `~/.dsh`）；更通用的推导方式：settings 文档路径（`<DSH_HOME>/settings.yaml`）的父目录
  即 `DSH_HOME`。
- **非 Windows 系统**：以下所有 `New-Item -ItemType Junction` 换成等价的符号链接
  （`ln -s <目标> <链接>`），其余步骤与验证方式完全一致。

### 0. 安装前检查（目标机器必做）

| 检查项 | 方法 | 通过标准 |
|---|---|---|
| dsh 版本为 `next` 线 | 看 `<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-web-app/package.json` 的 `version` | `0.1.x`（当前 `0.1.0-rc.6`）；`0.0.1-rc.x` 老线**不兼容** |
| 完全版钩子（`agent-loop/session-seed`） | `node -e "import('@deepseek-ai/dsh-agent-loop').then(()=>console.log('ok')).catch(e=>{console.error(e.message);process.exit(1)})"`（在 `<DSH_HOME>/profiles/web` 下执行），再 `Select-String -Path '<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-agent-loop/lib/*.js' -Pattern 'agent-loop/session-seed'` | 能搜到 `agent-loop/session-seed` → 完全版无需补丁；**搜不到 → npm 0.1.x 发布物（含 rc.6）均无此钩子**，完全版需打框架补丁（`patches/framework-planA.patch` 通用或 rc.5 适配版，见「两档功能」） |
| bundle 是否自带面板行 | `Select-String -Path '<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml' -Pattern 'ui-custom-first-control-prompt'` | **npm 0.1.x 发布物 bundle 不带**（未命中）→ **profile 必须写面板行**（默认如此）；仅当命中（如从含该行的主线构建的 web-app）→ 不写，避免同 id 重复 insert |
| 网络（仅方式 A 需要） | — | `dsh plugin add` 会把 `<folder>` 声明的依赖（schemastery `3.18.1`、zod `^4.4.3`、peer 的 dsh `0.1.0-rc.6` 全家桶）从 registry 解析；离线机器用方式 B（junction 到部署自身依赖） |

> **铁律：核心包与面板包必须一起装。** 无论面板行在 bundle 里（本地主线构建的
> web-app）还是在 profile 里（npm 0.1.x 发布物，默认），只装核心包不装 `client-ui/`
> 会让对应行解析不到 `@deepseek-ai/dsh-client-ui-custom-first-control-prompt`
> → **web fail-loud 起不来**。下面的方式 A / 方式 B 都是两包同装，不要被简化描述
> 带偏成只装核心。

## 两档功能（补丁体系）

同一份插件源码在两种部署环境下自动呈现两档能力：

| 档位 | 部署条件 | 参考历史的表现 |
|---|---|---|
| **完全版（对话式，首选）** | dsh 框架含 `agent-loop/session-seed` 瀑布钩子（**仅存在于包含 `b1601bec35` 提交的主线构建**，如从 dsh 仓库本地构建的部署；**npm 0.1.x 发布物——含 rc.6——实测均无此钩子**） | 每对 user/assistant 以**真实的交替 user/assistant 消息**注入（对话式种子），首条真实消息前即成对显示 |
| **基础档（帧）** | 部署的 dsh 框架**不含**该钩子（npm 0.1.x 发布物） | 每对 user/assistant 合并为**一条 `<custom-history>` 帧**（user 角色消息）注入 |

说明：
- `patches/framework-planA.patch` —— 完全版框架补丁（通用意图）：对 dsh 框架源码
  （`packages/core/agent-loop`、`packages/core/session`）执行
  `git apply patches/framework-planA.patch`，重建 host 库并重启 web 后即升至完全版。
  **注意基线**：该补丁未标注基线版本，在 rc.5 官方源码上无法直接应用；已随附
  rc.5 适配版 `patches/framework-planA-rc5.patch`（正/反向均可应用）。按部署框架版本
  选择；当前主线已内置钩子，无需补丁。
- `patches/plugin-planA-upgrade.patch` —— 插件升级补丁：仅当你手中是**旧版插件源码**
  （仅帧注入）时需要，把它升级为对话式种子版（含 `buildSeedEvents`、钩子监听、伴生
  不变式更新、`plan-a.spec.ts`）。本文件夹源码已是升级后版本，通常无需此补丁。
- 两档下 sections（系统段）与历史配置字段完全一致；框架无钩子时插件自动走帧路径，不存在报错。

## 步骤 1：核心插件（持久安装）

> **方式 A（官方，推荐，已端到端验证）**：dsh 自带插件管理命令（把参数原样转发给
> profile 目录里的 pnpm）：
>
> ```powershell
> dsh plugin --profile web add <folder> <folder>/client-ui
> ```
>
> 两个包以 link 依赖装进 `<DSH_HOME>/profiles/node_modules`，loader / typert-loader /
> modules 全部按官方解析路径找到它们——**无需任何手工 junction**。网络不稳时追加
> `--no-optional`。此方式要求部署是 `next` 线（0.1.0-rc.6，见前置条件）；
> 装完跳到 1.3 写补丁行。
>
> **方式 B（离线 / 有 dsh 仓库的开发机）**：手工 junction（1.1/1.2）。

1.1 **依赖链**：确认 `<folder>/node_modules` 存在且能解析 `@deepseek-ai/schemastery`、`zod`、
`@deepseek-ai/dsh-session` 等依赖。两条等价路径（junction 即可，无需网络、无需仓库）：
- **通用（推荐，任何机器）**：junction 到部署自己的已发布安装——
  `New-Item -ItemType Junction -Path <folder>\node_modules -Target <DSH_HOME>\profiles\node_modules`。
  标准的 pnpm 部署都有该目录（0.1.x 线含插件全部依赖：schemastery、zod、dsh 全家桶）。
  若该目录不存在（非 pnpm 部署形态），找到部署解析 `@deepseek-ai/dsh-*` 包所用的
  node_modules 根目录并 junction 到它即可（例如 dsh 的全局安装位置）。
- **开发机**：junction 到 dsh 仓库同插件的依赖目录——
  `<repo>/packages/context/custom-first-control-prompt/node_modules`。
`zod` 是 Typert 生成产物（`lib/typert.host.js`）的运行时依赖，缺失会导致 web 启动在
typert-loader 阶段报 `ERR_MODULE_NOT_FOUND`。
`client-ui/` **无需安装依赖**：浏览器 bundle（`lib/client.js`）已把 zod 与 Remote
贡献内联，其 node 半（`lib/index.js`）为空壳。

1.2 **profile 注册**：在 `<DSH_HOME>/profiles/web/node_modules/@deepseek-ai/` 下建
`dsh-custom-first-control-prompt` → junction 指向本文件夹。
（目录不存在则先 `New-Item -ItemType Directory -Force` 建父目录。）

1.3 **补丁行（已实机验证的形态）**：把本文件夹 `cordis.patch.yml.template` 的内容合并进
`<DSH_HOME>/profiles/web/cordis.patch.yml`。注意该文件必须保持「顶层 YAML 数组」：
- 文件为空/纯注释 → 整体写入模板内容；
- 已有其他条目 → 在数组末尾追加模板里的 `- insert:` 条目。
**关键约束（照抄会踩的坑）**：
- profile patch 写**核心插件行 + 面板行**（`cordis.patch.yml.template` 默认含两行——
  npm 0.1.x 发布物 bundle 不带面板行，必须写在 profile）。**仅当部署 bundle 确认已自带
  面板行**（如从含该行的主线构建的 web-app）时删掉模板里的面板行，避免
  **同 id 重复 insert → web fail-loud 起不来**。
- 核心插件行本身也只出现一次：若 bundle 已自带（少见），删掉 profile 里的条目。
- 真实部署截图见 `profile-web.patch.yml`（本地主线构建 bundle，只含核心行）与
  `INSTALL-FULL.zh.md` §A3（npm 发布物，两行都写）；为什么只能这么写见
  `DEBUG-NOTES.zh.md` §1.3。
修改后 web 热监听会自动重载（几秒）；必要时重启 web。

1.4 **验证（完全版 / 对话式种子）**：新开一个会话，**发送第一条真实消息之前**，对话里
应直接看到**真实的 user/assistant 交替消息**（模板里的每对配置各占一轮，轮次从 1 开始）；
发送第一条消息后，回复应能引用这些参考内容。`<custom-history>` 帧文本只在基础档、或
`reapply`/`per-request` 的压缩遮蔽回退、或旧会话残留中出现——新会话的完全版里看不到它。
更多验证手段见 `DEBUG-NOTES.zh.md` §4（门禁 / 单测 / 独立测试实例 + API 链路）。

## 步骤 2：管理面板（正式客户端包）

2.1 **profile 注册**：与 1.2 同目录下再建
`dsh-client-ui-custom-first-control-prompt` → junction 指向 `<folder>/client-ui`：

```powershell
New-Item -ItemType Junction -Path '<DSH_HOME>\profiles\web\node_modules\@deepseek-ai\dsh-client-ui-custom-first-control-prompt' -Target '<folder>\client-ui'
```

2.2 **bundle 行（默认写在 profile）**：npm 0.1.x 发布物的 web bundle **不带**面板客户端行
（`- id: ui-custom-first-control-prompt`），所以 profile 补丁里**默认要写**（模板已含）。
**仅当**确认部署 bundle **自带**该行（从含该行的主线构建的 web-app）时，profile 里删掉
面板行——重复 id 会让 web 起不来（见 `cordis.patch.yml.template` 注释）。

2.3 **重启 web**。面板从此随正式包持久存在，重启不再需要任何重装。

2.4 **验证**：
- **对话输入框上方**：可展开/收起的「自定义提示词」条（`conversation.input.dock`），
  **监听默认关闭**，点「开始」后显示最近 30 条**真实 LLM 明文请求**（`llm/stream` 采集），
  条上有开始/停止、清空、隐藏按钮；
- 设置 → 「自定义优先控制提示词」页面：预览 / 配置编辑 / RAW / **LLM 监听**（同样有开始/停止、清空按钮）；
- 设置 → 插件 → `@deepseek-ai/dsh-custom-first-control-prompt` 卡片：「显示输入框上方条状 inspector」
  与「监听 LLM 请求」两个开关（被隐藏的 dock 条从这里恢复）；
- 若插件未安装（profile 无插件行），面板自动保持休眠，不影响 web 启动。

## 备注

- 面板写回 `cordis.patch.yml` 走 `fs.writeText` + `danger-full-access` 沙箱策略，可能触发写入审批。
- 面板通过 `settings.prepareDocument()` 推导 `DSH_HOME`（跨机器通用）；若该服务返回 undefined，
  面板会报「无法定位补丁文件路径」，由 AI 视环境调整 `src/panel.ts` 的 `patchPath` 逻辑。
- 配置语义（跳过坏条目而非崩溃）：空 text / 空历史对会被核心插件跳过并告警，不会导致 web 拉不起来。
- `panel/` 目录是历史动态面板（cordis_define 时代）的源码，仅供参考；正式面板在 `client-ui/`，无需它。
