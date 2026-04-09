import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { vi } from 'vitest';

import type {
  GraphNodeDetail,
  GraphEdgeSummary,
  GraphNodeTypeOption,
  GraphRelationTypeOption,
  ProducerBridge,
  ProjectGraphSummary,
  ProjectSession,
  ProjectTemplate,
} from './bridge/contracts';

let lastCanvasViewportProps: Record<string, unknown> | null = null;
let canvasViewportMountGraphIds: string[] = [];
let canvasViewportUnmountGraphIds: string[] = [];

vi.mock('./canvas/CanvasViewport', () => ({
  CanvasViewport: (props: Record<string, unknown>) => {
    lastCanvasViewportProps = props;
    const graph = props.graph as { id?: string } | undefined;
    const onEdgeConnect = props.onEdgeConnect as
      | ((connection: {
          source: string;
          sourceHandle: string;
          target: string;
          targetHandle: string;
        }) => Promise<void> | void)
      | undefined;
    const onQuickAddRequest = props.onQuickAddRequest as
      | ((request: {
          anchor: {
            screenX: number;
            screenY: number;
            worldX: number;
            worldY: number;
          };
          pendingConnection?: {
            sourceHandleId: string | null;
            sourceHandleType: 'source' | 'target';
            sourceNodeId: string;
          } | null;
        }) => void)
      | undefined;
    const onEnterNode = props.onEnterNode as ((nodeId: string) => void) | undefined;
    const onCameraChange = props.onCameraChange as
      | ((camera: { x: number; y: number; zoom: number }) => void)
      | undefined;
    const onSelectedEdgeChange = props.onSelectedEdgeChange as ((edgeId: string | null) => void) | undefined;
    const onSelectedNodesChange = props.onSelectedNodesChange as
      | ((nodeIds: string[]) => void)
      | undefined;
    const onSelectedNodeChange = props.onSelectedNodeChange as ((nodeId: string | null) => void) | undefined;
    const onNodePositionPreview = props.onNodePositionPreview as
      | ((nodeId: string, position: { x: number; y: number }) => void)
      | undefined;
    const onNodePositionCommit = props.onNodePositionCommit as
      | ((nodeId: string, position: { x: number; y: number }) => void)
      | undefined;

    useEffect(() => {
      const graphId = graph?.id ?? 'unknown';
      canvasViewportMountGraphIds.push(graphId);

      return () => {
        canvasViewportUnmountGraphIds.push(graphId);
      };
    }, [graph?.id]);

    return (
      <>
        <button
          data-testid="mock-connect-edge"
          type="button"
          onClick={() => {
            void onEdgeConnect?.({
              source: 'node-1',
              sourceHandle: 'out',
              target: 'node-2',
              targetHandle: 'in',
            });
          }}
        >
          connect edge
        </button>
        <button
          data-testid="mock-connect-anchor-edge"
          type="button"
          onClick={() => {
            void onEdgeConnect?.({
              source: 'node-anchor',
              sourceHandle: 'out',
              target: 'node-2',
              targetHandle: 'in',
            });
          }}
        >
          connect anchor edge
        </button>
        <button
          data-testid="mock-open-quick-add"
          type="button"
          onClick={() => {
            onQuickAddRequest?.({
              anchor: {
                screenX: 260,
                screenY: 200,
                worldX: -380,
                worldY: -160,
              },
            });
          }}
        >
          open quick add
        </button>
        <button
          data-testid="mock-open-connect-quick-add-source"
          type="button"
          onClick={() => {
            onQuickAddRequest?.({
              anchor: {
                screenX: 260,
                screenY: 200,
                worldX: -380,
                worldY: -160,
              },
              pendingConnection: {
                sourceHandleId: 'out',
                sourceHandleType: 'source',
                sourceNodeId: 'node-1',
              },
            });
          }}
        >
          open connect quick add source
        </button>
        <button
          data-testid="mock-open-connect-quick-add-target"
          type="button"
          onClick={() => {
            onQuickAddRequest?.({
              anchor: {
                screenX: 260,
                screenY: 200,
                worldX: -380,
                worldY: -160,
              },
              pendingConnection: {
                sourceHandleId: 'in',
                sourceHandleType: 'target',
                sourceNodeId: 'node-1',
              },
            });
          }}
        >
          open connect quick add target
        </button>
        <button
          data-testid="mock-connect-created-edge"
          type="button"
          onClick={() => {
            void onEdgeConnect?.({
              source: 'node-created',
              sourceHandle: 'out',
              target: 'node-1',
              targetHandle: 'in',
            });
          }}
        >
          connect created edge
        </button>
        <button
          data-testid="mock-open-child-graph"
          type="button"
          onClick={() => {
            onEnterNode?.('node-1');
          }}
        >
          open child graph
        </button>
        <button
          data-testid="mock-select-edge"
          type="button"
          onClick={() => {
            onSelectedEdgeChange?.('edge-1');
          }}
        >
          select edge
        </button>
        <button
          data-testid="mock-clear-edge"
          type="button"
          onClick={() => {
            onSelectedEdgeChange?.(null);
          }}
        >
          clear edge
        </button>
        <button
          data-testid="mock-select-node"
          type="button"
          onClick={() => {
            onSelectedNodesChange?.(['node-1']);
            onSelectedNodeChange?.('node-1');
          }}
        >
          select node
        </button>
        <button
          data-testid="mock-select-node-2"
          type="button"
          onClick={() => {
            onSelectedNodesChange?.(['node-2']);
            onSelectedNodeChange?.('node-2');
          }}
        >
          select node 2
        </button>
        <button
          data-testid="mock-select-multiple-nodes"
          type="button"
          onClick={() => {
            onSelectedNodesChange?.(['node-1', 'node-2']);
          }}
        >
          select multiple nodes
        </button>
        <button
          data-testid="mock-select-multiple-nodes-reversed"
          type="button"
          onClick={() => {
            onSelectedNodesChange?.(['node-2', 'node-1']);
          }}
        >
          select multiple nodes reversed
        </button>
        <button
          data-testid="mock-select-stale-nodes"
          type="button"
          onClick={() => {
            onSelectedNodesChange?.(['node-1', 'node-missing']);
          }}
        >
          select stale nodes
        </button>
        <button
          data-testid="mock-preview-selected-drag"
          type="button"
          onClick={() => {
            onNodePositionPreview?.('node-1', { x: -120, y: -60 });
            onNodePositionPreview?.('node-2', { x: 160, y: 204 });
          }}
        >
          preview selected drag
        </button>
        <button
          data-testid="mock-commit-selected-drag"
          type="button"
          onClick={() => {
            onNodePositionCommit?.('node-1', { x: -120, y: -60 });
            onNodePositionCommit?.('node-2', { x: 160, y: 204 });
          }}
        >
          commit selected drag
        </button>
        <button
          data-testid="mock-set-global-zoom"
          type="button"
          onClick={() => {
            onCameraChange?.({
              x: 0,
              y: 0,
              zoom: 0.2,
            });
          }}
        >
          set global zoom
        </button>
      </>
    );
  },
}));

