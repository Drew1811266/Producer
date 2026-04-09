import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { beforeEach, afterEach, vi } from 'vitest';

import type { GraphNodeSummary, ProjectGraphSummary } from '../bridge/contracts';
import type { CameraState } from './camera';
import { DEFAULT_CAMERA } from './camera';
import type { CanvasEdge } from './canvasEdges';
import { CanvasViewport } from './CanvasViewport';

let lastReactFlowProps: Record<string, unknown> | null = null;

beforeEach(() => {
  (window as Window & { __PRODUCER_ENABLE_NODE_DRAG__?: boolean }).__PRODUCER_ENABLE_NODE_DRAG__ = true;
  lastReactFlowProps = null;
});

afterEach(() => {
  delete (window as Window & { __PRODUCER_ENABLE_NODE_DRAG__?: boolean }).__PRODUCER_ENABLE_NODE_DRAG__;
});

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  const React = await import('react');

  return {
    ...actual,
    BaseEdge: (props: Record<string, unknown>) => {
      const nextProps = { ...props };

      delete nextProps.interactionWidth;

      return <path {...nextProps} />;
    },
    EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Handle: (props: Record<string, unknown>) => <div {...props} />,
    getBezierPath: () => ['M0,0 C0,0 0,0 0,0', 0, 0],
    useUpdateNodeInternals: () => () => undefined,
    ReactFlow: (props: Record<string, unknown>) => {
      lastReactFlowProps = props;
      const nodes = (props.nodes as Array<Record<string, unknown>> | undefined) ?? [];
      const edges = (props.edges as Array<Record<string, unknown>> | undefined) ?? [];
      const nodeTypes = (props.nodeTypes as Record<string, (props: Record<string, unknown>) => JSX.Element>) ?? {};
      const edgeTypes = (props.edgeTypes as Record<string, (props: Record<string, unknown>) => JSX.Element>) ?? {};
      const onEdgeClick = props.onEdgeClick as
        | ((event: MouseEvent | React.MouseEvent<SVGGElement>, edge: Record<string, unknown>) => void)
        | undefined;
      const onInit = props.onInit as
        | ((instance: { setViewport: () => Promise<boolean> }) => void)
        | undefined;

      React.useEffect(() => {
        onInit?.({
          setViewport: async () => true,
        });
      }, [onInit]);

      return (
        <div data-testid="rf__wrapper">
          <div className="react-flow__pane" onClick={() => (props.onPaneClick as (() => void) | undefined)?.()} />
          <div className="react-flow__edges">
            <svg>
              {edges.map((edge) => {
                const EdgeComponent = edgeTypes[String(edge.type ?? '')];

                if (!EdgeComponent) {
                  return null;
                }

                const sourceNode = nodes.find((node) => node.id === edge.source);
                const targetNode = nodes.find((node) => node.id === edge.target);
                const sourcePosition = (sourceNode?.position as { x: number; y: number } | undefined) ?? {
                  x: 0,
                  y: 0,
                };
                const targetPosition = (targetNode?.position as { x: number; y: number } | undefined) ?? {
                  x: 120,
                  y: 120,
                };

                return (
                  <g
                    key={String(edge.id)}
                    onClick={(event) => {
                      onEdgeClick?.(event, edge);
                    }}
                  >
                    <EdgeComponent
                      {...edge}
                      interactionWidth={24}
                      sourcePosition={actual.Position.Bottom}
                      sourceX={sourcePosition.x}
                      sourceY={sourcePosition.y}
                      targetPosition={actual.Position.Top}
                      targetX={targetPosition.x}
                      targetY={targetPosition.y}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="react-flow__nodes">
            {nodes.map((node) => {
              const NodeComponent = nodeTypes[String(node.type ?? '')];

              if (!NodeComponent) {
                return null;
              }

              return (
                <div
                  key={String(node.id)}
                  data-testid={`rf__node-${String(node.id)}`}
                  onClick={(event) => {
                    (props.onNodeClick as ((event: React.MouseEvent<HTMLDivElement>, node: Record<string, unknown>) => void) | undefined)?.(event, node);
                  }}
                  onDoubleClick={(event) => {
                    (props.onNodeDoubleClick as ((event: React.MouseEvent<HTMLDivElement>, node: Record<string, unknown>) => void) | undefined)?.(event, node);
                  }}
                >
                  <NodeComponent {...node} />
                </div>
              );
            })}
          </div>
          {props.children as React.ReactNode}
        </div>
      );
    },
  };
});

const EMPTY_NODES: GraphNodeSummary[] = [];
const EMPTY_EDGES: CanvasEdge[] = [];
const CanvasViewportComponent = CanvasViewport as unknown as (props: Record<string, unknown>) => JSX.Element;

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-root',
    name: 'Brief Canvas',
    layerType: 'brief',
    isRoot: true,
    ...overrides,
  };
}

