import type { GraphEdgeSummary, GraphNodePosition, GraphNodeSummary } from '../bridge/contracts';

export type AutoLayoutResult = {
  nodeId: string;
  position: GraphNodePosition;
};

const COLUMN_GAP = 96;
const LAYER_GAP = 120;

type LayoutNode = {
  id: string;
  node: GraphNodeSummary;
  stableIndex: number;
};

function compareLayoutNodes(a: LayoutNode, b: LayoutNode): number {
  if (a.node.layout.y !== b.node.layout.y) {
    return a.node.layout.y - b.node.layout.y;
  }

  if (a.node.layout.x !== b.node.layout.x) {
    return a.node.layout.x - b.node.layout.x;
  }

  return a.id.localeCompare(b.id);
}

function computeBoundingCenter(nodes: GraphNodeSummary[]): { x: number; y: number } {
  const minX = Math.min(...nodes.map((node) => node.layout.x));
  const minY = Math.min(...nodes.map((node) => node.layout.y));
  const maxX = Math.max(...nodes.map((node) => node.layout.x + node.layout.width));
  const maxY = Math.max(...nodes.map((node) => node.layout.y + node.layout.height));

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

export function computeAutoLayout(
  nodes: GraphNodeSummary[],
  edges: GraphEdgeSummary[],
): AutoLayoutResult[] {
  if (nodes.length === 0) {
    return [];
  }

  const layoutNodes = nodes
    .map((node, index) => ({
      id: node.id,
      node,
      stableIndex: index,
    }))
    .sort(compareLayoutNodes);
  const nodeIds = new Set(layoutNodes.map((layoutNode) => layoutNode.id));
  const stableOrderById = new Map(layoutNodes.map((layoutNode, index) => [layoutNode.id, index]));
  const filteredEdges = edges.filter(
    (edge) =>
      edge.sourceNodeId !== edge.targetNodeId &&
      nodeIds.has(edge.sourceNodeId) &&
      nodeIds.has(edge.targetNodeId),
  );
  const incomingById = new Map<string, string[]>();
  const outgoingById = new Map<string, string[]>();
  const indegreeById = new Map<string, number>();

  for (const layoutNode of layoutNodes) {
    incomingById.set(layoutNode.id, []);
    outgoingById.set(layoutNode.id, []);
    indegreeById.set(layoutNode.id, 0);
  }

  for (const edge of filteredEdges) {
    outgoingById.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    incomingById.get(edge.targetNodeId)?.push(edge.sourceNodeId);
    indegreeById.set(edge.targetNodeId, (indegreeById.get(edge.targetNodeId) ?? 0) + 1);
  }

  for (const edgeIds of outgoingById.values()) {
    edgeIds.sort((left, right) => (stableOrderById.get(left) ?? 0) - (stableOrderById.get(right) ?? 0));
  }

  for (const edgeIds of incomingById.values()) {
    edgeIds.sort((left, right) => (stableOrderById.get(left) ?? 0) - (stableOrderById.get(right) ?? 0));
  }

  const queue = layoutNodes
    .filter((layoutNode) => (indegreeById.get(layoutNode.id) ?? 0) === 0)
    .map((layoutNode) => layoutNode.id);
  const processed = new Set<string>();
  const layerById = new Map<string, number>();

  while (queue.length > 0) {
    queue.sort((left, right) => (stableOrderById.get(left) ?? 0) - (stableOrderById.get(right) ?? 0));
    const nodeId = queue.shift();

    if (!nodeId || processed.has(nodeId)) {
      continue;
    }

    processed.add(nodeId);
    const currentLayer = layerById.get(nodeId) ?? 0;

    for (const childId of outgoingById.get(nodeId) ?? []) {
      layerById.set(childId, Math.max(layerById.get(childId) ?? 0, currentLayer + 1));

      const nextIndegree = (indegreeById.get(childId) ?? 0) - 1;
      indegreeById.set(childId, nextIndegree);

      if (nextIndegree === 0) {
        queue.push(childId);
      }
    }
  }

  const assignedLayers = [...layerById.values()];
  let nextFallbackLayer = assignedLayers.length === 0 ? 0 : Math.max(...assignedLayers) + 1;

  for (const layoutNode of layoutNodes) {
    if (processed.has(layoutNode.id)) {
      continue;
    }

    layerById.set(layoutNode.id, nextFallbackLayer);
    nextFallbackLayer += 1;
  }

  const layerIds = [...new Set(layoutNodes.map((layoutNode) => layerById.get(layoutNode.id) ?? 0))].sort(
    (left, right) => left - right,
  );
  const layers = layerIds.map((layerId) =>
    layoutNodes.filter((layoutNode) => (layerById.get(layoutNode.id) ?? 0) === layerId),
  );
  const layerHeights = layers.map((layer) =>
    Math.max(...layer.map((layoutNode) => layoutNode.node.layout.height)),
  );
  const totalHeight =
    layerHeights.reduce((sum, height) => sum + height, 0) + Math.max(layers.length - 1, 0) * LAYER_GAP;
  const anchor = computeBoundingCenter(nodes);
  const positionById = new Map<string, GraphNodePosition>();
  const normalizedCenterXById = new Map<string, number>();
  let currentTop = -totalHeight / 2;

  for (const [layerIndex, layer] of layers.entries()) {
    const layerHeight = layerHeights[layerIndex] ?? 0;
    const orderedLayer = [...layer].sort((left, right) => {
      const leftParents = (incomingById.get(left.id) ?? []).filter(
        (parentId) => (layerById.get(parentId) ?? 0) < (layerById.get(left.id) ?? 0),
      );
      const rightParents = (incomingById.get(right.id) ?? []).filter(
        (parentId) => (layerById.get(parentId) ?? 0) < (layerById.get(right.id) ?? 0),
      );
      const leftCurrentCenter = left.node.layout.x + left.node.layout.width / 2;
      const rightCurrentCenter = right.node.layout.x + right.node.layout.width / 2;
      const leftParentCenter =
        leftParents.length > 0
          ? leftParents.reduce((sum, parentId) => sum + (normalizedCenterXById.get(parentId) ?? 0), 0) / leftParents.length
          : leftCurrentCenter - anchor.x;
      const rightParentCenter =
        rightParents.length > 0
          ? rightParents.reduce((sum, parentId) => sum + (normalizedCenterXById.get(parentId) ?? 0), 0) / rightParents.length
          : rightCurrentCenter - anchor.x;

      if (leftParentCenter !== rightParentCenter) {
        return leftParentCenter - rightParentCenter;
      }

      if (leftCurrentCenter !== rightCurrentCenter) {
        return leftCurrentCenter - rightCurrentCenter;
      }

      return left.stableIndex - right.stableIndex;
    });
    const totalWidth =
      orderedLayer.reduce((sum, layoutNode) => sum + layoutNode.node.layout.width, 0) +
      Math.max(orderedLayer.length - 1, 0) * COLUMN_GAP;
    let currentLeft = -totalWidth / 2;

    for (const layoutNode of orderedLayer) {
      const position = {
        x: anchor.x + currentLeft,
        y: anchor.y + currentTop + (layerHeight - layoutNode.node.layout.height) / 2,
      };

      positionById.set(layoutNode.id, position);
      normalizedCenterXById.set(layoutNode.id, currentLeft + layoutNode.node.layout.width / 2);
      currentLeft += layoutNode.node.layout.width + COLUMN_GAP;
    }

    currentTop += layerHeight + LAYER_GAP;
  }

  return nodes.map((node) => ({
    nodeId: node.id,
    position: positionById.get(node.id) ?? {
      x: node.layout.x,
      y: node.layout.y,
    },
  }));
}
