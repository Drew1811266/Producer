import type { GraphNodeSummary } from '../bridge/contracts';
import { formatNodeTypeLabelZh } from '../copy/zh-CN';
import type { CameraState, ViewportSize } from './camera';
import { panCamera, sanitizeCamera } from './camera';
import { createNodeLodMetrics, resolveNodeLod, type NodeLodLevel } from './lod';
import { resolveNodeMasterSize } from './nodeTemplate';

export type ProjectedGraphNode = GraphNodeSummary & {
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  projectedArea: number;
  projectedMinEdge: number;
  scaleFactor: number;
  masterWidth: number;
  masterHeight: number;
  lod: NodeLodLevel;
};

export type ViewportInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function formatNodeTypeLabel(nodeType: string): string {
  return formatNodeTypeLabelZh(nodeType);
}

export function projectGraphNode(
  node: GraphNodeSummary,
  camera: CameraState,
  viewport: ViewportSize,
): ProjectedGraphNode {
  const safeCamera = sanitizeCamera(camera);
  const screenWidth = node.layout.width * safeCamera.zoom;
  const screenHeight = node.layout.height * safeCamera.zoom;
  const masterSize = resolveNodeMasterSize(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });
  const lodMetrics = createNodeLodMetrics(
    screenWidth,
    screenHeight,
    masterSize.width,
    masterSize.height,
  );

  return {
    ...node,
    screenX: viewport.width / 2 + safeCamera.x + node.layout.x * safeCamera.zoom,
    screenY: viewport.height / 2 + safeCamera.y + node.layout.y * safeCamera.zoom,
    screenWidth,
    screenHeight,
    projectedArea: lodMetrics.projectedArea,
    projectedMinEdge: lodMetrics.projectedMinEdge,
    scaleFactor: lodMetrics.scaleFactor,
    masterWidth: masterSize.width,
    masterHeight: masterSize.height,
    lod: resolveNodeLod(lodMetrics),
  };
}

export function projectGraphNodes(
  nodes: GraphNodeSummary[],
  camera: CameraState,
  viewport: ViewportSize,
): ProjectedGraphNode[] {
  return nodes.map((node) => projectGraphNode(node, camera, viewport));
}

export function panCameraToRevealNode(
  node: GraphNodeSummary,
  camera: CameraState,
  viewport: ViewportSize,
  insets: ViewportInsets,
): CameraState {
  const projectedNode = projectGraphNode(node, camera, viewport);
  const visibleLeft = insets.left;
  const visibleRight = viewport.width - insets.right;
  const visibleTop = insets.top;
  const visibleBottom = viewport.height - insets.bottom;
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const projectedNodeCenterX = projectedNode.screenX + projectedNode.screenWidth / 2;
  const projectedNodeCenterY = projectedNode.screenY + projectedNode.screenHeight / 2;
  const visibleCenterX = visibleLeft + visibleWidth / 2;
  const visibleCenterY = visibleTop + visibleHeight / 2;

  let deltaX = 0;
  let deltaY = 0;

  if (projectedNode.screenWidth > visibleWidth) {
    deltaX = visibleCenterX - projectedNodeCenterX;
  } else if (projectedNode.screenX < visibleLeft) {
    deltaX = visibleLeft - projectedNode.screenX;
  } else if (projectedNode.screenX + projectedNode.screenWidth > visibleRight) {
    deltaX = visibleRight - (projectedNode.screenX + projectedNode.screenWidth);
  }

  if (projectedNode.screenHeight > visibleHeight) {
    deltaY = visibleCenterY - projectedNodeCenterY;
  } else if (projectedNode.screenY < visibleTop) {
    deltaY = visibleTop - projectedNode.screenY;
  } else if (projectedNode.screenY + projectedNode.screenHeight > visibleBottom) {
    deltaY = visibleBottom - (projectedNode.screenY + projectedNode.screenHeight);
  }

  if (deltaX === 0 && deltaY === 0) {
    return sanitizeCamera(camera);
  }

  return panCamera(camera, deltaX, deltaY);
}