import { App } from './App';

function buildTemplate(overrides: Partial<ProjectTemplate> = {}): ProjectTemplate {
  return {
    description: 'A minimal production planning starter.',
    id: 'documentary',
    name: 'Documentary Outline',
    ...overrides,
  };
}

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-shot-lab',
    isRoot: false,
    layerType: 'shot_lab',
    name: 'Shot Lab Canvas',
    ...overrides,
  };
}

function buildSession(overrides: Partial<ProjectSession> = {}): ProjectSession {
  const activeGraph = overrides.activeGraph ?? buildGraph();

  return {
    activeGraph,
    availableGraphs: [activeGraph],
    graphTrail: [
      {
        graphId: activeGraph.id,
        graphName: activeGraph.name,
        layerType: activeGraph.layerType,
      },
    ],
    projectId: 'project-1',
    projectName: 'Phase Zero',
    projectPath: '/projects/phase-zero',
    sessionId: 'session-1',
    templateId: 'documentary',
    ...overrides,
  };
}

function buildNode(overrides: Record<string, unknown> = {}) {
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

function buildNodeDetail(overrides: Record<string, unknown> = {}): GraphNodeDetail {
  const baseNode = buildNode(overrides);

  return {
    ...baseNode,
    assetBindings: [],
    assetRoleOptions: [],
    payload: {
      title: baseNode.title,
    },
  } as GraphNodeDetail;
}

function buildEdgeSummary(overrides: Partial<GraphEdgeSummary> = {}): GraphEdgeSummary {
  return {
    edgeType: 'references',
    graphId: 'graph-shot-lab',
    id: 'edge-1',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    ...overrides,
  };
}

function buildRelationTypeOption(
  overrides: Partial<GraphRelationTypeOption> = {},
): GraphRelationTypeOption {
  return {
    description: 'References another node in the same graph.',
    edgeType: 'references',
    label: 'References',
    ...overrides,
  };
}

function buildNodeTypeOption(overrides: Partial<GraphNodeTypeOption> = {}): GraphNodeTypeOption {
  const nodeType = overrides.nodeType ?? 'review';
  const label = overrides.label ?? 'Review';

  return {
    defaultSize: {
      width: 220,
      height: 200,
    },
    defaultTitle: overrides.defaultTitle ?? `New ${label}`,
    description: 'Human review note, decision, or feedback.',
    label,
    nodeType,
    ...overrides,
  };
}

function buildBridge(overrides: Partial<ProducerBridge> = {}): ProducerBridge {
  return {
    activate_graph: vi.fn(),
    bind_node_asset: vi.fn(),
    create_graph_edge: vi.fn(),
    create_graph_node: vi.fn().mockResolvedValue(buildNodeDetail()),
    create_project: vi.fn(),
    delete_graph_edge: vi.fn(),
    delete_graph_node: vi.fn().mockResolvedValue({
      graphId: 'graph-shot-lab',
      nodeId: 'node-1',
      deletedGraphIds: [],
    }),
    get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    get_project_media_index_summary: vi.fn().mockResolvedValue({
      assetCount: 0,
      audioCount: 0,
      documentCount: 0,
      failedJobCount: 0,
      imageCount: 0,
      pendingJobCount: 0,
      readyThumbnailCount: 0,
      videoCount: 0,
    }),
    get_project_session: vi.fn().mockResolvedValue(buildSession()),
    list_available_templates: vi.fn().mockResolvedValue([buildTemplate()]),
    list_graph_edges: vi.fn().mockResolvedValue([]),
    list_graph_node_type_options: vi.fn().mockResolvedValue([]),
    list_graph_nodes: vi.fn().mockResolvedValue([
      buildNode(),
      buildNode({
        id: 'node-2',
        layout: {
          height: 152,
          width: 240,
          x: 120,
          y: 180,
        },
        title: 'Reference B',
      }),
    ]),
    list_graph_relation_type_options: vi.fn().mockResolvedValue([buildRelationTypeOption()]),
    list_project_assets: vi.fn().mockResolvedValue([]),
    open_node_child_graph: vi.fn(),
    open_project: vi.fn(),
    refresh_project_media_index: vi.fn(),
    unbind_node_asset: vi.fn(),
    update_graph_node_payload: vi.fn().mockResolvedValue(buildNodeDetail()),
    update_graph_node_position: vi.fn().mockResolvedValue(buildNode()),
    ...overrides,
  };
}

beforeEach(() => {
  lastCanvasViewportProps = null;
  canvasViewportMountGraphIds = [];
  canvasViewportUnmountGraphIds = [];
});

test('persists a handle connection from CanvasViewport using the graph default relation type', async () => {
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-connect-edge'));

  await waitFor(() => {
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
    });
  });
  expect(lastCanvasViewportProps?.onEdgeConnect).toEqual(expect.any(Function));
});

