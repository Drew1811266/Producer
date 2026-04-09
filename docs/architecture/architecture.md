# Producer 架构草案

## 1. 文档目的

本文基于当前仓库代码与已有产品定义，说明 Producer 的目标架构，以及当前已落地的 Phase 0 + Module A 状态。本文刻意区分“目标能力”与“当前实现”，避免把路线图写成既成事实。

Producer 的定位不是通用白板，也不是可执行数据流编排器。它是一个面向 AI 时代视觉创作者的本地优先桌面工具，核心对象是“分层画布上的创作图谱”，服务于 brief、storyboard、shot lab、素材、派生结果与导出流程。

## 2. 架构结论

### 2.1 目标形态

| 层次 | 目标职责 | 关键技术/约束 |
| --- | --- | --- |
| Desktop Shell | 桌面窗口、原生调用、文件系统与后台任务入口 | Tauri v2 |
| Renderer | 主画布渲染、相机、缩放、选择、高密度节点绘制 | GPU 加速 2D 渲染，优先 PixiJS |
| Overlay UI | 浮层、抽屉、面板、表单、快捷操作 | React，仅保留在覆盖层和管理 UI |
| Domain Core | 模板、图谱、约束、任务编排、路径与项目生命周期 | Rust |
| Persistence | 本地元数据、图结构、任务状态、全文索引 | SQLite |
| Media Workers | 缩略图、转码、分析、缓存、索引更新 | Rust 后台任务 |

### 2.2 当前状态

| 领域 | 当前已实现 | 当前未实现 |
| --- | --- | --- |
| Desktop | Tauri v2 壳、前后端桥接、4 个命令入口 | 原生菜单、系统通知、深度后台能力 |
| Renderer | 全屏 workspace shell 占位 | 真正的 GPU 画布、节点绘制、命中测试、相机系统 |
| Overlay UI | React 启动页、模板选择、workspace 浮层 | 左侧编辑抽屉、节点检查器、时间线/工具栏 |
| Domain | Rust 模板注册、项目创建/打开、会话读取、路径抽象 | 持久化节点变更、跨画布导航、任务执行器 |
| Persistence | SQLite schema、root brief graph seed、事件记录 | 节点/边增删改查、索引更新、任务消费 |
| Templates | `ecommerce_ad_v1` 声明式 manifest 与校验 | 多模板、版本升级迁移、模板继承 |

## 3. 产品解释边界

Producer 必须明确拒绝以下两种错误解释：

### 3.1 不是通用白板

- 画布不是任意贴便签、任意连线、任意分组的开放空间。
- 每个 canvas 都有明确 layer type。
- 每个 layer 只允许特定 node type、relation type 和系统锚点。
- 画布之间的跳转来自模板定义的 child canvas 规则，而不是用户随意新建无限层级白板。

### 3.2 不是可执行数据流系统

- 节点和边表达的是创作语义、素材关系、版本关系和审核关系。
- 它们不是 DAG 任务节点，不承载“运行这个节点就会执行代码”的含义。
- 后台任务系统可以引用图谱对象，但图谱本身不是执行引擎。

## 4. 目标架构

### 4.1 Tauri v2 桌面壳

Tauri v2 负责提供桌面窗口、命令桥接、文件系统入口与后台能力接入。前端不直接承担项目生命周期管理，Tauri 只暴露薄命令面，真实业务逻辑放在 Rust domain。

当前代码已经体现这一方向：

- `src-tauri/src/commands.rs` 只暴露 `list_available_templates`、`create_project`、`open_project`、`get_project_session`
- `src-tauri/src/lib.rs` 负责 Tauri 命令注册
- `src/bridge/tauri.ts` 只做类型桥接和会话缓存

这意味着未来新增能力也应保持同一原则：Tauri command 只做序列化边界，不承接业务判断。

### 4.2 GPU 2D 画布渲染器

最终形态中，主画布必须是 GPU 加速 2D renderer，推荐以 PixiJS 为核心。原因很明确：

- 需要承载大画布、平移缩放、图节点批量渲染与高频交互
- 需要一次只渲染当前激活 graph，而不是把所有上下文铺成一张无限大 DOM 图
- 需要将渲染性能与 React reconciliation 解耦
- 需要为后续命中测试、框选、关系线、预览缩略图、局部重绘预留能力

