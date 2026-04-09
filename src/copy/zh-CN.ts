import type {
  GraphContextTrailItem,
  GraphNodeSummary,
  ProjectTemplate,
} from '../bridge/contracts';

const NODE_TYPE_LABELS: Record<string, string> = {
  brief: '需求',
  storyboard_shot: '分镜头',
  prompt: '提示词',
  still: '静帧',
  video: '视频',
  reference: '参考',
  review: '评审',
  result: '结果',
  system_anchor: '上下文锚点',
};

const LAYER_LABELS: Record<string, string> = {
  brief: '需求层',
  storyboard: '分镜层',
  story: '分镜层',
  shot_lab: '镜头工作台',
  shot: '镜头工作台',
};

const GRAPH_NAME_LABELS: Record<string, string> = {
  'brief canvas': '需求层',
  'storyboard canvas': '分镜层',
  'shot lab canvas': '镜头工作台',
};

const RELATION_TYPE_LABELS: Record<string, string> = {
  contains: '包含',
  references: '参考',
  variant_of: '变体自',
  approved_from: '通过自',
  alternative_to: '替代',
  reuses: '复用',
};

const ASSET_ROLE_LABELS: Record<string, string> = {
  source: '来源',
  reference: '参考',
  preview: '预览',
  output: '输出',
  product_image: '产品图',
  example_video: '示例视频',
};

const FIELD_LABELS: Record<string, string> = {
  action: '动作',
  audience: '目标受众',
  camera: '镜头语言',
  constraints: '限制条件',
  decision: '结论',
  description: '需求描述',
  duration_ms: '时长（毫秒）',
  export_preset: '导出预设',
  excerpt: '摘录',
  feedback: '反馈意见',
  key_message: '核心信息',
  model_hint: '模型建议',
  negative_prompt: '负向提示词',
  notes: '备注',
  objective: '目标',
  product: '产品',
  prompt_text: '正向提示词',
  reference_type: '参考类型',
  result_type: '结果类型',
  reviewed_at: '评审时间',
  reviewer: '评审人',
  seed_hint: '种子建议',
  selection_reason: '选用原因',
  shot_goal: '镜头目标',
  source: '来源',
  status: '状态',
  summary: '总结',
  timeline_notes: '时间线备注',
  title: '标题',
  tone: '风格调性',
  visual_subject: '画面主体',
};

const ASSET_STATUS_LABELS: Record<string, string> = {
  error: '缩略图失败',
  missing: '文件缺失',
  none: '无缩略图',
  pending: '缩略图生成中',
  ready: '缩略图已就绪',
  unsupported: '不支持缩略图',
};

const TEMPLATE_NAME_LABELS: Record<string, string> = {
  ecommerce_ad_v1: '电商广告模板 V1',
  documentary: '纪录片策划模板',
};

const TEMPLATE_DESCRIPTION_LABELS: Record<string, string> = {
  ecommerce_ad_v1: '围绕需求、分镜与镜头工作台组织电商广告项目。',
  documentary: '用于纪录片前期策划与结构梳理的基础模板。',
};

function fallbackLabel(value: string): string {
  if (!value) {
    return '';
  }

  return value.replace(/_/g, ' ');
}

function isChineseText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

export function toUiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim() && isChineseText(error)) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim() && isChineseText(error.message)) {
    return error.message.trim();
  }

  return fallback;
}

export function normalizeErrorMessageZh(message: string, fallback = '操作未完成，请稍后重试。'): string {
  if (message.trim() && isChineseText(message)) {
    return message.trim();
  }

  return fallback;
}

export function formatNodeTypeLabelZh(nodeType: string, fallback?: string): string {
  return NODE_TYPE_LABELS[nodeType] ?? fallback ?? fallbackLabel(nodeType);
}

export function formatLayerLabelZh(layerType: string, fallback?: string): string {
  return LAYER_LABELS[layerType] ?? fallback ?? fallbackLabel(layerType);
}

export function formatGraphLabelZh(graphName?: string, layerType?: string): string {
  if (layerType && LAYER_LABELS[layerType]) {
    return LAYER_LABELS[layerType];
  }

  const normalized = graphName?.trim().toLowerCase();

  if (normalized && GRAPH_NAME_LABELS[normalized]) {
    return GRAPH_NAME_LABELS[normalized];
  }

  return graphName?.trim() || (layerType ? formatLayerLabelZh(layerType) : '');
}

export function formatGraphTrailLabelZh(item: GraphContextTrailItem): string {
  if (item.sourceNodeTitle && item.sourceNodeTitle.trim()) {
    return item.sourceNodeTitle;
  }

  return formatGraphLabelZh(item.graphName, item.layerType);
}

export function formatRelationTypeLabelZh(edgeType: string, fallback?: string): string {
  return RELATION_TYPE_LABELS[edgeType] ?? fallback ?? fallbackLabel(edgeType);
}

export function formatAssetRoleLabelZh(role: string, fallback?: string): string {
  return ASSET_ROLE_LABELS[role] ?? fallback ?? fallbackLabel(role);
}