test('persists a handle connection when the source node is a system anchor', async () => {
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-anchor-created',
      sourceNodeId: 'node-anchor',
      targetNodeId: 'node-2',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-connect-anchor-edge'));

  await waitFor(() => {
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-anchor',
      targetNodeId: 'node-2',
    });
  });
});

test('auto-connects a newly created shot_lab review node to the system anchor', async () => {
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      decision: '',
      feedback: '',
      graphId: 'graph-shot-lab',
      id: 'node-created',
      layout: {
        height: 200,
        width: 220,
        x: -380,
        y: -160,
      },
      nodeType: 'review',
      reviewed_at: '',
      reviewer: '',
      status: undefined,
      title: '新建评审',
    }),
  );
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-anchor-created',
      sourceNodeId: 'node-anchor',
      targetNodeId: 'node-created',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
    list_graph_nodes: vi.fn().mockResolvedValue([
      buildNode({
        graphId: 'graph-shot-lab',
        id: 'node-anchor',
        isSystem: true,
        layout: {
          height: 128,
          width: 208,
          x: -120,
          y: -320,
        },
        nodeType: 'system_anchor',
        sourceNodeType: 'storyboard_shot',
        status: undefined,
        title: '分镜锚点',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-quick-add'));
  await user.click(await screen.findByRole('option', { name: /评审/ }));

  await waitFor(() => {
    expect(createGraphNode).toHaveBeenCalledWith({
      graphId: 'graph-shot-lab',
      nodeType: 'review',
      payload: {
        decision: '',
        feedback: '',
        reviewed_at: '',
        reviewer: '',
        title: '新建评审',
      },
      position: {
        x: -380,
        y: -160,
      },
      sessionId: 'session-1',
    });
  });

  await waitFor(() => {
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-anchor',
      targetNodeId: 'node-created',
    });
  });
});

test('creates a node from source-handle quick add and connects the existing node to it', async () => {
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      decision: '',
      feedback: '',
      graphId: 'graph-shot-lab',
      id: 'node-created',
      layout: {
        height: 200,
        width: 220,
        x: -380,
        y: -160,
      },
      nodeType: 'review',
      reviewed_at: '',
      reviewer: '',
      status: undefined,
      title: '新建评审',
    }),
  );
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-created',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
    list_graph_nodes: vi.fn().mockResolvedValue([
      buildNode(),
      buildNode({
        graphId: 'graph-shot-lab',
        id: 'node-anchor',
        isSystem: true,
        layout: {
          height: 128,
          width: 208,
          x: -120,
          y: -320,
        },
        nodeType: 'system_anchor',
        sourceNodeType: 'storyboard_shot',
        status: undefined,
        title: '分镜锚点',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-connect-quick-add-source'));
  await user.click(await screen.findByRole('option', { name: /评审/ }));

  await waitFor(() => {
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-created',
    });
  });
  expect(createGraphEdge).toHaveBeenCalledTimes(1);
});