function buildNode(overrides: Partial<GraphNodeSummary> = {}): GraphNodeSummary {
  return {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Campaign Brief',
    nodeType: 'brief',
    storedAssetCount: 0,
    status: undefined,
    isSystem: false,
    canEnterChildGraph: false,
    layout: {
      x: -160,
      y: -90,
      width: 220,
      height: 136,
    },
    ...overrides,
  };
}

function ControlledViewportHarness({
  bottomOcclusionInset = 0,
  graph,
  initialCamera = DEFAULT_CAMERA,
  initialSelectedEdgeId = null,
  initialSelectedNodeId = null,
  initialSelectedNodeIds,
  onNodePositionCommitSpy,
  onNodePositionPreviewSpy,
  leftOcclusionInset = 0,
  edges = EMPTY_EDGES,
  nodes = EMPTY_NODES,
  onEdgeConnect,
  rightOcclusionInset = 0,
  topOcclusionInset = 0,
}: {
  bottomOcclusionInset?: number;
  edges?: CanvasEdge[];
  graph: ProjectGraphSummary;
  initialCamera?: CameraState;
  initialSelectedEdgeId?: string | null;
  initialSelectedNodeId?: string | null;
  initialSelectedNodeIds?: string[];
  leftOcclusionInset?: number;
  nodes?: GraphNodeSummary[];
  onEdgeConnect?: Parameters<typeof CanvasViewport>[0]['onEdgeConnect'];
  onNodePositionCommitSpy?: (nodeId: string, position: { x: number; y: number }) => void;
  onNodePositionPreviewSpy?: (nodeId: string, position: { x: number; y: number }) => void;
  rightOcclusionInset?: number;
  topOcclusionInset?: number;
}) {
  const [camera, setCamera] = useState(initialCamera);
  const [currentNodes, setCurrentNodes] = useState(nodes);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(initialSelectedEdgeId);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(
    initialSelectedNodeIds ?? (initialSelectedNodeId ? [initialSelectedNodeId] : []),
  );
  const [enteredNodeId, setEnteredNodeId] = useState<string | null>(null);
  const [quickAddAnchor, setQuickAddAnchor] = useState<string>('none');

  useEffect(() => {
    setCurrentNodes(nodes);
  }, [nodes]);

  return (
    <>
      <CanvasViewportComponent
        bottomOcclusionInset={bottomOcclusionInset}
        graph={graph}
        camera={camera}
        edges={edges}
        leftOcclusionInset={leftOcclusionInset}
        nodes={currentNodes}
        rightOcclusionInset={rightOcclusionInset}
        selectedEdgeId={selectedEdgeId}
        selectedNodeIds={selectedNodeIds}
        topOcclusionInset={topOcclusionInset}
        onCameraChange={setCamera}
        onEdgeConnect={onEdgeConnect}
        onEnterNode={setEnteredNodeId}
        onNodePositionPreview={(nodeId, position) => {
          onNodePositionPreviewSpy?.(nodeId, position);
          setCurrentNodes((current) =>
            current.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    layout: {
                      ...node.layout,
                      x: position.x,
                      y: position.y,
                    },
                  }
                : node,
            ),
          );
        }}
        onNodePositionCommit={(nodeId, position) => {
          onNodePositionCommitSpy?.(nodeId, position);
          setCurrentNodes((current) =>
            current.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    layout: {
                      ...node.layout,
                      x: position.x,
                      y: position.y,
                    },
                  }
                : node,
            ),
          );
        }}
        onQuickAddRequest={(request) => {
          setQuickAddAnchor(`${Math.round(request.anchor.worldX)}/${Math.round(request.anchor.worldY)}`);
        }}
        onSelectedEdgeChange={setSelectedEdgeId}
        onSelectedNodesChange={setSelectedNodeIds}
      />
      <output data-testid="selected-edge">{selectedEdgeId ?? 'none'}</output>
      <output data-testid="selected-node">{selectedNodeIds[0] ?? 'none'}</output>
      <output data-testid="selected-nodes">
        {selectedNodeIds.length > 0 ? selectedNodeIds.join(',') : 'none'}
      </output>
      <output data-testid="entered-node">{enteredNodeId ?? 'none'}</output>
      <output data-testid="camera-snapshot">{`${Math.round(camera.x)}/${Math.round(camera.y)}/${camera.zoom}`}</output>
      <output data-testid="quick-add-anchor">{quickAddAnchor}</output>
    </>
  );
}

