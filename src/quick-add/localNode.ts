import type { CreateGraphNodeRequest, GraphNodeTypeOption } from '../bridge/contracts';
import { formatNodeDefaultTitleZh } from '../copy/zh-CN';
import { getDrawerFieldSpecs } from '../drawer/nodeFields';
import type { CanvasQuickAddAnchor } from './types';

function formatFallbackTitle(nodeType: string) {
  return formatNodeDefaultTitleZh(nodeType);
}

function resolveDefaultTitle(option: GraphNodeTypeOption): string {
  const localizedTitle = formatNodeDefaultTitleZh(option.nodeType);

  if (localizedTitle && localizedTitle !== `新建${option.nodeType}`) {
    return localizedTitle;
  }

  if (
    typeof option.defaultTitle === 'string' &&
    option.defaultTitle.trim() &&
    /[\u3400-\u9fff]/u.test(option.defaultTitle)
  ) {
    return option.defaultTitle;
  }

  if (typeof option.label === 'string' && option.label.trim()) {
    return formatNodeDefaultTitleZh(option.nodeType, option.label);
  }

  return formatFallbackTitle(option.nodeType);
}

function createGraphNodePayload(option: GraphNodeTypeOption): Record<string, unknown> {
  const payload = Object.fromEntries(getDrawerFieldSpecs(option.nodeType).map((field) => [field.key, '']));

  return {
    ...payload,
    title: resolveDefaultTitle(option),
  };
}

export function buildGraphNodeCreateRequest({
  anchor,
  graphId,
  option,
}: {
  anchor: CanvasQuickAddAnchor;
  graphId: string;
  option: GraphNodeTypeOption;
}): Pick<CreateGraphNodeRequest, 'graphId' | 'nodeType' | 'position' | 'payload'> {
  return {
    graphId,
    nodeType: option.nodeType,
    position: {
      x: anchor.worldX,
      y: anchor.worldY,
    },
    payload: createGraphNodePayload(option),
  };
}