test('creates a node from target-handle quick add and connects the new node back into the existing node', async () => {
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      decision: '',
      feedback: '',
      graphId: 'graph-shot-lab',
      id: 'node-created',
      layout: {
        height: 200,
        width: 220,
        x: -380,
        y: -160,
      },
      nodeType: 'review',
      reviewed_at: '',
      reviewer: '',
      status: undefined,
      title: '新建评审',
    }),
  );
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-created',
      targetNodeId: 'node-1',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-connect-quick-add-target'));
  await user.click(await screen.findByRole('option', { name: /评审/ }));

  await waitFor(() => {
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-created',
      targetNodeId: 'node-1',
    });
  });
});

test('does not create a node or edge when connect quick add is cancelled', async () => {
  const createGraphNode = vi.fn();
  const createGraphEdge = vi.fn();
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-connect-quick-add-source'));
  expect(await screen.findByRole('dialog', { name: /节点快速创建器/i })).toBeInTheDocument();

  await user.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /节点快速创建器/i })).not.toBeInTheDocument();
  });
  expect(createGraphNode).not.toHaveBeenCalled();
  expect(createGraphEdge).not.toHaveBeenCalled();
});

test('keeps the created node and shows an error when connect quick add edge persistence fails', async () => {
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      decision: '',
      feedback: '',
      graphId: 'graph-shot-lab',
      id: 'node-created',
      layout: {
        height: 200,
        width: 220,
        x: -380,
        y: -160,
      },
      nodeType: 'review',
      reviewed_at: '',
      reviewer: '',
      status: undefined,
      title: '新建评审',
    }),
  );
  const createGraphEdge = vi.fn().mockRejectedValue(new Error('edge failed'));
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-connect-quick-add-source'));
  await user.click(await screen.findByRole('option', { name: /评审/ }));

  expect(await screen.findByText(/节点已创建，但未能建立连接/)).toBeInTheDocument();
  expect(
    (lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id),
  ).toContain('node-created');
  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
});

test('loads relation types on demand before persisting a connect quick add edge', async () => {
  const deferredRelationTypes = createDeferred<GraphRelationTypeOption[]>();
  const listGraphRelationTypeOptions = vi
    .fn()
    .mockImplementationOnce(() => deferredRelationTypes.promise)
    .mockResolvedValueOnce([buildRelationTypeOption()]);
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      decision: '',
      feedback: '',
      graphId: 'graph-shot-lab',
      id: 'node-created',
      layout: {
        height: 200,
        width: 220,
        x: -380,
        y: -160,
      },
      nodeType: 'review',
      reviewed_at: '',
      reviewer: '',
      status: undefined,
      title: '新建评审',
    }),
  );
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-created',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
    list_graph_relation_type_options: listGraphRelationTypeOptions,
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect(listGraphRelationTypeOptions).toHaveBeenCalledTimes(1);
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-connect-quick-add-source'));
  await user.click(await screen.findByRole('option', { name: /评审/ }));

  await act(async () => {
    deferredRelationTypes.resolve([buildRelationTypeOption()]);
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(listGraphRelationTypeOptions).toHaveBeenCalledTimes(2);
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-created',
    });
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return {
    promise,
    resolve,
  };
}

test('keeps a newly created persisted edge when the initial edge list resolves stale', async () => {
  const initialEdgeList = createDeferred<GraphEdgeSummary[]>();
  const persistedEdge = buildEdgeSummary({
    id: 'edge-created',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
  });
  const listGraphEdges = vi
    .fn()
    .mockImplementationOnce(() => initialEdgeList.promise)
    .mockResolvedValueOnce([persistedEdge]);
  const createGraphEdge = vi.fn().mockResolvedValue(
    persistedEdge,
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    list_graph_edges: listGraphEdges,
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect(listGraphEdges).toHaveBeenCalledWith({
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
    });
  });
  await waitFor(() => {
    expect((lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id)).toEqual([
      'node-1',
      'node-2',
    ]);
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-connect-edge'));

  await waitFor(() => {
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id)).toEqual([
      'edge-created',
    ]);
  });

  await act(async () => {
    initialEdgeList.resolve([]);
    await Promise.resolve();
  });

  await waitFor(() => {
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id)).toEqual([
      'edge-created',
    ]);
  });
});