test('renders a PlaceholderNode-style add affordance for an empty canvas and forwards quick-add coordinates', () => {
  render(<ControlledViewportHarness graph={buildGraph()} />);

  const placeholder = screen.getByTestId('producer-placeholder-node');
  const host = screen.getByTestId('canvas-stage-host');

  expect(placeholder).toBeInTheDocument();
  expect(within(placeholder).getByText(/新建需求/i)).toBeInTheDocument();
  expect(screen.getByTestId('producer-canvas-atmosphere')).toBeInTheDocument();
  expect(host.querySelectorAll('.producer-canvas-grid')).toHaveLength(2);
  expect(screen.getByTestId('producer-canvas-grid-minor')).toBeInTheDocument();
  expect(screen.getByTestId('producer-canvas-grid-major')).toBeInTheDocument();

  fireEvent.click(placeholder);

  expect(screen.getByTestId('quick-add-anchor').textContent).not.toBe('none');
});

test('maps producer nodes to the expected React Flow UI variants, statuses, and top-bottom handles', () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph({
        id: 'graph-shot-lab',
        layerType: 'shot_lab',
        isRoot: false,
      })}
      nodes={[
        buildNode({
          id: 'node-demand',
          title: 'Campaign Brief',
          nodeType: 'brief',
        }),
        buildNode({
          id: 'node-frame',
          title: 'Frame Candidate',
          nodeType: 'still',
          status: 'rendering',
          layout: {
            x: 140,
            y: -60,
            width: 252,
            height: 184,
          },
        }),
        buildNode({
          id: 'node-review',
          title: 'Director Review',
          nodeType: 'review',
          layout: {
            x: -80,
            y: 180,
            width: 252,
            height: 160,
          },
        }),
        buildNode({
          id: 'node-result',
          title: 'Selected Final',
          nodeType: 'result',
          status: 'approved',
          layout: {
            x: 220,
            y: 180,
            width: 240,
            height: 156,
          },
        }),
      ]}
    />,
  );

  const demandNode = screen.getByTestId('producer-node-node-demand');
  const frameNode = screen.getByTestId('producer-node-node-frame');
  const reviewNode = screen.getByTestId('producer-node-node-review');
  const resultNode = screen.getByTestId('producer-node-node-result');

  expect(demandNode).toHaveAttribute('data-producer-node-type', 'demand');
  expect(demandNode).toHaveAttribute('data-producer-node-chroma', 'simple');
  expect(demandNode).toHaveAttribute('data-node-target-handle', 'top');
  expect(demandNode).toHaveAttribute('data-node-source-handle', 'bottom');
  expect(screen.getByTestId('producer-handle-node-demand-in')).toBeInTheDocument();
  expect(screen.getByTestId('producer-handle-node-demand-out')).toBeInTheDocument();

  expect(frameNode).toHaveAttribute('data-producer-node-type', 'frame');
  expect(frameNode).toHaveAttribute('data-producer-node-chroma', 'action-bar');
  expect(within(frameNode).getByTestId('producer-node-status')).toHaveAttribute(
    'data-status-tone',
    'loading',
  );

  expect(reviewNode).toHaveAttribute('data-producer-node-type', 'review');
  expect(reviewNode).toHaveAttribute('data-producer-node-chroma', 'annotation');

  expect(resultNode).toHaveAttribute('data-producer-node-type', 'selected_result');
  expect(within(resultNode).getByTestId('producer-node-status')).toHaveAttribute(
    'data-status-tone',
    'success',
  );
  expect(within(resultNode).getByTestId('producer-node-appendix')).toHaveTextContent('Selected');
  expect(screen.getByTestId('producer-handle-node-result-in')).toBeInTheDocument();
  expect(screen.getByTestId('producer-handle-node-result-out')).toBeInTheDocument();
});