React 不应负责主画布节点树的渲染。React 在 Producer 中应主要保留给：

- 浮层
- 抽屉
- Inspector
- 启动/模板选择
- 对话框与轻量控制面板

当前仓库已经安装 `pixi.js` 与 `@pixi/react`，但并未真正启用画布渲染。现有 `src/App.tsx` 只是一个 full-screen workspace shell：全屏容器、两侧 overlay、底部 rail，以及“Canvas coming online”占位信息。这个现状需要在文档和实现上持续保持诚实。

### 4.3 Rust Domain Core

Rust 是 Producer 的业务核心，而不是 Tauri 的附属层。目标上它应负责：

- 模板 manifest 解析与校验
- 项目创建、打开、恢复与升级
- 图谱、节点、边与层级关系
- 业务约束校验
- 后台任务编排
- 本地索引更新
- 路径、资源与导出规则

当前已经落地的域层主要集中在：

- `src-tauri/src/domain/project.rs`
- `src-tauri/src/domain/template.rs`
- `src-tauri/src/domain/pathing.rs`
- `src-tauri/src/domain/storage.rs`

这是正确的演进方向。后续功能应继续往这些域模块里扩展，而不是把规则散落到 React UI。

### 4.4 SQLite 本地元数据与索引层

Producer 采用本地优先存储，SQLite 承担元数据、图结构、任务状态与搜索索引。它不是仅用来记设置，而是本地项目真相源的一部分。

当前 migration 已经建立这些核心表：

| 表/对象 | 用途 |
| --- | --- |
| `project_meta` | 项目主元数据 |
| `graphs` | 画布/图容器 |
| `nodes` | 节点 |
| `edges` | 关系边 |
| `assets` | 素材记录 |
| `asset_derivatives` | 派生文件记录 |
| `node_assets` | 节点与素材关联 |
| `jobs` | 后台任务状态 |
| `app_events` | 应用/域事件 |
| `search_documents` | FTS5 全文索引 |

当前 Phase 0 只真正写入了 `project_meta`、`graphs` 的 root graph，以及 `app_events` 中的 `project_created` 事件；其余表结构属于架构预埋，而不是已完整启用。

### 4.5 项目目录布局

本地项目目录应保持稳定、可迁移、可索引，并把用户素材与系统元数据分离。当前 Rust `ProjectPaths` 已经把布局固化为：

```text
<project-root>/
  .producer/
    project.db
    settings.json
    thumbnails/
    cache/
    logs/
  assets/
    docs/
    images/
    videos/
    audio/
  exports/
```

设计意图：

- `.producer/` 放系统私有元数据、缓存、日志与数据库
- `assets/` 放用户素材与导入对象
- `exports/` 放导出结果

这个布局对后续增量同步、清理缓存、迁移项目和调试问题都很重要，应避免让 UI 或插件层自行发明目录结构。

### 4.6 路径抽象与跨平台规则

路径规则不能散落在 UI、脚本和任务代码里。当前 `ProjectPaths` 已经承担最小路径抽象职责：

- 统一构造 `.producer/`、`assets/`、`exports/` 路径
- 创建必需目录
- 将素材路径规范化为相对 `assets/` 的路径
- 阻止把项目外文件伪装为内部资产路径

当前默认项目根目录通过 `HOME` 或 `USERPROFILE` 推导，也支持 `PRODUCER_PROJECTS_DIR` 覆盖。这说明 Producer 的路径模型已经开始考虑跨平台，但后续还应继续收口到 Rust，避免前端直接拼路径。

### 4.7 模板 Manifest 系统

Producer 的模板不是 UI 皮肤，而是业务声明。模板 manifest 定义：

- layer type
- 每层允许的 node type
- 可选 system anchor
- child canvas 来源
- 默认 relation type
- root graph seed

当前 `ecommerce_ad_v1` 已经体现了这一点：

- `brief` 层只允许 `brief`
- `storyboard` 层只允许 `storyboard_shot`
- `shot_lab` 层只允许 `prompt`、`still`、`video`、`reference`、`review`、`result`

