import type { GraphNodeSummary, GraphNodeTypeOption } from '../bridge/contracts';
import { formatNodeTypeLabelZh } from '../copy/zh-CN';

export type ProducerHandlePosition = 'top' | 'bottom';

export type ProducerNodeChroma = 'simple' | 'action-bar' | 'annotation';

export type ProducerNodeType =
  | 'demand'
  | 'demand_anchor'
  | 'shot'
  | 'shot_anchor'
  | 'prompt'
  | 'frame'
  | 'video'
  | 'reference'
  | 'review'
  | 'selected_result'
  | 'placeholder_add'
  | 'group_candidates';

export type ProducerNodeStatusTone = 'initial' | 'loading' | 'error' | 'success';

export type ProducerNodeVisual = {
  appendixLabel: string | null;
  chroma: ProducerNodeChroma;
  handleMode: 'default';
  producerType: ProducerNodeType;
  showStatusIndicator: boolean;
  sourceHandle: ProducerHandlePosition | null;
  statusTone: ProducerNodeStatusTone;
  targetHandle: ProducerHandlePosition | null;
  weak: boolean;
};

const SHOT_LAB_NODE_TYPES = ['prompt', 'still', 'video', 'reference', 'review', 'result'] as const;

function normalizeLayerType(layerType: string): string {
  switch (layerType) {
    case 'story':
      return 'storyboard';
    case 'shot':
      return 'shot_lab';
    default:
      return layerType;
  }
}

function resolveAnchorProducerType(node: Pick<GraphNodeSummary, 'sourceNodeType'>): ProducerNodeType {
  return node.sourceNodeType === 'storyboard_shot' ? 'shot_anchor' : 'demand_anchor';
}

function resolveStatusTone(status?: string): ProducerNodeStatusTone {
  const normalizedStatus = status?.trim().toLowerCase() ?? '';

  if (!normalizedStatus) {
    return 'initial';
  }

  if (
    normalizedStatus.includes('error') ||
    normalizedStatus.includes('fail') ||
    normalizedStatus.includes('invalid')
  ) {
    return 'error';
  }

  if (
    normalizedStatus.includes('load') ||
    normalizedStatus.includes('render') ||
    normalizedStatus.includes('pending') ||
    normalizedStatus.includes('queue') ||
    normalizedStatus.includes('process')
  ) {
    return 'loading';
  }

  if (
    normalizedStatus.includes('success') ||
    normalizedStatus.includes('ready') ||
    normalizedStatus.includes('approved') ||
    normalizedStatus.includes('done') ||
    normalizedStatus.includes('final')
  ) {
    return 'success';
  }

  return 'initial';
}

export function formatProducerNodeTypeLabelZh(
  node: Pick<GraphNodeSummary, 'nodeType' | 'isSystem' | 'sourceNodeType'>,
): string {
  if (node.isSystem && node.nodeType === 'system_anchor') {
    return node.sourceNodeType === 'storyboard_shot' ? '分镜锚点' : '需求锚点';
  }

  switch (node.nodeType) {
    case 'brief':
      return '需求';
    case 'storyboard_shot':
      return '分镜头';
    case 'still':
      return '静帧';
    case 'result':
      return '结果';
    default:
      return formatNodeTypeLabelZh(node.nodeType);
  }
}

export function filterProducerNodeTypeOptionsForLayer(
  layerType: string,
  options: GraphNodeTypeOption[],
): GraphNodeTypeOption[] {
  const normalizedLayer = normalizeLayerType(layerType);

  return options.filter((option) => {
    if (option.nodeType === 'system_anchor') {
      return false;
    }

    switch (normalizedLayer) {
      case 'brief':
        return option.nodeType === 'brief';
      case 'storyboard':
        return option.nodeType === 'storyboard_shot';
      case 'shot_lab':
        return SHOT_LAB_NODE_TYPES.includes(option.nodeType as (typeof SHOT_LAB_NODE_TYPES)[number]);
      default:
        return false;
    }
  });
}

export function resolveProducerNodeVisual(
  node: Pick<GraphNodeSummary, 'nodeType' | 'isSystem' | 'sourceNodeType' | 'status'>,
): ProducerNodeVisual {
  if (node.isSystem && node.nodeType === 'system_anchor') {
    return {
      appendixLabel: null,
      chroma: 'simple',
      handleMode: 'default',
      producerType: resolveAnchorProducerType(node),
      showStatusIndicator: false,
      sourceHandle: 'bottom',
      statusTone: 'initial',
      targetHandle: null,
      weak: true,
    };
  }

  switch (node.nodeType) {
    case 'brief':
      return {
        appendixLabel: null,
        chroma: 'simple',
        handleMode: 'default',
        producerType: 'demand',
        showStatusIndicator: false,
        sourceHandle: 'bottom',
        statusTone: 'initial',
        targetHandle: 'top',
        weak: false,
      };
    case 'storyboard_shot':
      return {
        appendixLabel: null,
        chroma: 'simple',
        handleMode: 'default',
        producerType: 'shot',
        showStatusIndicator: false,
        sourceHandle: 'bottom',
        statusTone: 'initial',
        targetHandle: 'top',
        weak: false,
      };
    case 'prompt':
      return {
        appendixLabel: null,
        chroma: 'action-bar',
        handleMode: 'default',
        producerType: 'prompt',
        showStatusIndicator: false,
        sourceHandle: 'bottom',
        statusTone: 'initial',
        targetHandle: 'top',
        weak: false,
      };
    case 'still':
      return {
        appendixLabel: null,
        chroma: 'action-bar',
        handleMode: 'default',
        producerType: 'frame',
        showStatusIndicator: true,
        sourceHandle: 'bottom',
        statusTone: resolveStatusTone(node.status),
        targetHandle: 'top',
        weak: false,
      };
    case 'video':
      return {
        appendixLabel: null,
        chroma: 'action-bar',
        handleMode: 'default',
        producerType: 'video',
        showStatusIndicator: true,
        sourceHandle: 'bottom',
        statusTone: resolveStatusTone(node.status),
        targetHandle: 'top',
        weak: false,
      };
    case 'reference':
      return {
        appendixLabel: null,
        chroma: 'action-bar',
        handleMode: 'default',
        producerType: 'reference',
        showStatusIndicator: false,
        sourceHandle: 'bottom',
        statusTone: 'initial',
        targetHandle: 'top',
        weak: false,
      };
    case 'review':
      return {
        appendixLabel: null,
        chroma: 'annotation',
        handleMode: 'default',
        producerType: 'review',
        showStatusIndicator: false,
        sourceHandle: 'bottom',
        statusTone: 'initial',
        targetHandle: 'top',
        weak: false,
      };
    case 'result':
      return {
        appendixLabel: 'Selected',
        chroma: 'simple',
        handleMode: 'default',
        producerType: 'selected_result',
        showStatusIndicator: true,
        sourceHandle: 'bottom',
        statusTone: 'success',
        targetHandle: 'top',
        weak: false,
      };
    default:
      return {
        appendixLabel: null,
        chroma: 'simple',
        handleMode: 'default',
        producerType: 'demand',
        showStatusIndicator: false,
        sourceHandle: 'bottom',
        statusTone: 'initial',
        targetHandle: 'top',
        weak: false,
      };
  }
}
