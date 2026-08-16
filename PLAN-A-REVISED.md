# 完全版（对话式参考历史）修正方案

> 状态：方案（未实施）。针对 `patches/framework-planA.patch` 在本机 rc.5 部署上的问题，
> 给出修正路线。本机部署基线：`abe560f81e release(dsh): 0.1.0-rc.5`。

## 一、现有 patch 的问题诊断（实测结论）

### 1. 基线不匹配，patch 无法应用（直接根因）

`git apply --check patches/framework-planA.patch` 在 rc.5 检出上**全部 5 个文件失败**：

```
error: patch failed: packages/boot/app-boot/src/profile.ts:364
error: patch failed: packages/boot/app-boot/tests/profile.spec.ts:143
error: patch failed: packages/core/agent-loop/src/index.ts:22
error: patch failed: packages/core/session/src/index.ts:328
error: patch failed: packages/core/session/tests/session.spec.ts:251
```

patch 基于更新的基线编写，与 rc.5 源码 context 全部错位。手工套用极易遗漏/改错位置，
是"问题很多"的第一个来源。patch 还夹带无关改动（app-boot 的 profile 容错 + 回归测试），
扩大应用面积。

### 2. session 边界拒绝 plugin-source assistant 消息（"新对话无法创建"的机制根因）

rc.5 的 seed/load 边界校验链（`Session` 构造 → `assertSessionEventEnvelope` →
`assertCurrentLlmShape` → `assertMessageEventShape`）：

```ts
// packages/core/session/src/index.ts:330
if (type === 'assistant/message') {
  if (sourceRecord['kind'] !== 'model' || !hasProviderModel(sourceRecord)) {
    throw new Error(`${subject} message must have model source`)
  }
}
```

插件 `buildSeedEvents` 的 assistant 消息是 `source: { kind: 'plugin', plugin: 'custom-first-control-prompt' }`。
**任何把 seed 传进 `sessions.prepare(..., { seed })` 的框架钩子方案**（patch 的做法）都会让
`Session` 构造抛错 → `createAgent` 抛错 → **新对话创建失败**。patch 的第三处修改（放宽该校验）
正是为此，但：打不上 rc.5 = 放宽不生效 = 创建即失败；手工套用错位 = 同样的失败。

### 3. `buildSeedEvents` 的 assistant 事件缺 `turn`/`step` 字段

类型契约要求 `'assistant/message': { turn, step, message, usage? }`（session/src/types.ts:273），
但 `buildSeedEvents` 构造的 data 只有 `{ message }`。snapshot 路径的运行时校验不查它，
但 **session-invariant（官方部署启用时）的 `requireOpenStep` 直接读 `event.data.turn/step`**
（session/src/invariant.ts:119）→ 官方部署下 Plan A seed 会违反 invariant。

### 4. patch 的放宽语义过宽

`kind === 'plugin'` 且 plugin 为非空字符串即放行 —— 对 seed/load/restore **所有边界全局生效**，
任何插件可伪造 assistant 历史，削弱"assistant 消息必须由模型生成"的边界承诺。
hook 事件的监听到达性本身无问题（所有 ctx 共享 root 的 events 表；无 scope 派发不过滤），
但 seed 事件必须在**会话创建前**进入 —— 这正是必须走 seed 边界的死结。

## 二、修正方案：路线 B（推荐）—— 纯插件实现，零框架改动

### 核心洞察

`Session.append()`（index.ts:604）只做 JSON 可序列化 + seq 连续 + surface 校验
（`surfaceManager.validateNext`），**不校验消息 source kind** —— `assertMessageEventShape`
仅作用于 seed/load 边界。因此对话式 seed **不需要框架钩子**：
在已有的 `agent/session-start` 事件里（scope 过滤对无 tag 的行 ctx 放行，插件可达，
基础版已复用该事件做帧注入）把参考对话作为**完整闭合的 turn 组**逐个 `append`。

### 改动清单（全部在插件包内）

| 文件 | 改动 |
|---|---|
| `src/seed.ts` | 新增 `appendSeedTurns(session, pairs)`：按 `buildSeedEvents` 顺序逐个 `session.append()`：`turn/start` → `step/start` → `user/message`（plugin source）→ `assistant/message`（`{turn, step, message}`，**补全 turn/step**）→ `step/end` → `turn/end`（`reason: {kind:'completed'}`）。seq/time 由 append 自动分配，天然连续。 |
| `src/seed.ts` | `buildSeedEvents` 的 assistant data 补 `turn`/`step`（修类型契约 + invariant 兼容；该函数继续服务于未来框架钩子场景与测试）。 |
| `src/index.ts` | `historyMode: 'session-start'` 从"单帧 seedTranscript"改为 `appendSeedTurns` 对话式注入；保留 `hasSeededHistory` 防重、`includeSubagents` 过滤、resume/fork 不重复（日志已有 seed 则跳过）。`reapply`/`per-request` 帧模式不变（压缩免疫）。 |
| `README.zh.md` | 模式矩阵更新：`session-start` = 真实交替 user/assistant 消息（压缩可能遮蔽）。 |
| `tests/` | session-start 相关用例改为断言真实交替消息；`plan-a.spec.ts` 保留纯函数测试并补 turn/step 断言。 |

### 为什么不会再有"新对话无法创建"

- 不再经过 seed/load 边界的 `assertMessageEventShape` → 无拒绝点；
- append 路径本来就被所有插件使用（loop 自身 append 模型消息），plugin-source 消息
  不在 append 路径上新增任何权限 —— 不削弱任何边界（与 patch 的全局放宽不同）；
- 事件形状满足类型契约与 session-invariant（turn/step 配对闭合）。

### 权衡（与 README 已知限制一致）

- seed 占用轮次编号，首个真实轮次从 N+1 开始（两种方案相同）；
- 对话式 seed 是普通 surface 内容，compaction 可能遮蔽（`session-start` 模式原有特性）；
  需要压缩免疫请用 `reapply`（默认）/`per-request` 帧模式；
- fork/resume 不重复注入。

### 生效方式

插件包文件更新后需重启 web 生效（Node ESM 缓存）；无框架重建。

## 三、备选路线 A：修 patch（仅当需要工厂级 seed 钩子时）

1. 重新生成 patch 适配 rc.5 基线（更新全部 context 行）。
2. 放宽收窄：仅 `kind === 'plugin'` 且 plugin 为非空、非保留名（`'model'`/`'user'`/`'tool'`）字符串；
   model 分支原样保留；同步 `session/tests/session.spec.ts` 的期望文案。
3. `buildSeedEvents` 补 turn/step（同上）。
4. 需要重建 host 库 + 重启 web；与路线 B **互斥**（两套机制会双重注入）。

## 四、建议

路线 B 优先：改动小、零框架风险、语义更干净（不触碰任何校验边界）。
路线 A 仅在需要"种子进入 Session 构造前"的通用钩子机制时再考虑。
