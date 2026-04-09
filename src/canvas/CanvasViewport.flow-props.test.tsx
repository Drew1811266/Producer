import type { GraphNodeSummary, ProjectGraphSummary } from '../bridge/contracts';
import type { Connection } from '@xyflow/react';
import { ConnectionLineType, ConnectionMode } from '@xyflow/react';

import {
  PRODUCER_CONNECTION_LINE_TYPE,
  PRODUCER_CONNECTION_MODE,
  PRODUCER_CONNECTION_RADIUS,
  PRODUCER_PAN_ON_SCROLL,
  PRODUCER_ZOOM_ON_DOUBLE_CLICK,
  PRODUCER_ZOOM_ON_SCROLL,
  createOptimisticProducerFlowEdge,
} from './flowConnection';
import {
  buildFlowNodes,
  reconcileFlowNodes,
  reconcileFlowNodesWithMetadata,
} from './flowNodes';

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-storyboard',
    isRoot: false,
    layerType: 'storyboard',
    name: 'Storyboard Canvas',
    ...overrides,
  };
}

function buildNode(overrides: Partial<GraphNodeSummary> = {}): GraphNodeSummary {
  return {
    canEnterChildGraph: false,
    graphId: 'graph-storyboard',
    id: 'node-1',
    isSystem: false,
    layout: {
      height: 136,
      width: 220,
      x: -120,
      y: -80,
    },
    nodeType: 'storyboard_shot',
    status: undefined,
    storedAssetCount: 0,
    title: 'Node',
    ...overrides,
  };
}

test('uses strict bezier connection config and producer-bezier optimistic edges', () => {
  expect(PRODUCER_CONNECTION_MODE).toBe(ConnectionMode.Strict);
  expect(PRODUCER_CONNECTION_LINE_TYPE).toBe(ConnectionLineType.Bezier);
  expect(PRODUCER_CONNECTION_RADIUS).toBe(24);
  expect(PRODUCER_PAN_ON_SCROLL).toBe(true);
  expect(PRODUCER_ZOOM_ON_SCROLL).toBe(false);
  expect(PRODUCER_ZOOM_ON_DOUBLE_CLICK).toBe(false);

  expect(
    createOptimisticProducerFlowEdge({
      source: 'node-1',
      sourceHandle: 'out',
      target: 'node-2',
      targetHandle: 'in',
    }),
  ).toMatchObject({
    source: 'node-1',
    sourceHandle: 'out',
    target: 'node-2',
    targetHandle: 'in',
    type: 'producer-bezier',
  });
  expect(createOptimisticProducerFlowEdge({ source: 'node-1' } as unknown as Connection)).toBeNull();
});

test('maps system anchors as explicit connectable source-only flow nodes', () => {
  const [anchorNode] = buildFlowNodes({
    disableNodeDrag: false,
    graph: buildGraph(),
    nodes: [
      buildNode({
        id: 'node-anchor',
        isSystem: true,
        nodeType: 'system_anchor',
        sourceNodeType: 'brief',
        title: 'Campaign Brief',
      }),
    ],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  expect(anchorNode).toMatchObject({
    connectable: true,
    draggable: false,
    selectable: false,
    targetPosition: undefined,
  });
  expect(anchorNode.sourcePosition).toBeDefined();
});

test('preserves measured dimensions when syncing rebuilt flow nodes', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  current[0] = {
    ...current[0],
    measured: {
      height: 136,
      width: 220,
    },
  };

  const next = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: ['node-1'],
  });

  const [reconciledNode] = reconcileFlowNodes(current, next);

  expect(reconciledNode.selected).toBe(true);
  expect(reconciledNode.measured).toEqual({
    height: 136,
    width: 220,
  });
});

test('reuses the current flow node object when rebuilt props are otherwise unchanged', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  current[0] = {
    ...current[0],
    measured: {
      height: 136,
      width: 220,
    },
  };

  const next = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: current[0].data.actions.onEnterNode,
    onInspectNode: current[0].data.actions.onInspectNode,
    selectedNodeIds: [],
  });

  const reconciled = reconcileFlowNodes(current, next);

  expect(reconciled).toBe(current);
  expect(reconciled[0]).toBe(current[0]);
});

test('accepts measured metadata emitted by React Flow into controlled flow nodes', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  const next = [
    {
      ...current[0],
      measured: {
        height: 136,
        width: 220,
      },
    },
  ];

  const reconciled = reconcileFlowNodesWithMetadata(current, next);

  expect(reconciled.nodes).not.toBe(current);
  expect(reconciled.nodes[0]).not.toBe(current[0]);
  expect(reconciled.nodes[0].measured).toEqual({
    height: 136,
    width: 220,
  });
});

test('stabilizes once measured metadata has been accepted into controlled flow nodes', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  const withMeasured = reconcileFlowNodesWithMetadata(current, [
    {
      ...current[0],
      measured: {
        height: 136,
        width: 220,
      },
    },
  ]);

  const rebuilt = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: withMeasured.nodes[0].data.actions.onEnterNode,
    onInspectNode: withMeasured.nodes[0].data.actions.onInspectNode,
    selectedNodeIds: [],
  });

  const reconciledAgain = reconcileFlowNodesWithMetadata(withMeasured.nodes, rebuilt);

  expect(reconciledAgain.nodes).toBe(withMeasured.nodes);
  expect(reconciledAgain.nodes[0].measured).toEqual({
    height: 136,
    width: 220,
  });
  expect(reconciledAgain.nodesNeedingInternalsRefresh).toEqual([]);
});

test('does not re-mark measured nodes for internals refresh when structure is unchanged', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  current[0] = {
    ...current[0],
    measured: {
      height: 136,
      width: 220,
    },
  };

  const next = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: current[0].data.actions.onEnterNode,
    onInspectNode: current[0].data.actions.onInspectNode,
    selectedNodeIds: [],
  });

  const reconciled = reconcileFlowNodesWithMetadata(current, next);

  expect(reconciled.nodes[0].measured).toEqual({
    height: 136,
    width: 220,
  });
  expect(reconciled.nodesNeedingInternalsRefresh).toEqual([]);
});

test('marks rebuilt measured nodes for React Flow internals refresh only once after layout changes', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  current[0] = {
    ...current[0],
    measured: {
      height: 136,
      width: 220,
    },
  };

  const next = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [
      buildNode({
        layout: {
          height: 168,
          width: 256,
          x: -120,
          y: -80,
        },
      }),
    ],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  const reconciled = reconcileFlowNodesWithMetadata(current, next);

  expect(reconciled.nodes[0].measured).toEqual({
    height: 136,
    width: 220,
  });
  expect(reconciled.nodesNeedingInternalsRefresh).toEqual(['node-1']);

  const reconciledAgain = reconcileFlowNodesWithMetadata(reconciled.nodes, next);

  expect(reconciledAgain.nodesNeedingInternalsRefresh).toEqual([]);
});

test('marks handle topology changes for React Flow internals refresh', () => {
  const graph = buildGraph();
  const current = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [buildNode()],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  const next = buildFlowNodes({
    disableNodeDrag: false,
    graph,
    nodes: [
      buildNode({
        isSystem: true,
        nodeType: 'system_anchor',
        sourceNodeType: 'brief',
        title: 'Anchor',
      }),
    ],
    onEnterNode: () => undefined,
    onInspectNode: () => undefined,
    selectedNodeIds: [],
  });

  const reconciled = reconcileFlowNodesWithMetadata(current, next);

  expect(reconciled.nodesNeedingInternalsRefresh).toEqual(['node-1']);
});