test('keeps the React Flow edge layer mounted when graph edges are present', () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      nodes={[
        buildNode({
          id: 'node-brief',
          title: 'Campaign Brief',
          layout: {
            x: -160,
            y: -90,
            width: 220,
            height: 136,
          },
        }),
        buildNode({
          id: 'node-shot',
          title: 'Shot 01',
          nodeType: 'storyboard_shot',
          layout: {
            x: 120,
            y: 180,
            width: 240,
            height: 152,
          },
        }),
      ]}
      edges={[
        {
          id: 'edge-1',
          edgeType: 'references',
          sourceNodeId: 'node-brief',
          targetNodeId: 'node-shot',
        },
      ]}
    />,
  );

  expect(screen.getByTestId('rf__wrapper').querySelector('.react-flow__edges')).not.toBeNull();
  expect(screen.queryByTestId('producer-placeholder-node')).not.toBeInTheDocument();
});

test('stabilizes controlled React Flow node props after external node creation', async () => {
  const graph = buildGraph();
  const initialNodes: GraphNodeSummary[] = [];
  const createdNodes = [
    buildNode({
      id: 'node-created',
      title: '新建需求',
      layout: {
        x: -240,
        y: -160,
        width: 220,
        height: 136,
      },
    }),
  ];
  const { rerender } = render(
    <ControlledViewportHarness
      graph={graph}
      nodes={initialNodes}
      initialSelectedNodeIds={['node-created']}
    />,
  );

  rerender(
    <ControlledViewportHarness
      graph={graph}
      nodes={createdNodes}
      initialSelectedNodeIds={['node-created']}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('producer-node-node-created')).toBeInTheDocument();
  });

  const firstNodesProp = (lastReactFlowProps?.nodes as Array<Record<string, unknown>> | undefined) ?? [];

  rerender(
    <ControlledViewportHarness
      graph={graph}
      nodes={[
        buildNode({
          id: 'node-created',
          title: '新建需求',
          layout: {
            x: -240,
            y: -160,
            width: 220,
            height: 136,
          },
        }),
      ]}
      initialSelectedNodeIds={['node-created']}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('producer-node-node-created')).toBeInTheDocument();
  });

  const secondNodesProp = (lastReactFlowProps?.nodes as Array<Record<string, unknown>> | undefined) ?? [];

  expect(secondNodesProp).toBe(firstNodesProp);
  expect(secondNodesProp[0]).toBe(firstNodesProp[0]);
});

test('keeps React Flow node props stable across parent rerenders with fresh callback props', async () => {
  const graph = buildGraph();
  const nodes = [
    buildNode({
      id: 'node-created',
      title: '新建需求',
      layout: {
        x: -240,
        y: -160,
        width: 220,
        height: 136,
      },
    }),
  ];
  const baseProps = {
    camera: DEFAULT_CAMERA,
    graph,
    nodes,
    selectedNodeIds: ['node-created'],
  };
  const { rerender } = render(
    <CanvasViewportComponent
      {...baseProps}
      onCameraChange={() => undefined}
      onEnterNode={() => undefined}
      onSelectedEdgeChange={() => undefined}
      onSelectedNodesChange={() => undefined}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('producer-node-node-created')).toBeInTheDocument();
  });

  const firstNodesProp = (lastReactFlowProps?.nodes as Array<Record<string, unknown>> | undefined) ?? [];

  rerender(
    <CanvasViewportComponent
      {...baseProps}
      onCameraChange={() => undefined}
      onEnterNode={() => undefined}
      onSelectedEdgeChange={() => undefined}
      onSelectedNodesChange={() => undefined}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('producer-node-node-created')).toBeInTheDocument();
  });

  const secondNodesProp = (lastReactFlowProps?.nodes as Array<Record<string, unknown>> | undefined) ?? [];

  expect(secondNodesProp).toBe(firstNodesProp);
  expect(secondNodesProp[0]).toBe(firstNodesProp[0]);
});

