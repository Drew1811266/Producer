# Producer 数据模型

## 设计目标

Producer 的数据模型需要同时服务三件事：

1. 语义图存储：保存 graph、node、edge 的创意语义结构。
2. 本地素材管理：把 `assets/` 目录中的文件、派生文件和节点绑定关系组织起来。
3. 可检索项目记忆：为搜索、回溯、评审与导出提供稳定索引。

它不应该退化为一个“可执行工作流引擎”的数据库模型。

## 本地项目拓扑

当前项目布局由后端初始化：

| 路径 | 作用 |
| --- | --- |
| `.producer/project.db` | SQLite 主数据库 |
| `.producer/settings.json` | 本地项目设置与模板绑定信息 |
| `.producer/thumbnails` | 缩略图缓存目录 |
| `.producer/cache` | 临时缓存目录 |
| `.producer/logs` | 本地日志目录 |
| `assets/docs` | 文档素材 |
| `assets/images` | 图片素材 |
| `assets/videos` | 视频素材 |
| `assets/audio` | 音频素材 |
| `exports` | 导出目录 |

素材路径在数据库中应保存为相对于 `assets/` 的路径，而不是绝对路径。当前代码已经提供 `relative_asset_path()` 做这件事。

## 当前已实现的 SQLite 表

当前 migration 已创建以下表：`project_meta`、`graphs`、`nodes`、`edges`、`assets`、`asset_derivatives`、`node_assets`、`jobs`、`app_events`、`search_documents`。

### 当前实现状态总览

| 表名 | 当前角色 | 当前落地情况 |
| --- | --- | --- |
| `project_meta` | 单项目元数据 | 已实际写入 |
| `graphs` | 图头信息 | 已实际写入；当前只种下根 `brief` 图 |
| `nodes` | 通用节点表 | 表已存在；节点持久化流程尚未完整接通 |
| `edges` | 通用关系表 | 表已存在；关系持久化流程尚未完整接通 |
| `assets` | 本地素材登记表 | 表已存在；完整素材入库流程尚未接通 |
| `asset_derivatives` | 素材派生物 | 表已存在；缩略图/转码写入尚未接通 |
| `node_assets` | 节点与素材绑定 | 表已存在；角色化绑定尚未接通 |
| `jobs` | 系统作业记录 | 表已存在；未来用于导入/生成/索引等异步任务 |
| `app_events` | 追加式应用事件日志 | 已实际写入；当前至少记录 `project_created` |
| `search_documents` | FTS5 搜索索引 | 表已存在；索引写入尚未接通 |

### 当前表结构要点

| 表名 | 关键字段 | 说明 |
| --- | --- | --- |
| `project_meta` | `project_id`、`project_name`、`template_id`、`template_version` | 一般只有一行，对应当前 Producer 项目 |
| `graphs` | `id`、`layer_type`、`name`、`is_root` | `idx_graphs_single_root` 保证当前项目只有一个根图 |
| `nodes` | `id`、`graph_id`、`node_type`、`payload_json` | 节点内容目前统一塞进 `payload_json` |
| `edges` | `id`、`graph_id`、`source_node_id`、`target_node_id`、`edge_type`、`payload_json` | 边目前是图内关系边，且受外键约束 |
| `assets` | `id`、`relative_path`、`media_type` | 只记录相对 `assets/` 的路径 |
| `asset_derivatives` | `asset_id`、`derivative_kind`、`relative_path` | 一个素材可有多个派生物 |
| `node_assets` | `node_id`、`asset_id`、`role` | 同一节点可按不同角色绑定同一素材 |
| `jobs` | `job_type`、`status`、`payload_json` | 保留给系统行为，不应反向驱动图为 DAG |
| `app_events` | `event_type`、`payload_json`、`created_at` | 轻量事件日志 |
| `search_documents` | `document_id`、`graph_id`、`title`、`body` | FTS5 文本索引入口 |

补充说明：

- 时间字段当前统一是 `TEXT`。
- 当前后端写入的时间戳是 Unix 秒数字符串。
- 当前建项目时只会插入 `project_meta`、根 `graphs` 记录和一条 `app_events` 事件。

## 当前实现的语义边界

从代码和测试可以明确看出，当前实现只保证了以下约束：

- 模板中的 `layer_type` 必须属于 `brief`、`storyboard`、`shot_lab`。
- 模板中的 `node_type` 必须属于 `brief`、`storyboard_shot`、`prompt`、`still`、`video`、`reference`、`review`、`result`。
- 模板中的 `edge_type` 必须属于 `contains`、`references`、`variant_of`、`approved_from`、`alternative_to`、`reuses`。
- 根图只能有一个，且当前根图来自 `root_graph_seed`，默认是 `brief`。

当前还没有数据库级或运行时级的完整机制去表达：

- 子图属于哪个父节点。
- 系统锚点如何实例化与持久化。
- 节点在画布中的布局信息。
- 白名单如何在节点写入阶段被强制执行。

## 目标未来数据模型