test('re-hydrates graph edges after a stale initial edge list resolves behind a local mutation', async () => {
  const initialEdgeList = createDeferred<GraphEdgeSummary[]>();
  const listGraphEdges = vi
    .fn()
    .mockImplementationOnce(() => initialEdgeList.promise)
    .mockResolvedValueOnce([
      buildEdgeSummary({
        id: 'edge-created',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
    ]);
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    list_graph_edges: listGraphEdges,
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect(listGraphEdges).toHaveBeenCalledTimes(1);
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-connect-edge'));

  await act(async () => {
    initialEdgeList.resolve([]);
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(listGraphEdges).toHaveBeenCalledTimes(2);
  });
});

test('keeps a locally created node and edge when the initial node list resolves stale', async () => {
  const initialNodeList = createDeferred<Array<ReturnType<typeof buildNode>>>();
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      graphId: 'graph-shot-lab',
      id: 'node-created',
      layout: {
        height: 200,
        width: 220,
        x: -380,
        y: -160,
      },
      nodeType: 'review',
      status: undefined,
      title: '新建评审',
    }),
  );
  const listGraphNodes = vi
    .fn()
    .mockImplementationOnce(() => initialNodeList.promise)
    .mockResolvedValueOnce([
      buildNode(),
      buildNode({
        graphId: 'graph-shot-lab',
        id: 'node-created',
        layout: {
          height: 200,
          width: 220,
          x: -380,
          y: -160,
        },
        nodeType: 'review',
        status: undefined,
        title: '新建评审',
      }),
    ]);
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-created',
      targetNodeId: 'node-1',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    create_graph_node: createGraphNode,
    list_graph_edges: vi.fn().mockResolvedValue([]),
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        label: 'Review',
        nodeType: 'review',
      }),
    ]),
    list_graph_nodes: listGraphNodes,
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect(listGraphNodes).toHaveBeenCalledWith({
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
    });
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-quick-add'));
  await user.click(await screen.findByRole('option', { name: /评审/ }));

  await waitFor(() => {
    expect((lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id)).toContain(
      'node-created',
    );
  });

  await user.click(await screen.findByTestId('mock-connect-created-edge'));

  await act(async () => {
    initialNodeList.resolve([buildNode()]);
    await Promise.resolve();
  });

  await waitFor(() => {
    expect((lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id)).toEqual([
      'node-1',
      'node-created',
    ]);
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id)).toEqual([
      'edge-created',
    ]);
  });
});

test('does not re-create an already persisted edge when the same connection is attempted again', async () => {
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-existing',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    list_graph_edges: vi.fn().mockResolvedValue([
      buildEdgeSummary({
        id: 'edge-existing',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id)).toEqual([
      'edge-existing',
    ]);
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-connect-edge'));

  expect(createGraphEdge).not.toHaveBeenCalled();
});

test('filters out edges whose endpoints are not present in the current node snapshot', async () => {
  const bridge = buildBridge({
    list_graph_edges: vi.fn().mockResolvedValue([
      buildEdgeSummary({
        id: 'edge-valid',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
      buildEdgeSummary({
        id: 'edge-missing-target',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-missing',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect((lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id)).toEqual([
      'node-1',
      'node-2',
    ]);
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id)).toEqual([
      'edge-valid',
    ]);
  });
});

test('loads relation types on demand when a handle connection is attempted before relation options hydrate', async () => {
  const deferredRelationTypes = createDeferred<GraphRelationTypeOption[]>();
  const listGraphRelationTypeOptions = vi
    .fn()
    .mockImplementationOnce(() => deferredRelationTypes.promise)
    .mockResolvedValueOnce([buildRelationTypeOption()]);
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
    }),
  );
  const bridge = buildBridge({
    create_graph_edge: createGraphEdge,
    list_graph_relation_type_options: listGraphRelationTypeOptions,
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect(listGraphRelationTypeOptions).toHaveBeenCalledTimes(1);
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-connect-edge'));

  await act(async () => {
    deferredRelationTypes.resolve([buildRelationTypeOption()]);
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(listGraphRelationTypeOptions).toHaveBeenCalledTimes(2);
    expect(createGraphEdge).toHaveBeenCalledWith({
      edgeType: 'references',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
    });
  });
});

test('remounts CanvasViewport when the active graph changes', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Brief Canvas',
    layerType: 'brief',
    isRoot: true,
  });
  const detailGraph = buildGraph({
    id: 'graph-detail',
    name: 'Shot Lab',
    layerType: 'shot_lab',
    isRoot: false,
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      {
        graphId: rootGraph.id,
        graphName: rootGraph.name,
        layerType: rootGraph.layerType,
      },
    ],
  });
  const detailSession = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      {
        graphId: rootGraph.id,
        graphName: rootGraph.name,
        layerType: rootGraph.layerType,
      },
      {
        graphId: detailGraph.id,
        graphName: detailGraph.name,
        layerType: detailGraph.layerType,
        sourceNodeId: 'node-1',
        sourceNodeTitle: 'Prompt A',
      },
    ],
  });
  const bridge = buildBridge({
    activate_graph: vi.fn().mockResolvedValue(rootSession),
    get_project_session: vi.fn().mockResolvedValue(rootSession),
    list_graph_nodes: vi.fn().mockImplementation(({ graphId }: { graphId: string }) =>
      Promise.resolve([
        buildNode({
          graphId,
        }),
      ]),
    ),
    open_node_child_graph: vi.fn().mockResolvedValue(detailSession),
  });

  render(<App bridge={bridge} />);

  await waitFor(() => {
    expect(canvasViewportMountGraphIds).toEqual(['graph-root']);
  });

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-open-child-graph'));

  await waitFor(() => {
    expect(canvasViewportUnmountGraphIds).toEqual(['graph-root']);
    expect(canvasViewportMountGraphIds).toEqual(['graph-root', 'graph-detail']);
  });
});