test('keeps React Flow edge props stable across parent rerenders with equivalent edge data', async () => {
  const graph = buildGraph();
  const nodes = [
    buildNode({
      id: 'node-brief',
      title: 'Campaign Brief',
    }),
    buildNode({
      id: 'node-shot',
      title: 'Shot 01',
      nodeType: 'storyboard_shot',
      layout: {
        x: 120,
        y: 180,
        width: 240,
        height: 152,
      },
    }),
  ];
  const edge = {
    id: 'edge-1',
    edgeType: 'references',
    sourceNodeId: 'node-brief',
    targetNodeId: 'node-shot',
  } satisfies CanvasEdge;
  const baseProps = {
    camera: DEFAULT_CAMERA,
    edges: [edge],
    graph,
    nodes,
    selectedEdgeId: 'edge-1',
  };
  const { rerender } = render(
    <CanvasViewportComponent
      {...baseProps}
      onCameraChange={() => undefined}
      onEnterNode={() => undefined}
      onSelectedEdgeChange={() => undefined}
      onSelectedNodesChange={() => undefined}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('producer-bezier-edge-edge-1')).toBeInTheDocument();
  });

  const firstEdgesProp = (lastReactFlowProps?.edges as Array<Record<string, unknown>> | undefined) ?? [];

  rerender(
    <CanvasViewportComponent
      {...baseProps}
      edges={[{ ...edge }]}
      onCameraChange={() => undefined}
      onEnterNode={() => undefined}
      onSelectedEdgeChange={() => undefined}
      onSelectedNodesChange={() => undefined}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('producer-bezier-edge-edge-1')).toBeInTheDocument();
  });

  const secondEdgesProp = (lastReactFlowProps?.edges as Array<Record<string, unknown>> | undefined) ?? [];

  expect(secondEdgesProp).toBe(firstEdgesProp);
  expect(secondEdgesProp[0]).toBe(firstEdgesProp[0]);
});

test('selects and highlights an edge on click, then clears the edge selection when a node or pane is clicked', async () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      nodes={[
        buildNode({
          id: 'node-brief',
          title: 'Campaign Brief',
          layout: {
            x: -160,
            y: -90,
            width: 220,
            height: 136,
          },
        }),
        buildNode({
          id: 'node-shot',
          title: 'Shot 01',
          nodeType: 'storyboard_shot',
          layout: {
            x: 120,
            y: 180,
            width: 240,
            height: 152,
          },
        }),
      ]}
      edges={[
        {
          id: 'edge-1',
          edgeType: 'references',
          sourceNodeId: 'node-brief',
          targetNodeId: 'node-shot',
        },
      ]}
    />,
  );

  const user = userEvent.setup();
  await waitFor(() => {
    expect(screen.getByTestId('rf__wrapper').querySelector('[data-testid="producer-bezier-edge-edge-1"]')).not.toBeNull();
  });
  const edge = screen.getByTestId('producer-bezier-edge-edge-1');

  await user.click(edge);

  expect(screen.getByTestId('selected-edge')).toHaveTextContent('edge-1');
  expect(edge).toHaveAttribute('data-edge-state', 'selected');

  await user.click(screen.getByTestId('producer-node-node-brief'));

  expect(screen.getByTestId('selected-edge')).toHaveTextContent('none');
  expect(screen.getByTestId('selected-node')).toHaveTextContent('node-brief');

  await user.click(edge);
  expect(screen.getByTestId('selected-edge')).toHaveTextContent('edge-1');

  const pane = screen.getByTestId('rf__wrapper').querySelector('.react-flow__pane') as HTMLElement;
  await user.click(pane);

  expect(screen.getByTestId('selected-edge')).toHaveTextContent('none');
});

