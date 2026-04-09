# Producer 图语境与分层画布

## 定位

Producer 是一个以本地项目为中心的创作工具，核心模型是“分层语义图 + 创意脑图 + 本地素材管理”，而不是可执行的工作流引擎。

- 图 (`graph`) 是上下文容器，也是画布 (`canvas`)。
- 节点 (`node`) 是创意语义单元，不是任务实例。
- 边 (`edge`) 是语义关系，不代表调度顺序、触发器或自动执行链。
- 素材 (`asset`) 是本地文件系统中的图片、视频、音频、文档及其派生物。

## `ecommerce_ad_v1` 的三层语境

`ecommerce_ad_v1` 目前定义了三个 `layer_type`，共同组成一个 graph-of-graphs 结构。

| `layer_type` | 画布名 | 语境职责 | 允许的用户节点 | 系统锚点 | 可向下展开 |
| --- | --- | --- | --- | --- | --- |
| `brief` | Brief Canvas | 定义项目意图、商品信息、目标受众、约束、卖点与创意方向 | `brief` | 无 | `brief` 节点可展开为 Storyboard 子画布 |
| `storyboard` | Storyboard Canvas | 把 Brief 拆成镜头、段落、节拍与表达结构 | `storyboard_shot` | `Brief Anchor`，来源 `brief` | `storyboard_shot` 节点可展开为 Shot Lab 子画布 |
| `shot_lab` | Shot Lab Canvas | 围绕单个镜头做提示词实验、素材引用、候选结果对比与评审 | `prompt` `still` `video` `reference` `review` `result` | `Storyboard Anchor`，来源 `storyboard_shot` | 无 |

## Graph-of-Graphs 导航

Producer 的导航单位不是“页面流转”，而是“上下文下钻”。

1. 根图是 `brief` 层的 Brief Canvas。
2. 选中某个 `brief` 节点后，进入它派生出的 `storyboard` 子图。
3. 在 Storyboard Canvas 中，选中某个 `storyboard_shot` 节点后，进入它派生出的 `shot_lab` 子图。
4. 用户始终可以沿着父图链路返回上一级，而不是依赖状态机式的页面跳转。

这意味着：

- 上下文切换由“节点拥有子图”驱动，而不是由工作流步骤驱动。
- 下层图继承上层语义，但不复制整层节点集合。
- 继承入口通过系统锚点表达，而不是把上层节点原样塞进下层白名单之外的画布。

## 单一激活上下文

Producer 不是把所有层级同时装进一张无限大图里，而是一次只工作在一个激活 graph 上。

- 进入项目后，默认只激活根 `brief` 图。
- 双击进入下层时，只切换当前活跃图，不要求同时渲染父层全部内容。
- 返回上层时，恢复父图相机与选择状态，而不是重新构造一套页面。
- 这种设计的目标是保证大项目也能保持局部流畅，而不是为了制造“无限大总览图”的幻觉。

## 系统锚点节点

系统锚点是子图中的只读上下文投影，用来把“我为什么在这里”固定在画布里。

| 锚点标题 | 出现层 | 来源节点类型 | 作用 |
| --- | --- | --- | --- |
| `Brief Anchor` | `storyboard` | `brief` | 把上层 Brief 的核心意图投影到 Storyboard Canvas，作为镜头拆解的语义根 |
| `Storyboard Anchor` | `shot_lab` | `storyboard_shot` | 把上层镜头意图投影到 Shot Lab Canvas，约束提示词、素材与结果探索 |

锚点规则：

- 每个子图最多一个对应的系统锚点。
- 锚点是图语境的一部分，不是用户自由创建的普通节点。
- 锚点应被固定、只读、可追溯到父层源节点。
- 锚点不可编辑、不可被选中为普通工作节点，但可以作为关系边的来源节点表达语义继承。
- 锚点不能作为关系边的目标节点，也不承担执行流语义。
- 锚点存在的目标是语义继承，不是执行依赖。

说明：当前代码已经在模板清单中声明并校验 `system_anchor`，但运行时还没有完整落地锚点实例化与子图创建流程。

## 严格的层白名单

Producer 必须执行严格的 layer-specific whitelist。

- `brief` 图内只能承载 `brief` 用户节点。
- `storyboard` 图内只能承载 `storyboard_shot` 用户节点；`brief` 只能以 `Brief Anchor` 的系统形式出现。
- `shot_lab` 图内只能承载 `prompt`、`still`、`video`、`reference`、`review`、`result` 用户节点；`storyboard_shot` 只能以 `Storyboard Anchor` 的系统形式出现。

这条规则比“自由脑图”更严格，原因是 Producer 不是通用白板，而是有层级语义边界的创意图系统。

## 语义关系类型

当前模板与代码统一使用以下 `relation kinds`：

| `edge_type` | 语义 | 适用说明 |
| --- | --- | --- |
| `contains` | 结构包含 | 表示组块、章节、构图集合或语义归属，不表示执行顺序 |
| `references` | 引用/指向 | 表示节点引用了另一节点、另一语义对象或相关背景信息 |
| `variant_of` | 变体关系 | 表示当前节点是另一节点的不同版本、不同尝试或平行候选 |
| `approved_from` | 批准来源 | 表示当前节点是从某个已确认版本、已评审语义或已定稿对象演化而来 |
| `alternative_to` | 替代关系 | 表示两个节点互为可替代方案，用于创意对照与选择 |
| `reuses` | 复用关系 | 表示当前节点复用了已有提示词、素材、镜头设定或结果资产 |

关系边界：

- 这些边表达“创意语义”，不表达“先执行哪个 job”。
- 不引入 `next_step`、`run_after`、`depends_on` 之类工作流关系。
- `contains` 也不是 DAG 的父子调度边，只是画布内的结构整理语义。

## 当前实现与目标形态

当前实现只会在建项目时种下根 `brief` 图，尚未自动创建 `storyboard` 与 `shot_lab` 子图。

但文档层面应以目标结构来约束后续实现：

- 根图固定是 Brief Canvas。
- 子图由节点展开形成，组成 graph-of-graphs。
- 系统锚点负责跨层语义继承。
- 所有层都必须继续遵守白名单和关系种类约束。