未来模型建议继续沿用现有表名，但补齐 graph-of-graphs、系统锚点和素材语义。

### 1. `graphs` 应承载图上下文谱系

当前 `graphs` 只记录“这是一张什么层的画布”。未来还需要回答“这张画布是谁展开出来的”。

建议补充的目标字段：

| 字段 | 目的 |
| --- | --- |
| `parent_graph_id` | 指向父图，支持返回导航与上下文树 |
| `source_node_id` | 指向生成该子图的父层节点，例如某个 `brief` 或 `storyboard_shot` |
| `anchor_node_id` | 指向子图内的系统锚点实例 |
| `ordinal` / `sort_key` | 控制同层子图排序 |
| `archived_at` | 支持子图软归档 |

如果短期不想改表，也至少要在 `payload_json` 层维护这套信息，否则 graph-of-graphs 无法稳定导航。

### 2. `nodes` 应区分普通节点与系统节点

目标上，`nodes` 不能只是一坨 JSON；它至少要能区分用户节点和锚点。

建议补充的目标字段或 payload 约束：

| 字段 | 目的 |
| --- | --- |
| `is_system` | 区分系统锚点与普通创意节点 |
| `title` 或标准化 `payload_json.title` | 支持搜索、列表和快速导航 |
| `origin_node_id` | 锚点或投影节点指向其源节点 |
| `x`、`y`、`w`、`h` | 画布布局 |
| `deleted_at` / `archived_at` | 支持软删除与版本保留 |

原则上：

- 普通节点必须满足其所在 `graph.layer_type` 的白名单。
- 系统锚点是唯一允许越过普通白名单的系统语义对象，但必须显式标识为系统节点。

### 3. `edges` 继续表达语义，不表达执行

未来的 `edges` 仍然只应该表达语义关系。

建议约束：

- `edge_type` 继续只允许 `contains`、`references`、`variant_of`、`approved_from`、`alternative_to`、`reuses`。
- 默认保持图内边；跨层继承优先通过子图来源与系统锚点表达。
- 如确需跨图语义，应优先显式记录“来源节点/锚点映射”，而不是放任任意跨图边泛滥。

### 4. `assets` 体系需要成为一等公民

Producer 是本地素材管理工具，因此资产表不是附属表。

建议补充的目标字段：

| 表 | 建议扩展 |
| --- | --- |
| `assets` | `sha256`、`byte_size`、`width`、`height`、`duration_ms`、`origin_uri`、`imported_at` |
| `asset_derivatives` | `generator`、`spec_json`、`width`、`height`、`duration_ms` |
| `node_assets` | 收紧 `role`，例如 `source`、`reference`、`preview`、`output`、`thumbnail` |

这样才能把“本地文件”与“创意语义”稳定地绑在一起。

### 5. `jobs` 是系统作业，不是工作流 DAG

`jobs` 的未来用途应该是：

- 素材导入
- 缩略图生成
- 转码
- 搜索索引
- 模型生成请求与结果拉取

但 `jobs` 不应承担：

- 节点之间的依赖编排
- 多步 agent flow 的主状态机
- 画布语义的来源定义

建议未来 `jobs` 关联到 `node_id`、`asset_id` 或外部 provider 元数据，但图本身仍然是语义图，不是 execution graph。

### 6. `search_documents` 应成为统一检索面

目标上，搜索不应只索引节点正文。

建议把以下对象统一投影到 `search_documents`：

- graph 标题与摘要
- node 标题、正文、标签与评审意见
- asset 文件名、来源与描述
- result/brief/storyboard 的汇总文本

这样 Producer 才能真正具备“项目记忆”能力。

## 建议的未来完整逻辑模型

| 逻辑实体 | 当前承载 | 目标语义 |
| --- | --- | --- |
| Project | `project_meta` + `.producer/settings.json` | 项目身份、模板绑定、本地路径与版本信息 |
| Graph Context | `graphs` | 一张画布，也是一个分层上下文 |
| Node | `nodes` | 创意语义单元或系统锚点 |
| Semantic Relation | `edges` | 图内语义关系 |
| Asset | `assets` | 本地文件与媒体元数据 |
| Derived Asset | `asset_derivatives` | 缩略图、转码、导出、预览等派生物 |
| Node-Asset Link | `node_assets` | 节点与素材的角色化绑定 |
| System Job | `jobs` | 异步系统动作记录 |
| App Event | `app_events` | 审计、日志、埋点、轻量域事件 |
| Search Projection | `search_documents` | 检索投影层 |

## 结论

当前仓库已经把模板层、枚举值、SQLite 表和项目目录骨架搭好了，但真正的目标不是把这些表拼成一个流程引擎。

目标应该是：

- `graphs` 负责上下文层级。
- `nodes` 和 `edges` 负责创意语义。
- `assets` 负责本地素材事实。
- `jobs` 只负责系统行为。

这四者分工清楚，Producer 才能稳定地同时成为分层语义图工具、创意脑图工具和本地资产管理工具。