test('enables marquee selection on blank drag and reports node arrays in graph order without selecting edges', async () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      nodes={[
        buildNode({
          id: 'node-1',
          title: 'Prompt A',
        }),
        buildNode({
          id: 'node-2',
          title: 'Reference B',
          layout: {
            x: 120,
            y: 180,
            width: 240,
            height: 152,
          },
        }),
      ]}
      edges={[
        {
          id: 'edge-1',
          edgeType: 'references',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
        },
      ]}
    />,
  );

  const reactFlowProps = lastReactFlowProps as {
    nodes?: Array<{ id: string }>;
    edges?: Array<{ id: string }>;
    onSelectionChange?: (payload: {
      nodes: Array<{ id: string }>;
      edges: Array<{ id: string }>;
    }) => void;
    panActivationKeyCode?: string | null;
    panOnDrag?: boolean;
    selectionKeyCode?: string | null;
    selectionMode?: string;
    selectionOnDrag?: boolean;
  } | null;

  expect(reactFlowProps?.selectionOnDrag).toBe(true);
  expect(reactFlowProps?.selectionKeyCode).toBeNull();
  expect(reactFlowProps?.selectionMode).toBe('partial');
  expect(reactFlowProps?.panOnDrag).toBe(false);
  expect(reactFlowProps?.panActivationKeyCode).toBe('Space');

  act(() => {
    reactFlowProps?.onSelectionChange?.({
      nodes: ((reactFlowProps.nodes ?? []).filter((node) => node.id === 'node-1' || node.id === 'node-2') ?? [])
        .slice()
        .reverse(),
      edges: reactFlowProps?.edges ?? [],
    });
  });

  expect(screen.getByTestId('selected-nodes')).toHaveTextContent('node-1,node-2');
  expect(screen.getByTestId('selected-edge')).toHaveTextContent('none');
});

test('does not re-emit an equivalent marquee selection set that is already controlled by the parent', async () => {
  const onSelectedNodesChange = vi.fn();

  render(
    <CanvasViewportComponent
      camera={DEFAULT_CAMERA}
      graph={buildGraph()}
      nodes={[
        buildNode({
          id: 'node-1',
          title: 'Prompt A',
        }),
        buildNode({
          id: 'node-2',
          title: 'Reference B',
          layout: {
            x: 120,
            y: 180,
            width: 240,
            height: 152,
          },
        }),
      ]}
      selectedNodeIds={['node-1', 'node-2']}
      onCameraChange={() => undefined}
      onEnterNode={() => undefined}
      onSelectedEdgeChange={() => undefined}
      onSelectedNodesChange={onSelectedNodesChange}
    />,
  );

  const reactFlowProps = lastReactFlowProps as {
    nodes?: Array<{ id: string }>;
    onSelectionChange?: (payload: { nodes: Array<{ id: string }> }) => void;
  } | null;

  act(() => {
    reactFlowProps?.onSelectionChange?.({
      nodes: ((reactFlowProps?.nodes ?? []).filter((node) => node.id === 'node-1' || node.id === 'node-2') ?? [])
        .slice()
        .reverse(),
    });
  });

  expect(onSelectedNodesChange).not.toHaveBeenCalled();
});