export function formatFieldLabelZh(key: string, fallback?: string): string {
  return FIELD_LABELS[key] ?? fallback ?? fallbackLabel(key);
}

export function formatAssetStatusLabelZh(status?: string | null): string | null {
  if (!status) {
    return null;
  }

  return ASSET_STATUS_LABELS[status] ?? status;
}

export function formatTemplateNameZh(template: ProjectTemplate): string {
  return TEMPLATE_NAME_LABELS[template.id] ?? template.name;
}

export function formatTemplateDescriptionZh(template: ProjectTemplate): string | undefined {
  return TEMPLATE_DESCRIPTION_LABELS[template.id] ?? template.description;
}

export function formatSelectedNodeSummaryZh(node: GraphNodeSummary | null): string {
  if (!node) {
    return '未选中内容';
  }

  return `已选中：${node.title}`;
}

export function formatSelectedNodeCountZh(count: number): string {
  if (count <= 0) {
    return '未选中内容';
  }

  return `已选中 ${count} 个节点`;
}

export function formatSelectedEdgeSummaryZh(
  edge:
    | {
        relationType?: string | null;
        sourceTitle: string;
        targetTitle: string;
      }
    | null,
): string {
  if (!edge) {
    return '未选中内容';
  }

  return `已选中：${formatRelationTypeLabelZh(edge.relationType ?? '', '关系')}（${edge.sourceTitle} → ${edge.targetTitle}）`;
}

export function formatAssetCountZh(count: number): string {
  return `${count} 个素材`;
}

export function formatThumbnailCountZh(count: number): string {
  return `${count} 个缩略图`;
}

export function buildDefaultNodeTitleZh(nodeType: string): string {
  return `新建${formatNodeTypeLabelZh(nodeType)}`;
}

export function formatNodeDefaultTitleZh(nodeType: string, fallbackLabel?: string): string {
  return `新建${formatNodeTypeLabelZh(nodeType, fallbackLabel)}`;
}

export function formatCameraReadoutZh(x: number, y: number, zoom: number): string {
  return `横向 ${Math.round(x)} 纵向 ${Math.round(y)} 缩放 ${Math.round(zoom * 100)}%`;
}

export function formatAttachmentPreviewLabelZh(title: string): string {
  return `${title}附件预览`;
}

export function formatGraphSummaryLabelZh(graph: { name: string; layerType: string }): string {
  return formatGraphLabelZh(graph.name, graph.layerType);
}

export function formatBindAssetAriaLabelZh(title: string): string {
  return `绑定 ${title}`;
}

export function formatUnbindAssetAriaLabelZh(roleLabel: string): string {
  return `解绑 ${roleLabel}`;
}

export function formatRelationDeleteAriaLabelZh(
  relationId: string,
  relationType: string,
  nodeTitle: string,
  direction: 'incoming' | 'outgoing',
): string {
  return direction === 'incoming'
    ? `删除关系 ${relationId}：${relationType} ← ${nodeTitle}`
    : `删除关系 ${relationId}：${relationType} → ${nodeTitle}`;
}

export function formatRelationTypePlaceholderZh(): string {
  return '选择关系';
}

export function formatRelationTargetPlaceholderZh(): string {
  return '选择目标节点';
}