test('selects an edge, closes the node drawer, updates the HUD, and deletes the edge with Delete', async () => {
  const deleteGraphEdge = vi.fn().mockResolvedValue(undefined);
  const bridge = buildBridge({
    delete_graph_edge: deleteGraphEdge,
    get_graph_node_detail: vi.fn().mockResolvedValue(
      buildNodeDetail({
        id: 'node-1',
        title: 'Prompt A',
      }),
    ),
    list_graph_edges: vi.fn().mockResolvedValue([
      buildEdgeSummary({
        id: 'edge-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  await user.click(await screen.findByTestId('mock-select-node'));
  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByText('已选中：Prompt A')).toBeInTheDocument();

  await user.click(screen.getByTestId('mock-select-edge'));

  await waitFor(() => {
    expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  });
  expect(screen.getByText('已选中：参考（Prompt A → Reference B）')).toBeInTheDocument();
  expect(lastCanvasViewportProps?.selectedEdgeId).toBe('edge-1');

  await user.keyboard('{Delete}');

  await waitFor(() => {
    expect(deleteGraphEdge).toHaveBeenCalledWith({
      edgeId: 'edge-1',
      graphId: 'graph-shot-lab',
      sessionId: 'session-1',
    });
  });
  await waitFor(() => {
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined) ?? []).toEqual([]);
  });
  expect(lastCanvasViewportProps?.selectedEdgeId).toBeNull();
  expect(screen.getByText('未选中内容')).toBeInTheDocument();
});

test('keeps a selected edge visible when the camera enters the global LoD zoom range', async () => {
  const bridge = buildBridge({
    list_graph_edges: vi.fn().mockResolvedValue([
      buildEdgeSummary({
        id: 'edge-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
      buildEdgeSummary({
        id: 'edge-2',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-1',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-edge'));
  await user.click(screen.getByTestId('mock-set-global-zoom'));

  await waitFor(() => {
    expect((lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id)).toEqual([
      'edge-1',
    ]);
  });
});

test('closes the drawer for multi-select, shows a count HUD, and restores single-node drawer behavior', async () => {
  const bridge = buildBridge({
    get_graph_node_detail: vi.fn().mockImplementation(({ nodeId }: { nodeId: string }) =>
      Promise.resolve(
        buildNodeDetail({
          id: nodeId,
          title: nodeId === 'node-2' ? 'Reference B' : 'Prompt A',
        }),
      ),
    ),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-node'));
  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByText('已选中：Prompt A')).toBeInTheDocument();

  await user.click(screen.getByTestId('mock-select-multiple-nodes'));

  await waitFor(() => {
    expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  });
  expect(screen.getByText('已选中 2 个节点')).toBeInTheDocument();
  expect(lastCanvasViewportProps?.selectedNodeIds).toEqual(['node-1', 'node-2']);

  await user.click(screen.getByTestId('mock-select-node-2'));

  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByText('已选中：Reference B')).toBeInTheDocument();
  expect(lastCanvasViewportProps?.selectedNodeIds).toEqual(['node-2']);
});

test('canonicalizes marquee multi-select ids before feeding them back into CanvasViewport', async () => {
  const bridge = buildBridge();

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-multiple-nodes-reversed'));

  await waitFor(() => {
    expect(lastCanvasViewportProps?.selectedNodeIds).toEqual(['node-1', 'node-2']);
  });
  expect(screen.getByText('已选中 2 个节点')).toBeInTheDocument();
});

test('deletes multiple selected nodes in order and removes their connected edges from the canvas cache', async () => {
  const deleteGraphNode = vi.fn().mockImplementation(({ nodeId }: { nodeId: string }) =>
    Promise.resolve({
      graphId: 'graph-shot-lab',
      nodeId,
      deletedGraphIds: [],
    }),
  );
  const bridge = buildBridge({
    delete_graph_node: deleteGraphNode,
    list_graph_edges: vi.fn().mockResolvedValue([
      buildEdgeSummary({
        id: 'edge-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      }),
      buildEdgeSummary({
        id: 'edge-2',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-3',
      }),
    ]),
    list_graph_nodes: vi.fn().mockResolvedValue([
      buildNode({
        id: 'node-1',
        title: 'Prompt A',
      }),
      buildNode({
        id: 'node-2',
        layout: {
          height: 152,
          width: 240,
          x: 120,
          y: 180,
        },
        title: 'Reference B',
      }),
      buildNode({
        id: 'node-3',
        layout: {
          height: 140,
          width: 220,
          x: 380,
          y: 32,
        },
        nodeType: 'review',
        title: 'Review C',
      }),
    ]),
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-multiple-nodes'));
  await user.keyboard('{Delete}');

  await waitFor(() => {
    expect(deleteGraphNode).toHaveBeenNthCalledWith(1, {
      graphId: 'graph-shot-lab',
      nodeId: 'node-1',
      sessionId: 'session-1',
    });
    expect(deleteGraphNode).toHaveBeenNthCalledWith(2, {
      graphId: 'graph-shot-lab',
      nodeId: 'node-2',
      sessionId: 'session-1',
    });
  });
  expect(
    (lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id),
  ).toEqual(['node-3']);
  expect(
    (lastCanvasViewportProps?.edges as GraphEdgeSummary[] | undefined)?.map((edge) => edge.id) ?? [],
  ).toEqual([]);
  expect(lastCanvasViewportProps?.selectedNodeIds).toEqual([]);
  expect(screen.getByText('未选中内容')).toBeInTheDocument();
});

test('stops multi-delete on the first failure and preserves the remaining selection', async () => {
  const deleteGraphNode = vi.fn().mockImplementation(({ nodeId }: { nodeId: string }) => {
    if (nodeId === 'node-2') {
      return Promise.reject(new Error('Could not delete node-2'));
    }

    return Promise.resolve({
      graphId: 'graph-shot-lab',
      nodeId,
      deletedGraphIds: [],
    });
  });
  const bridge = buildBridge({
    delete_graph_node: deleteGraphNode,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-multiple-nodes'));
  await user.keyboard('{Delete}');

  await waitFor(() => {
    expect(deleteGraphNode).toHaveBeenNthCalledWith(1, {
      graphId: 'graph-shot-lab',
      nodeId: 'node-1',
      sessionId: 'session-1',
    });
    expect(deleteGraphNode).toHaveBeenNthCalledWith(2, {
      graphId: 'graph-shot-lab',
      nodeId: 'node-2',
      sessionId: 'session-1',
    });
  });
  expect(lastCanvasViewportProps?.selectedNodeIds).toEqual(['node-2']);
  expect(
    (lastCanvasViewportProps?.nodes as Array<{ id: string }> | undefined)?.map((node) => node.id),
  ).toEqual(['node-2']);
  expect(await screen.findByText('无法删除节点。')).toBeInTheDocument();
});

test('persists a grouped drag by saving each selected node position independently', async () => {
  const updateGraphNodePosition = vi.fn().mockImplementation(
    ({ nodeId, position }: { nodeId: string; position: { x: number; y: number } }) =>
      Promise.resolve(
        buildNode({
          id: nodeId,
          layout: {
            height: 152,
            width: 240,
            x: position.x,
            y: position.y,
          },
          title: nodeId === 'node-2' ? 'Reference B' : 'Prompt A',
        }),
      ),
  );
  const bridge = buildBridge({
    update_graph_node_position: updateGraphNodePosition,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-multiple-nodes'));
  await user.click(screen.getByTestId('mock-preview-selected-drag'));
  await user.click(screen.getByTestId('mock-commit-selected-drag'));

  await waitFor(() => {
    expect(updateGraphNodePosition).toHaveBeenNthCalledWith(1, {
      graphId: 'graph-shot-lab',
      nodeId: 'node-1',
      position: {
        x: -120,
        y: -60,
      },
      sessionId: 'session-1',
    });
    expect(updateGraphNodePosition).toHaveBeenNthCalledWith(2, {
      graphId: 'graph-shot-lab',
      nodeId: 'node-2',
      position: {
        x: 160,
        y: 204,
      },
      sessionId: 'session-1',
    });
  });
});

test('reconciles stale selected node ids after node hydration removes them', async () => {
  const bridge = buildBridge();

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-stale-nodes'));

  await waitFor(() => {
    expect(lastCanvasViewportProps?.selectedNodeIds).toEqual(['node-1']);
  });
});

test('renders an auto-layout button in the workspace and disables it when fewer than two target nodes remain', async () => {
  const bridge = buildBridge();

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  const autoLayoutButton = await screen.findByRole('button', { name: '自动规整全部节点' });

  expect(autoLayoutButton).toBeEnabled();

  await user.click(screen.getByTestId('mock-select-node'));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '自动规整已选节点' })).toBeDisabled();
  });
});

test('auto-layouts all ordinary nodes when nothing is selected and persists each position', async () => {
  const updateGraphNodePosition = vi.fn().mockImplementation(
    ({ nodeId, position }: { nodeId: string; position: { x: number; y: number } }) =>
      Promise.resolve(
        buildNode({
          id: nodeId,
          layout: {
            height: 152,
            width: 240,
            x: position.x,
            y: position.y,
          },
          title: nodeId === 'node-2' ? 'Reference B' : 'Prompt A',
        }),
      ),
  );
  const bridge = buildBridge({
    update_graph_node_position: updateGraphNodePosition,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '自动规整全部节点' }));

  await waitFor(() => {
    expect(updateGraphNodePosition).toHaveBeenCalledTimes(2);
  });
  expect(updateGraphNodePosition).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      graphId: 'graph-shot-lab',
      nodeId: 'node-1',
      sessionId: 'session-1',
    }),
  );
  expect(updateGraphNodePosition).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      graphId: 'graph-shot-lab',
      nodeId: 'node-2',
      sessionId: 'session-1',
    }),
  );
});

test('auto-layouts only the selected ordinary nodes and keeps the marquee selection', async () => {
  const updateGraphNodePosition = vi.fn().mockImplementation(
    ({ nodeId, position }: { nodeId: string; position: { x: number; y: number } }) =>
      Promise.resolve(
        buildNode({
          id: nodeId,
          layout: {
            height: 152,
            width: 240,
            x: position.x,
            y: position.y,
          },
          title:
            nodeId === 'node-3' ? 'Review C' : nodeId === 'node-2' ? 'Reference B' : 'Prompt A',
        }),
      ),
  );
  const bridge = buildBridge({
    list_graph_nodes: vi.fn().mockResolvedValue([
      buildNode({
        id: 'node-1',
        title: 'Prompt A',
      }),
      buildNode({
        id: 'node-2',
        layout: {
          height: 152,
          width: 240,
          x: 120,
          y: 180,
        },
        title: 'Reference B',
      }),
      buildNode({
        id: 'node-3',
        layout: {
          height: 152,
          width: 240,
          x: 420,
          y: 96,
        },
        title: 'Review C',
      }),
    ]),
    update_graph_node_position: updateGraphNodePosition,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('mock-select-multiple-nodes'));
  await user.click(screen.getByRole('button', { name: '自动规整已选节点' }));

  await waitFor(() => {
    expect(updateGraphNodePosition).toHaveBeenCalledTimes(2);
  });
  expect(updateGraphNodePosition).toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 'node-1',
    }),
  );
  expect(updateGraphNodePosition).toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 'node-2',
    }),
  );
  expect(updateGraphNodePosition).not.toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 'node-3',
    }),
  );
  expect(lastCanvasViewportProps?.selectedNodeIds).toEqual(['node-1', 'node-2']);
  expect(screen.getByText('已选中 2 个节点')).toBeInTheDocument();
});

