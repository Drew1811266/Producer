import type { ProjectedGraphNode } from './nodeProjection';
import { formatRelationTypeLabelZh } from '../copy/zh-CN';
import { usesPortGridShell } from './nodeTemplate';
import { buildNodePresentation } from './nodePresentation';

export type CanvasEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType?: string;
  relationType?: string;
};

export type CanvasEdgeEmphasis = 'muted' | 'selected';

export type VisibleCanvasEdge = CanvasEdge & {
  selected: boolean;
  emphasis: CanvasEdgeEmphasis;
  labelText: string | null;
  showLabel: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeAlpha: number;
  labelColor: string;
  labelBackground: string;
  sourceNode: ProjectedGraphNode;
  targetNode: ProjectedGraphNode;
};

export type EdgeCoordinateSpace = 'screen' | 'world';

export type EdgePoint = {
  x: number;
  y: number;
};

export function resolveVisibleCanvasEdges(
  edges: CanvasEdge[],
  projectedNodes: ProjectedGraphNode[],
  selectedNodeId: string | null,
): VisibleCanvasEdge[] {
  const nodesById = new Map(projectedNodes.map((node) => [node.id, node]));
  const userNodes = projectedNodes.filter((node) => !node.isSystem);
  const isCondensed =
    userNodes.length > 0 &&
    userNodes.every((node) => node.lod === 'chip' || node.lod === 'silhouette');

  if (isCondensed && !selectedNodeId) {
    return [];
  }

  return edges.flatMap((edge) => {
    const sourceNode = nodesById.get(edge.sourceNodeId);
    const targetNode = nodesById.get(edge.targetNodeId);

    if (!sourceNode || !targetNode) {
      return [];
    }

    const selected =
      selectedNodeId != null &&
      (sourceNode.id === selectedNodeId || targetNode.id === selectedNodeId);
    const labelText = formatEdgeLabel(edge);
    const readableEdge =
      (sourceNode.lod === 'detail' || sourceNode.lod === 'summary') &&
      (targetNode.lod === 'detail' || targetNode.lod === 'summary');
    const emphasis: CanvasEdgeEmphasis = selected ? 'selected' : 'muted';

    if (isCondensed && !selected) {
      return [];
    }

    return [
      {
        ...edge,
        selected,
        emphasis,
        labelText,
        showLabel: selected && Boolean(labelText),
        strokeColor: selected ? '#d4c1a4' : '#8e99a5',
        strokeWidth: selected ? 2.3 : readableEdge ? 1.35 : 1.1,
        strokeAlpha: selected ? 0.88 : readableEdge ? 0.32 : 0.22,
        labelColor: selected ? '#f1ece3' : '#bcc5cd',
        labelBackground: selected ? '#2a2621' : '#2d3338',
        sourceNode,
        targetNode,
      },
    ];
  });
}

export function buildCanvasEdgePolyline(
  sourceNode: ProjectedGraphNode,
  targetNode: ProjectedGraphNode,
  coordinateSpace: EdgeCoordinateSpace,
): EdgePoint[] {
  const sourceBounds = getNodeBounds(sourceNode, coordinateSpace);
  const targetBounds = getNodeBounds(targetNode, coordinateSpace);
  const sourceUsesPorts = usesPortGridShell(sourceNode.nodeType, {
    isSystem: sourceNode.isSystem,
    sourceNodeType: sourceNode.sourceNodeType,
  });
  const targetUsesPorts = usesPortGridShell(targetNode.nodeType, {
    isSystem: targetNode.isSystem,
    sourceNodeType: targetNode.sourceNodeType,
  });

  if (sourceUsesPorts || targetUsesPorts) {
    const sourcePresentation = buildNodePresentation(sourceNode, false);
    const targetPresentation = buildNodePresentation(targetNode, false);
    const sourcePortHeight = sourceUsesPorts
      ? sourcePresentation.outputPortHeight
      : 0;
    const sourcePortOffset = sourceUsesPorts
      ? sourcePresentation.outputPortOffsetY
      : 0;
    const targetPortHeight = targetUsesPorts
      ? targetPresentation.inputPortHeight
      : 0;
    const targetPortOffset = targetUsesPorts
      ? targetPresentation.inputPortOffsetY
      : 0;
    const start = {
      x: sourceBounds.x + sourceBounds.width / 2,
      y: sourceBounds.y + sourceBounds.height + sourcePortOffset - sourcePortHeight / 2,
    };
    const end = {
      x: targetBounds.x + targetBounds.width / 2,
      y: targetBounds.y - targetPortOffset + targetPortHeight / 2,
    };
    const midY = start.y + (end.y - start.y) / 2;

    return [
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end,
    ];
  }

  const sourceCenterX = sourceBounds.x + sourceBounds.width / 2;
  const targetCenterX = targetBounds.x + targetBounds.width / 2;
  const sourceCenterY = sourceBounds.y + sourceBounds.height / 2;
  const targetCenterY = targetBounds.y + targetBounds.height / 2;
  const flowsRight = sourceCenterX <= targetCenterX;
  const start = {
    x: flowsRight ? sourceBounds.x + sourceBounds.width : sourceBounds.x,
    y: sourceCenterY,
  };
  const end = {
    x: flowsRight ? targetBounds.x : targetBounds.x + targetBounds.width,
    y: targetCenterY,
  };
  const midX = start.x + (end.x - start.x) / 2;

  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end,
  ];
}

export function buildCanvasEdgePath(points: EdgePoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function resolveCanvasEdgeLabelPoint(points: EdgePoint[]): EdgePoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length < 4) {
    return points[Math.floor(points.length / 2)] ?? points[0];
  }

  return {
    x: points[1].x,
    y: points[1].y + (points[2].y - points[1].y) / 2,
  };
}

function getNodeBounds(
  node: ProjectedGraphNode,
  coordinateSpace: EdgeCoordinateSpace,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (coordinateSpace === 'world') {
    return {
      x: node.layout.x,
      y: node.layout.y,
      width: node.layout.width,
      height: node.layout.height,
    };
  }

  return {
    x: node.screenX,
    y: node.screenY,
    width: node.screenWidth,
    height: node.screenHeight,
  };
}

function formatEdgeLabel(edge: CanvasEdge): string | null {
  const rawLabel = edge.relationType ?? edge.edgeType ?? '';

  if (!rawLabel.trim()) {
    return null;
  }

  return formatRelationTypeLabelZh(rawLabel);
}