test('drags all selected nodes together and collapses to single-node drag when starting from an unselected node', async () => {
  const previewSpy = vi.fn();
  const commitSpy = vi.fn();

  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      initialSelectedNodeIds={['node-1', 'node-2']}
      nodes={[
        buildNode({
          id: 'node-1',
          title: 'Prompt A',
        }),
        buildNode({
          id: 'node-2',
          title: 'Reference B',
          layout: {
            x: 120,
            y: 180,
            width: 240,
            height: 152,
          },
        }),
        buildNode({
          id: 'node-3',
          title: 'Review C',
          nodeType: 'review',
          layout: {
            x: 380,
            y: 20,
            width: 220,
            height: 140,
          },
        }),
      ]}
      onNodePositionCommitSpy={commitSpy}
      onNodePositionPreviewSpy={previewSpy}
    />,
  );

  const reactFlowProps = lastReactFlowProps as {
    nodes?: Array<{
      data?: { node?: GraphNodeSummary };
      id: string;
      position: { x: number; y: number };
    }>;
    onNodeDrag?: (
      event: unknown,
      node: {
        data?: { node?: GraphNodeSummary };
        id: string;
        position: { x: number; y: number };
      },
      nodes: Array<{
        data?: { node?: GraphNodeSummary };
        id: string;
        position: { x: number; y: number };
      }>,
    ) => void;
    onNodeDragStart?: (
      event: unknown,
      node: {
        data?: { node?: GraphNodeSummary };
        id: string;
        position: { x: number; y: number };
      },
      nodes: Array<{
        data?: { node?: GraphNodeSummary };
        id: string;
        position: { x: number; y: number };
      }>,
    ) => void;
    onNodeDragStop?: (
      event: unknown,
      node: {
        data?: { node?: GraphNodeSummary };
        id: string;
        position: { x: number; y: number };
      },
      nodes: Array<{
        data?: { node?: GraphNodeSummary };
        id: string;
        position: { x: number; y: number };
      }>,
    ) => void;
  };

  const flowNode1 = reactFlowProps.nodes?.find((node) => node.id === 'node-1');
  const flowNode2 = reactFlowProps.nodes?.find((node) => node.id === 'node-2');
  const flowNode3 = reactFlowProps.nodes?.find((node) => node.id === 'node-3');

  expect(flowNode1).toBeDefined();
  expect(flowNode2).toBeDefined();
  expect(flowNode3).toBeDefined();

  const movedNode1 = {
    ...flowNode1!,
    position: { x: -120, y: -60 },
  };
  const movedNode2 = {
    ...flowNode2!,
    position: { x: 160, y: 200 },
  };

  act(() => {
    reactFlowProps.onNodeDragStart?.({}, movedNode1, [movedNode1, movedNode2]);
    reactFlowProps.onNodeDrag?.({}, movedNode1, [movedNode1, movedNode2]);
    reactFlowProps.onNodeDragStop?.({}, movedNode1, [movedNode1, movedNode2]);
  });

  expect(previewSpy).toHaveBeenCalledWith('node-1', { x: -120, y: -60 });
  expect(previewSpy).toHaveBeenCalledWith('node-2', { x: 160, y: 200 });
  expect(commitSpy).toHaveBeenCalledWith('node-1', { x: -120, y: -60 });
  expect(commitSpy).toHaveBeenCalledWith('node-2', { x: 160, y: 200 });
  expect(screen.getByTestId('producer-node-node-1')).toHaveAttribute('data-node-world-x', '-120');
  expect(screen.getByTestId('producer-node-node-2')).toHaveAttribute('data-node-world-x', '160');

  const movedNode3 = {
    ...flowNode3!,
    position: { x: 420, y: 54 },
  };

  act(() => {
    reactFlowProps.onNodeDragStart?.({}, movedNode3, [movedNode3]);
    reactFlowProps.onNodeDrag?.({}, movedNode3, [movedNode3]);
  });

  expect(screen.getByTestId('selected-nodes')).toHaveTextContent('node-3');
  expect(previewSpy).toHaveBeenCalledWith('node-3', { x: 420, y: 54 });
});

test.each([0.5, 1, 1.5])(
  'keeps the grid shell, nodes, and edges mounted at %sx zoom',
  (zoom) => {
    render(
      <ControlledViewportHarness
        graph={buildGraph()}
        initialCamera={{
          ...DEFAULT_CAMERA,
          zoom,
        }}
        nodes={[
          buildNode({
            id: 'node-brief',
            title: 'Campaign Brief',
          }),
          buildNode({
            id: 'node-shot',
            title: 'Shot 01',
            nodeType: 'storyboard_shot',
            layout: {
              x: 120,
              y: 180,
              width: 240,
              height: 152,
            },
          }),
        ]}
        edges={[
          {
            id: `edge-${zoom}`,
            edgeType: 'references',
            sourceNodeId: 'node-brief',
            targetNodeId: 'node-shot',
          },
        ]}
      />,
    );

    const host = screen.getByTestId('canvas-stage-host');

    expect(screen.getByTestId('producer-canvas-atmosphere')).toBeInTheDocument();
    expect(host.querySelectorAll('.producer-canvas-grid')).toHaveLength(2);
    expect(screen.getByTestId('producer-node-node-brief')).toBeInTheDocument();
    expect(screen.getByTestId('producer-node-node-shot')).toBeInTheDocument();
    expect(screen.getByTestId('rf__wrapper').querySelector('.react-flow__edges')).not.toBeNull();
    expect(screen.getByTestId('camera-snapshot')).toHaveTextContent(`0/0/${zoom}`);
  },
);

