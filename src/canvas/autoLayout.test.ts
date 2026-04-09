import { describe, expect, test } from 'vitest';

import type { GraphEdgeSummary, GraphNodeSummary } from '../bridge/contracts';
import { computeAutoLayout } from './autoLayout';

function buildNode(overrides: Partial<GraphNodeSummary> = {}): GraphNodeSummary {
  return {
    canEnterChildGraph: false,
    graphId: 'graph-shot-lab',
    id: 'node-1',
    isSystem: false,
    layout: {
      height: 152,
      width: 240,
      x: -160,
      y: -80,
    },
    nodeType: 'prompt',
    status: 'Draft',
    storedAssetCount: 0,
    title: 'Prompt A',
    ...overrides,
  };
}

function buildEdge(overrides: Partial<GraphEdgeSummary> = {}): GraphEdgeSummary {
  return {
    edgeType: 'references',
    graphId: 'graph-shot-lab',
    id: 'edge-1',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    ...overrides,
  };
}

function toPositionMap(
  results: ReturnType<typeof computeAutoLayout>,
): Record<string, { x: number; y: number }> {
  return Object.fromEntries(results.map((result) => [result.nodeId, result.position]));
}

function centerX(node: GraphNodeSummary, position: { x: number; y: number }): number {
  return position.x + node.layout.width / 2;
}

function boundingCenter(nodes: GraphNodeSummary[]): { x: number; y: number } {
  const minX = Math.min(...nodes.map((node) => node.layout.x));
  const minY = Math.min(...nodes.map((node) => node.layout.y));
  const maxX = Math.max(...nodes.map((node) => node.layout.x + node.layout.width));
  const maxY = Math.max(...nodes.map((node) => node.layout.y + node.layout.height));

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

describe('computeAutoLayout', () => {
  test('lays out a simple chain from top to bottom and keeps it centered near the current bounds', () => {
    const nodes = [
      buildNode({
        id: 'node-1',
        layout: {
          height: 140,
          width: 220,
          x: -260,
          y: -120,
        },
      }),
      buildNode({
        id: 'node-2',
        layout: {
          height: 180,
          width: 240,
          x: 120,
          y: 40,
        },
        title: 'Node B',
      }),
      buildNode({
        id: 'node-3',
        layout: {
          height: 160,
          width: 200,
          x: 48,
          y: 280,
        },
        title: 'Node C',
      }),
    ];
    const results = computeAutoLayout(nodes, [
      buildEdge({
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
      buildEdge({
        id: 'edge-2',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-3',
      }),
    ]);
    const positions = toPositionMap(results);
    const currentCenter = boundingCenter(nodes);

    expect(results).toHaveLength(3);
    expect(positions['node-1'].y).toBeLessThan(positions['node-2'].y);
    expect(positions['node-2'].y).toBeLessThan(positions['node-3'].y);
    expect(Math.abs(centerX(nodes[0], positions['node-1']) - centerX(nodes[1], positions['node-2']))).toBeLessThan(1);
    expect(Math.abs(centerX(nodes[1], positions['node-2']) - centerX(nodes[2], positions['node-3']))).toBeLessThan(1);
    expect(Math.abs(boundingCenter(nodes.map((node) => ({
      ...node,
      layout: {
        ...node.layout,
        ...positions[node.id],
      },
    }))).x - currentCenter.x)).toBeLessThan(1);
    expect(Math.abs(boundingCenter(nodes.map((node) => ({
      ...node,
      layout: {
        ...node.layout,
        ...positions[node.id],
      },
    }))).y - currentCenter.y)).toBeLessThan(1);
  });

  test('keeps multiple roots in stable order regardless of input order', () => {
    const rootA = buildNode({
      id: 'node-a',
      layout: {
        height: 152,
        width: 220,
        x: -320,
        y: -80,
      },
      title: 'Root A',
    });
    const rootB = buildNode({
      id: 'node-b',
      layout: {
        height: 152,
        width: 220,
        x: 120,
        y: -80,
      },
      title: 'Root B',
    });
    const child = buildNode({
      id: 'node-c',
      layout: {
        height: 160,
        width: 240,
        x: 40,
        y: 240,
      },
      title: 'Child',
    });

    const edges = [
      buildEdge({
        sourceNodeId: 'node-a',
        targetNodeId: 'node-c',
      }),
    ];
    const forward = toPositionMap(computeAutoLayout([rootA, rootB, child], edges));
    const reversed = toPositionMap(computeAutoLayout([child, rootB, rootA], edges));

    expect(forward['node-a'].x).toBeLessThan(forward['node-b'].x);
    expect(forward).toEqual(reversed);
  });

  test('handles cycles deterministically without throwing', () => {
    const nodeA = buildNode({
      id: 'node-a',
      layout: {
        height: 140,
        width: 220,
        x: -220,
        y: -80,
      },
      title: 'Cycle A',
    });
    const nodeB = buildNode({
      id: 'node-b',
      layout: {
        height: 140,
        width: 220,
        x: 120,
        y: -40,
      },
      title: 'Cycle B',
    });
    const nodeC = buildNode({
      id: 'node-c',
      layout: {
        height: 160,
        width: 200,
        x: -40,
        y: 240,
      },
      title: 'Leaf C',
    });
    const edges = [
      buildEdge({
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
      }),
      buildEdge({
        id: 'edge-2',
        sourceNodeId: 'node-b',
        targetNodeId: 'node-a',
      }),
      buildEdge({
        id: 'edge-3',
        sourceNodeId: 'node-b',
        targetNodeId: 'node-c',
      }),
    ];

    const forward = toPositionMap(computeAutoLayout([nodeA, nodeB, nodeC], edges));
    const reversed = toPositionMap(computeAutoLayout([nodeC, nodeB, nodeA], edges));

    expect(Object.keys(forward).sort()).toEqual(['node-a', 'node-b', 'node-c']);
    expect(forward).toEqual(reversed);
    expect(Object.values(forward).every((position) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(
      true,
    );
  });

  test('only returns positions for the target subset', () => {
    const results = computeAutoLayout(
      [
        buildNode({
          id: 'node-2',
          layout: {
            height: 152,
            width: 240,
            x: 120,
            y: 160,
          },
          title: 'Node 2',
        }),
        buildNode({
          id: 'node-3',
          layout: {
            height: 152,
            width: 220,
            x: 340,
            y: 360,
          },
          title: 'Node 3',
        }),
      ],
      [
        buildEdge({
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
        }),
        buildEdge({
          id: 'edge-2',
          sourceNodeId: 'node-2',
          targetNodeId: 'node-3',
        }),
      ],
    );

    expect(results.map((result) => result.nodeId)).toEqual(['node-2', 'node-3']);
  });
});
