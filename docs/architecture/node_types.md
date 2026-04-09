# Producer 节点类型与层白名单

## 节点建模原则

Producer 的节点用于表达创意语义，不用于表达可执行步骤。

- 节点承载的是 brief、镜头、提示词、候选结果、评审结论与参考材料。
- 节点不是任务队列项，不是 agent step，也不是 render pipeline 的状态机节点。
- 异步处理、导入、转码、生成等系统动作应归入 `jobs`，而不是强行画进图里。

## 当前代码中的规范节点类型

| `node_type` | 中文建议名 | 允许层 | 语义职责 |
| --- | --- | --- | --- |
| `brief` | Brief 节点 | `brief` | 承载项目级创意意图，例如商品、目标、受众、卖点、约束、主张 |
| `storyboard_shot` | 分镜节点 | `storyboard` | 承载单个镜头或段落，描述画面目标、动作、构图、时长、转场意图 |
| `prompt` | 提示词节点 | `shot_lab` | 承载文生图或文生视频的提示词、参数思路、生成策略 |
| `still` | 静帧候选节点 | `shot_lab` | 承载图片候选、关键帧候选、静态视觉方案 |
| `video` | 视频候选节点 | `shot_lab` | 承载视频片段候选、动态版本或动画尝试 |
| `reference` | 参考节点 | `shot_lab` | 承载参考图、参考视频、风格样本、竞品、拍法或本地素材线索 |
| `review` | 评审节点 | `shot_lab` | 承载人工点评、筛选意见、打回原因、通过结论 |
| `result` | 结果节点 | `shot_lab` | 承载被选中的输出、组合结果、交付版本或可导出的最终对象 |

## 分层白名单矩阵

| `layer_type` | 允许的用户节点 | 系统锚点 | 典型禁放节点 |
| --- | --- | --- | --- |
| `brief` | `brief` | 无 | `storyboard_shot`、`prompt`、`still`、`video`、`reference`、`review`、`result` |
| `storyboard` | `storyboard_shot` | `Brief Anchor` | `brief` 作为可编辑普通节点、以及全部 Shot Lab 节点 |
| `shot_lab` | `prompt`、`still`、`video`、`reference`、`review`、`result` | `Storyboard Anchor` | `brief`、`storyboard_shot` 作为可编辑普通节点 |

执行规则：

- 白名单约束先于用户习惯。
- 需要跨层表达的语义，应通过系统锚点、关系边或素材引用实现。
- 不允许把“上层节点复制进下层继续编辑”当成默认设计。

## 系统锚点不是普通节点类型

`Brief Anchor` 和 `Storyboard Anchor` 是系统锚点，不属于当前 `NodeKind` 白名单的一部分。

它们在产品语义上应具备以下属性：

- 只读。
- 固定在子图显著位置。
- 持有父层源节点的稳定引用。
- 作为“当前子图为何存在”的上下文根。

推荐把锚点视为“系统节点类别”，而不是把 `brief` 或 `storyboard_shot` 直接作为普通节点塞入不匹配的层。

## 推荐的 `payload_json` 语义字段

当前表结构只提供通用的 `payload_json`。下面是面向后续实现的建议字段，不是已经固化的数据库列。

| `node_type` | 推荐字段 |
| --- | --- |
| `brief` | `title`、`product`、`objective`、`audience`、`key_message`、`constraints`、`tone` |
| `storyboard_shot` | `title`、`shot_goal`、`visual_subject`、`camera`、`action`、`duration_ms`、`notes` |
| `prompt` | `title`、`prompt_text`、`negative_prompt`、`model_hint`、`seed_hint`、`params` |
| `still` | `title`、`status`、`selection_reason`、`render_meta`、`asset_refs` |
| `video` | `title`、`status`、`timeline_notes`、`render_meta`、`asset_refs` |
| `reference` | `title`、`reference_type`、`source`、`excerpt`、`asset_refs` |
| `review` | `title`、`decision`、`feedback`、`reviewer`、`reviewed_at` |
| `result` | `title`、`result_type`、`export_preset`、`summary`、`asset_refs` |

## 节点之间的常见关系

| 节点组合 | 推荐关系 | 含义 |
| --- | --- | --- |
| `brief` -> `brief` | `contains` / `references` | Brief 内部的结构整理或背景引用 |
| `storyboard_shot` -> `storyboard_shot` | `contains` / `approved_from` | 分镜组块或镜头版本确认 |
| `prompt` -> `reference` | `references` | 提示词依赖参考材料 |
| `still` / `video` -> `prompt` | `references` / `reuses` | 候选结果引用或复用某个提示词思路 |
| `still` -> `still`，`video` -> `video` | `variant_of` / `alternative_to` | 同类候选间的版本与替代关系 |
| `result` -> `still` / `video` / `review` | `approved_from` | 最终输出来自已确认的候选或评审结果 |

## 不应该怎么建模

以下内容不应成为图中的主语义节点：

- “开始生成”
- “等待转码”
- “执行 agent 第 3 步”
- “如果通过则进入下一步”

这些都属于系统行为或作业状态，应放进 `jobs`、`app_events` 或界面状态，而不是污染创意语义图。

## 当前实现与目标形态

当前仓库已经把上述 `node_type` 枚举写进模板校验逻辑，但还没有完整的节点 CRUD、锚点实例化和跨层导航落地。

因此这份文档的作用是先把边界钉死：

- 节点类型集合是有限的。
- 每层允许的节点类型是严格的。
- 系统锚点是跨层继承机制，不是绕过白名单的漏洞。