这不是展示建议，而是业务契约。

### 4.8 后台媒体任务

目标架构中，媒体相关工作必须在 Rust 后台任务层处理，而不是交给前端页面生命周期：

- 缩略图生成
- 视频/音频转码
- 媒体探测与元数据抽取
- 索引刷新
- 导出编排
- 失败重试和状态恢复

数据库里的 `jobs`、`asset_derivatives`、`app_events` 已经为这类能力预留了位置。当前尚未实现 worker runtime，但架构方向已经明确：任务是 domain 的一部分，不是浏览器组件副作用。

## 5. 约束归属原则

Producer 的业务约束必须在 Rust/domain 和数据层被强制执行，不能只停留在 UI 过滤。

这条原则尤其适用于：

- layer-specific node whitelist
- relation type whitelist
- child canvas 来源是否合法
- system anchor 约束
- 素材路径必须位于 `assets/` 下
- 项目 settings 与数据库元数据的一致性

原因：

- UI 过滤只能改善交互，不能保证数据完整性
- Tauri 命令、未来脚本导入、批处理任务、恢复逻辑都可能绕过 UI
- 本地优先应用的长期稳定性依赖持久层不接收非法状态

当前代码已经有这个方向上的正例：

- `TemplateManifest::validate()` 在 Rust 中校验 layer、node、relation 与 child canvas 规则
- `ProjectPaths::relative_asset_path()` 在 Rust 中阻止越界资产路径
- `load_project_session()` 会校验 `settings.json` 与数据库中的 `template_id`、`project_id` 是否匹配

未来节点增删改查落地时，必须继续遵守这条规则：UI 可以做预过滤，但最终裁决必须在 domain/storage。

## 6. 当前 Phase 0 + Module A 已实现状态

### 6.1 已实现范围

- 启动时加载模板列表并尝试恢复当前 session
- 创建本地项目
- 打开已有项目或默认最近项目
- 初始化项目目录
- 执行 SQLite migration
- 写入 `project_meta`
- 仅 seed root `Brief Canvas` graph
- 写入 `settings.json`
- 缓存并返回 `ProjectSession`
- 进入全屏 workspace shell

### 6.2 当前前端实际形态

当前 React 前端只承担两类界面：

- 启动页：模板选择、创建项目、打开项目、错误与 loading 状态
- workspace shell：全屏画布背景占位 + 左右 overlay + 底部状态栏

当前还没有：

- 节点渲染
- 边渲染
- 相机移动/缩放
- 选区与命中测试
- 节点编辑器
- 图谱导航

因此，现阶段不能把当前实现描述成“已具备 canvas editor”。它只是“canvas-first workspace shell”。

### 6.3 当前后端实际形态

当前 Rust 后端已经具备一个可测试的最小项目域模型：

- 模板注册与嵌入加载
- 项目创建/打开/会话读取
- 路径抽象
- SQLite migration
- root graph 初始化
- app event 记录

当前还没有：

- 节点与边的持久化变更 API
- 模板升级迁移
- 后台任务执行器
- 搜索索引写入逻辑
- 资产导入流水线

## 7. 建议的后续演进顺序

1. 先补 Rust domain 的节点/边变更能力，并把 layer whitelist 约束正式下沉到写路径。
2. 引入 GPU 2D 画布 renderer，完成相机、节点、边和选择的基础交互。
3. 再让 React overlay 接入 inspector、抽屉和快捷创建操作。
4. 最后接入后台媒体任务、索引刷新与导出编排。

这个顺序的原因是：如果没有先建立 domain 约束和高性能画布，后续 UI 与媒体流程都会建立在不稳定基础上。

## 8. 小结

Producer 的最终架构应该是：Tauri v2 桌面壳 + Rust domain core + SQLite 本地元数据/索引 + GPU 加速 2D 主画布 + React 覆盖层 UI。

当前仓库已经完成了这个方向上的 Phase 0 + Module A 引导版本，但它仍然只是一个项目生命周期与 workspace shell 的最小闭环，不是完整创作画布。文档、实现和后续模块设计都应保持这一边界感。