test('skips system nodes during auto-layout and keeps saving the remaining nodes after an error', async () => {
  const updateGraphNodePosition = vi
    .fn()
    .mockResolvedValueOnce(
      buildNode({
        id: 'node-1',
        layout: {
          height: 152,
          width: 240,
          x: -120,
          y: 24,
        },
      }),
    )
    .mockRejectedValueOnce(new Error('position failed'));
  const bridge = buildBridge({
    list_graph_nodes: vi.fn().mockResolvedValue([
      buildNode({
        id: 'node-anchor',
        isSystem: true,
        layout: {
          height: 128,
          width: 208,
          x: -80,
          y: -280,
        },
        nodeType: 'system_anchor',
        title: '系统锚点',
      }),
      buildNode({
        id: 'node-1',
        title: 'Prompt A',
      }),
      buildNode({
        id: 'node-2',
        layout: {
          height: 152,
          width: 240,
          x: 120,
          y: 180,
        },
        title: 'Reference B',
      }),
    ]),
    update_graph_node_position: updateGraphNodePosition,
  });

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '自动规整全部节点' }));

  await waitFor(() => {
    expect(updateGraphNodePosition).toHaveBeenCalledTimes(2);
  });
  expect(updateGraphNodePosition).not.toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 'node-anchor',
    }),
  );
  expect(await screen.findByText('无法保存到本地')).toBeInTheDocument();
});