test('keeps system anchors non-selectable while still allowing enterable nodes to open child graphs', () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph({
        id: 'graph-storyboard',
        layerType: 'storyboard',
        isRoot: false,
      })}
      nodes={[
        buildNode({
          id: 'node-shot',
          title: 'Shot 01',
          nodeType: 'storyboard_shot',
          canEnterChildGraph: true,
          layout: {
            x: -180,
            y: -40,
            width: 240,
            height: 152,
          },
        }),
        buildNode({
          id: 'node-anchor',
          title: 'Campaign Brief',
          nodeType: 'system_anchor',
          isSystem: true,
          sourceNodeType: 'brief',
          layout: {
            x: 120,
            y: -32,
            width: 200,
            height: 112,
          },
        }),
      ]}
    />,
  );

  const shotNode = screen.getByTestId('producer-node-node-shot');
  const anchorNode = screen.getByTestId('producer-node-node-anchor');

  fireEvent.click(shotNode);
  expect(screen.getByTestId('selected-node')).toHaveTextContent('node-shot');

  fireEvent.doubleClick(shotNode);
  expect(screen.getByTestId('entered-node')).toHaveTextContent('node-shot');

  expect(anchorNode).toHaveAttribute('data-producer-node-type', 'demand_anchor');
  expect(anchorNode).toHaveAttribute('data-node-target-handle', 'none');
  expect(anchorNode).toHaveAttribute('data-node-source-handle', 'bottom');
  expect(screen.queryByTestId('producer-handle-node-anchor-in')).not.toBeInTheDocument();
  expect(screen.getByTestId('producer-handle-node-anchor-out')).toBeInTheDocument();

  fireEvent.click(anchorNode);
  fireEvent.doubleClick(anchorNode);

  expect(screen.getByTestId('selected-node')).toHaveTextContent('node-shot');
  expect(screen.getByTestId('entered-node')).toHaveTextContent('node-shot');
});

test('keeps the external camera zoom stable for trackpad-style wheel gestures', () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      initialCamera={DEFAULT_CAMERA}
      nodes={[buildNode()]}
    />,
  );

  const pane = screen.getByTestId('rf__wrapper').querySelector('.react-flow__pane') as HTMLElement;

  expect(screen.getByTestId('camera-snapshot')).toHaveTextContent('0/0/1');

  fireEvent.wheel(pane, { deltaX: 120, deltaY: 240, clientX: 240, clientY: 180 });

  const [, , zoom] = (screen.getByTestId('camera-snapshot').textContent ?? '0/0/1').split('/');

  expect(zoom).toBe('1');
});

test('supports userEvent-based node selection in jsdom without drag side effects', async () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      nodes={[buildNode()]}
    />,
  );

  const user = userEvent.setup();

  await user.click(screen.getByTestId('producer-node-node-1'));

  expect(screen.getByTestId('selected-node')).toHaveTextContent('node-1');
});

test('clamps oversized occlusion insets before auto-panning a selected node', () => {
  render(
    <ControlledViewportHarness
      graph={buildGraph()}
      initialSelectedNodeId="node-1"
      leftOcclusionInset={420}
      nodes={[buildNode()]}
      topOcclusionInset={999}
    />,
  );

  expect(screen.getByTestId('producer-node-node-1')).toBeInTheDocument();
  expect(screen.getByTestId('camera-snapshot')).toBeInTheDocument();
});