export const zhCN = {
  app: {
    bridgeUnavailable: '无法连接 Producer 后端。',
    invalidProjectSession: '无法加载项目会话。',
    sessionMissingGraph: '无法加载项目会话。',
    canvasAria: 'Producer 画布',
    toolbarAria: '工作区工具条',
    statusHudAria: '工作区状态条',
  },
  startup: {
    loadingEyebrow: 'Producer',
    loadingTitle: '正在准备工作区',
    loadingBody: '正在检查活动项目会话并加载可用模板。',
    errorEyebrow: '启动错误',
    errorTitle: 'Producer 启动失败',
    retryStartup: '重试启动',
    phaseLabel: '阶段 0 / 模块 A',
    title: '开始新的创作项目',
    body: '进入以画布为中心的工作区，并通过轻量浮层管理项目与启动操作。',
    templateListAria: '可用模板',
    launchActions: '启动操作',
    createProject: '新建项目',
    openProject: '打开项目',
    creatingProject: '正在创建项目…',
    openingProject: '正在打开项目…',
  },
  workspace: {
    switchingGraph: '正在切换画布',
    loadingNodes: '正在加载节点',
    nodeIndexUnavailable: '无法加载节点索引',
    indexingAssets: '正在索引素材',
    mediaIndexUnavailable: '无法获取素材索引',
    refreshMedia: '刷新素材',
    refreshingMedia: '刷新中',
    autoLayoutAll: '自动规整全部节点',
    autoLayoutSelected: '自动规整已选节点',
    autoLayoutRunning: '正在规整节点',
    autoLayoutDisabled: '至少需要 2 个可规整节点',
    noSelection: '未选中内容',
    selectedPrefix: '已选中：',
    emptyCanvasEyebrow: '空画布',
    emptyCanvasTitle: '当前画布还没有节点',
    emptyCanvasDescription: '按 Tab 创建第一个节点。',
    createNode: '创建节点',
    zoomAria: (zoom: string) => `缩放 ${zoom}`,
    selectionAria: (text: string) => `选中状态 ${text}`,
    mediaAria: (text: string) => `素材状态 ${text}`,
    noticeError: '状态错误',
  },
  canvas: {
    cameraReadout: (x: number, y: number, zoom: number) =>
      `横向 ${x} 纵向 ${y} 缩放 ${zoom}%`,
    emptyEyebrow: '空画布',
    emptyTitle: '当前画布还没有节点',
    emptyBody: '按 Tab 创建第一个节点。',
    createNode: '创建节点',
  },
  quickAdd: {
    dialogAria: '节点快速创建器',
    dialogLabel: '节点快速创建器',
    eyebrow: '快速创建',
    title: '插入节点',
    description: '为当前画布位置选择一个节点类型。',
    searchLabel: '搜索',
    searchInputAria: '搜索节点类型',
    searchAriaLabel: '搜索节点类型',
    loading: '正在加载节点类型',
    loadError: '无法加载当前画布可创建的节点类型。',
    optionsAria: '节点类型选项',
    optionsAriaLabel: '节点类型选项',
    submitHint: '回车',
    confirmHint: '回车',
    noResults: '没有匹配的节点类型。',
    empty: '没有匹配的节点类型。',
  },
  drawer: {
    aria: '节点内容抽屉',
    ariaLabel: '节点内容抽屉',
    closeAria: '关闭节点抽屉',
    closeAriaLabel: '关闭节点抽屉',
    closeText: '关闭',
    close: '关闭',
    nodeState: '节点状态',
    loadingTitle: '正在加载节点详情',
    loadingNodeDetail: '正在加载节点详情',
    loadingBody: 'Producer 正在打开当前选中节点的内容。',
    loadingNodeDetailDescription: 'Producer 正在打开当前选中节点的内容。',
    loadErrorTitle: '无法加载节点详情',
    nodeDetailErrorTitle: '无法加载节点详情',
    loadErrorBody: '无法加载当前节点详情。',
    nodeDetailErrorDescription: '无法加载当前节点详情。',
    details: '内容详情',
    sectionDetails: '内容详情',
    attachments: '附件',
    sectionAttachments: '附件',
    preview: '预览',
    attachmentPreviewFallback: '附件预览',
    noAttachments: '当前还没有绑定附件',
    noAttachmentsBound: '当前还没有绑定附件',
    attached: '已绑定',
    noAssetRoles: '当前节点没有可用的附件角色。',
    noAssetRolesConfigured: '当前节点没有可用的附件角色。',
    attachAsset: '绑定素材',
    attachmentRole: '附件角色',
    selectRole: '选择角色',
    searchAssets: '搜索素材',
    searchAssetsAria: '搜索素材',
    searchAssetsPlaceholder: '按文件名或路径搜索素材',
    searchingAssets: '正在搜索项目素材…',
    searchAssetsLoading: '正在搜索项目素材…',
    assetSearchError: '无法加载素材搜索结果。',
    searchAssetsError: '无法加载素材搜索结果。',
    availableAttachmentsAria: '可绑定附件',
    availableAttachments: '可绑定附件',
    attach: '绑定',
    attachAction: '绑定',
    noMatchingAssets: '没有匹配的素材。',
    relations: '关系',
    sectionRelations: '关系',
    noRelations: '当前节点还没有关系。',
    outgoing: '发出关系',
    incoming: '进入关系',
    noOutgoing: '没有发出关系。',
    noOutgoingRelations: '没有发出关系。',
    noIncoming: '没有进入关系。',
    noIncomingRelations: '没有进入关系。',
    addRelation: '添加关系',
    relationType: '关系类型',
    selectRelation: '选择关系',
    targetNode: '目标节点',
    selectTarget: '选择目标节点',
    selectTargetNode: '选择目标节点',
    addRelationPending: '正在添加关系…',
    addingRelation: '正在添加关系…',
    addRelationSubmit: '添加关系',
    extras: '其他字段',
    sectionExtras: '其他字段',
    saveSaving: '正在保存到本地…',
    saveError: '无法保存到本地',
    saveReady: '已保存到本地',
    unknownNode: '未知节点',
    remove: '移除',
    removeAction: '解绑',
    delete: '删除',
    deleteRelation: '删除',
    missingAsset: '文件缺失',
    nothingBound: '尚未绑定内容',
    briefDescription: '需求描述',
    briefProductImage: '产品图',
    briefExampleVideo: '示例视频',
    briefProductImageSearch: '搜索产品图素材',
    briefExampleVideoSearch: '搜索示例视频素材',
    briefSearchProductImagePlaceholder: '按文件名或路径搜索产品图素材',
    briefSearchExampleVideoPlaceholder: '按文件名或路径搜索示例视频素材',
    briefNoProductImage: '尚未绑定产品图',
    briefNoExampleVideo: '尚未绑定示例视频',
  },
} as const;
