import { Position, type Node } from '@xyflow/react';

import type {
  GraphNodeSummary,
  ProjectGraphSummary,
} from '../bridge/contracts';
import type { ProducerCanvasNodeData } from './ProducerCanvasNode';
import { resolveProducerNodeVisual, type ProducerNodeVisual } from './producerNodeSystem';

function areGraphNodeLayoutsEqual(a: GraphNodeSummary['layout'], b: GraphNodeSummary['layout']): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function areGraphNodeSummariesEqual(a: GraphNodeSummary, b: GraphNodeSummary): boolean {
  return (
    a.id === b.id &&
    a.graphId === b.graphId &&
    a.title === b.title &&
    a.nodeType === b.nodeType &&
    a.sourceNodeType === b.sourceNodeType &&
    a.storedAssetCount === b.storedAssetCount &&
    a.status === b.status &&
    a.isSystem === b.isSystem &&
    a.canEnterChildGraph === b.canEnterChildGraph &&
    areGraphNodeLayoutsEqual(a.layout, b.layout)
  );
}

function areProducerNodeVisualsEqual(a: ProducerNodeVisual, b: ProducerNodeVisual): boolean {
  return (
    a.appendixLabel === b.appendixLabel &&
    a.chroma === b.chroma &&
    a.handleMode === b.handleMode &&
    a.producerType === b.producerType &&
    a.showStatusIndicator === b.showStatusIndicator &&
    a.sourceHandle === b.sourceHandle &&
    a.statusTone === b.statusTone &&
    a.targetHandle === b.targetHandle &&
    a.weak === b.weak
  );
}

function areProducerCanvasNodeDataEqual(a: ProducerCanvasNodeData, b: ProducerCanvasNodeData): boolean {
  return (
    a.actions.onEnterNode === b.actions.onEnterNode &&
    a.actions.onInspectNode === b.actions.onInspectNode &&
    a.graphLayerType === b.graphLayerType &&
    areGraphNodeSummariesEqual(a.node, b.node) &&
    areProducerNodeVisualsEqual(a.visual, b.visual)
  );
}

function areFlowNodeStylesEqual(
  a: Node<ProducerCanvasNodeData>['style'],
  b: Node<ProducerCanvasNodeData>['style'],
): boolean {
  return a?.height === b?.height && a?.width === b?.width;
}

function areFlowNodeMeasurementsEqual(
  a: Node<ProducerCanvasNodeData>['measured'],
  b: Node<ProducerCanvasNodeData>['measured'],
): boolean {
  return a?.height === b?.height && a?.width === b?.width;
}

function areFlowNodesEquivalent(
  current: Node<ProducerCanvasNodeData>,
  next: Node<ProducerCanvasNodeData>,
): boolean {
  return (
    current.id === next.id &&
    current.type === next.type &&
    current.position.x === next.position.x &&
    current.position.y === next.position.y &&
    current.connectable === next.connectable &&
    current.draggable === next.draggable &&
    current.dragHandle === next.dragHandle &&
    current.height === next.height &&
    current.initialHeight === next.initialHeight &&
    current.initialWidth === next.initialWidth &&
    current.selectable === next.selectable &&
    current.selected === next.selected &&
    current.sourcePosition === next.sourcePosition &&
    current.targetPosition === next.targetPosition &&
    current.width === next.width &&
    areFlowNodeMeasurementsEqual(current.measured, next.measured) &&
    areFlowNodeStylesEqual(current.style, next.style) &&
    areProducerCanvasNodeDataEqual(current.data, next.data)
  );
}

function shouldRefreshFlowNodeInternals(
  current: Node<ProducerCanvasNodeData>,
  merged: Node<ProducerCanvasNodeData>,
): boolean {
  return (
    current.connectable !== merged.connectable ||
    current.height !== merged.height ||
    current.initialHeight !== merged.initialHeight ||
    current.initialWidth !== merged.initialWidth ||
    current.sourcePosition !== merged.sourcePosition ||
    current.targetPosition !== merged.targetPosition ||
    current.width !== merged.width ||
    !areFlowNodeStylesEqual(current.style, merged.style)
  );
}

export type FlowNodeReconciliation = {
  nodes: Array<Node<ProducerCanvasNodeData>>;
  nodesNeedingInternalsRefresh: string[];
};

export function buildFlowNodes({
  disableNodeDrag,
  graph,
  nodes,
  onEnterNode,
  onInspectNode,
  selectedNodeIds,
}: {
  disableNodeDrag: boolean;
  graph: ProjectGraphSummary;
  nodes: GraphNodeSummary[];
  onEnterNode(nodeId: string): void;
  onInspectNode(nodeId: string): void;
  selectedNodeIds: string[];
}): Array<Node<ProducerCanvasNodeData>> {
  const selectedNodeIdSet = new Set(selectedNodeIds);

  return nodes.map((node) => {
    const visual = resolveProducerNodeVisual(node);
    const sourcePosition =
      visual.sourceHandle === 'top'
        ? Position.Top
        : visual.sourceHandle === 'bottom'
          ? Position.Bottom
          : undefined;
    const targetPosition =
      visual.targetHandle === 'top'
        ? Position.Top
        : visual.targetHandle === 'bottom'
          ? Position.Bottom
          : undefined;

    return {
      id: node.id,
      type: 'producer-node',
      position: {
        x: node.layout.x,
        y: node.layout.y,
      },
      data: {
        actions: {
          onEnterNode,
          onInspectNode,
        },
        graphLayerType: graph.layerType,
        node,
        visual,
      },
      connectable: node.isSystem
        ? visual.sourceHandle !== null || visual.targetHandle !== null
        : undefined,
      draggable: !disableNodeDrag && !node.isSystem,
      dragHandle: node.isSystem ? undefined : '.producer-node-drag-handle',
      height: node.layout.height,
      initialHeight: node.layout.height,
      initialWidth: node.layout.width,
      selectable: !node.isSystem,
      sourcePosition,
      style: {
        height: node.layout.height,
        width: node.layout.width,
      },
      targetPosition,
      width: node.layout.width,
      selected: selectedNodeIdSet.has(node.id),
    } satisfies Node<ProducerCanvasNodeData, 'producer-node'>;
  });
}

export function reconcileFlowNodesWithMetadata(
  current: Array<Node<ProducerCanvasNodeData>>,
  next: Array<Node<ProducerCanvasNodeData>>,
): FlowNodeReconciliation {
  const currentById = new Map(current.map((node) => [node.id, node]));
  let changed = current.length !== next.length;
  const nodesNeedingInternalsRefresh: string[] = [];

  const reconciledNodes = next.map((nextNode) => {
    const currentNode = currentById.get(nextNode.id);

    if (!currentNode) {
      changed = true;
      return nextNode;
    }

    const mergedNode =
      currentNode.measured && !nextNode.measured
        ? {
            ...nextNode,
            measured: currentNode.measured,
          }
        : nextNode;

    if (shouldRefreshFlowNodeInternals(currentNode, mergedNode)) {
      nodesNeedingInternalsRefresh.push(nextNode.id);
    }

    if (areFlowNodesEquivalent(currentNode, mergedNode)) {
      return currentNode;
    }

    changed = true;
    return mergedNode;
  });

  return {
    nodes: changed ? reconciledNodes : current,
    nodesNeedingInternalsRefresh,
  };
}

export function reconcileFlowNodes(
  current: Array<Node<ProducerCanvasNodeData>>,
  next: Array<Node<ProducerCanvasNodeData>>,
): Array<Node<ProducerCanvasNodeData>> {
  return reconcileFlowNodesWithMetadata(current, next).nodes;
}
