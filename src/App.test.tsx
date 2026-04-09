import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

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
      const nodes = (props.nodes as Array<Record<string, unknown>> | undefined) ?? [];
      const edges = (props.edges as Array<Record<string, unknown>> | undefined) ?? [];
      const nodeTypes = (props.nodeTypes as Record<string, (props: Record<string, unknown>) => JSX.Element>) ?? {};
      const edgeTypes = (props.edgeTypes as Record<string, (props: Record<string, unknown>) => JSX.Element>) ?? {};
      const nodesDraggable = props.nodesDraggable !== false;
      const dragStateRef = React.useRef<{
        node: Record<string, unknown>;
        originClientX: number;
        originClientY: number;
        originPosition: { x: number; y: number };
      } | null>(null);

      React.useEffect(() => {
        (props.onInit as ((instance: { setViewport: () => Promise<boolean> }) => void) | undefined)?.({
          setViewport: async () => true,
        });
      }, [props.onInit]);

      React.useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
          const dragState = dragStateRef.current;

          if (!dragState) {
            return;
          }

          const nextNode = {
            ...dragState.node,
            position: {
              x: dragState.originPosition.x + (event.clientX - dragState.originClientX),
              y: dragState.originPosition.y + (event.clientY - dragState.originClientY),
            },
          };

          (props.onNodeDrag as ((event: MouseEvent, node: Record<string, unknown>, nodes: Record<string, unknown>[]) => void) | undefined)?.(
            event,
            nextNode,
            [nextNode],
          );
        };

        const handleMouseUp = (event: MouseEvent) => {
          const dragState = dragStateRef.current;

          if (!dragState) {
            return;
          }

          const nextNode = {
            ...dragState.node,
            position: {
              x: dragState.originPosition.x + (event.clientX - dragState.originClientX),
              y: dragState.originPosition.y + (event.clientY - dragState.originClientY),
            },
          };

          dragStateRef.current = null;
          (props.onNodeDragStop as ((event: MouseEvent, node: Record<string, unknown>, nodes: Record<string, unknown>[]) => void) | undefined)?.(
            event,
            nextNode,
            [nextNode],
          );
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };
      }, [props.onNodeDrag, props.onNodeDragStop]);

      return (
        <div className={String(props.className ?? '')} data-testid="rf__wrapper">
          <div
            className="react-flow__pane"
            onClick={() => {
              (props.onPaneClick as (() => void) | undefined)?.();
            }}
          />
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
                      (props.onEdgeClick as ((event: React.MouseEvent<SVGGElement>, edge: Record<string, unknown>) => void) | undefined)?.(
                        event,
                        edge,
                      );
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
                    (props.onNodeClick as ((event: React.MouseEvent<HTMLDivElement>, node: Record<string, unknown>) => void) | undefined)?.(
                      event,
                      node,
                    );
                  }}
                  onDoubleClick={(event) => {
                    (props.onNodeDoubleClick as ((event: React.MouseEvent<HTMLDivElement>, node: Record<string, unknown>) => void) | undefined)?.(
                      event,
                      node,
                    );
                  }}
                  onMouseDown={(event) => {
                    if (!nodesDraggable || event.button !== 0) {
                      return;
                    }

                    dragStateRef.current = {
                      node,
                      originClientX: event.clientX,
                      originClientY: event.clientY,
                      originPosition: (node.position as { x: number; y: number } | undefined) ?? {
                        x: 0,
                        y: 0,
                      },
                    };

                    (props.onNodeDragStart as ((event: React.MouseEvent<HTMLDivElement>, node: Record<string, unknown>, nodes: Record<string, unknown>[]) => void) | undefined)?.(
                      event,
                      node,
                      [node],
                    );
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

import { App } from './App';
import type {
  GraphNodeDetail,
  GraphEdgeSummary,
  GraphNodeTypeOption,
  GraphContextTrailItem,
  GraphRelationTypeOption,
  ProjectAssetSummary,
  ProjectMediaIndexSummary,
  ProducerBridge,
  ProjectGraphSummary,
  ProjectSession,
  ProjectSessionHandle,
  ProjectTemplate,
} from './bridge/contracts';

function buildTemplate(overrides: Partial<ProjectTemplate> = {}): ProjectTemplate {
  return {
    id: 'documentary',
    name: 'Documentary Outline',
    description: 'A minimal production planning starter.',
    ...overrides,
  };
}

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-root',
    name: 'Story Graph',
    layerType: 'story',
    isRoot: true,
    ...overrides,
  };
}

function buildTrailItem(
  graph: ProjectGraphSummary,
  overrides: Partial<GraphContextTrailItem> = {},
): GraphContextTrailItem {
  return {
    graphId: graph.id,
    graphName: graph.name,
    layerType: graph.layerType,
    ...overrides,
  };
}

function buildSession(overrides: Partial<ProjectSession> = {}): ProjectSession {
  const activeGraph = overrides.activeGraph ?? buildGraph();
  const availableGraphs = overrides.availableGraphs ?? [activeGraph];
  const graphTrail = overrides.graphTrail ?? [buildTrailItem(activeGraph)];

  return {
    sessionId: 'session-1',
    projectId: 'project-1',
    projectName: 'Phase Zero',
    projectPath: '/projects/phase-zero',
    templateId: 'documentary',
    activeGraph,
    availableGraphs,
    graphTrail,
    ...overrides,
  };
}

function buildHandle(overrides: Partial<ProjectSessionHandle> = {}): ProjectSessionHandle {
  return {
    sessionId: 'session-1',
    ...overrides,
  };
}

function buildMediaIndexSummary(
  overrides: Partial<ProjectMediaIndexSummary> = {},
): ProjectMediaIndexSummary {
  return {
    assetCount: 0,
    imageCount: 0,
    videoCount: 0,
    audioCount: 0,
    documentCount: 0,
    readyThumbnailCount: 0,
    pendingJobCount: 0,
    failedJobCount: 0,
    ...overrides,
  };
}

function buildAssetSummary(overrides: Partial<ProjectAssetSummary> = {}): ProjectAssetSummary {
  return {
    id: 'asset-1',
    relativePath: 'images/hero.png',
    filePath: '/projects/phase-zero/assets/images/hero.png',
    mediaType: 'image',
    mimeType: 'image/png',
    byteSize: 1024,
    width: 1280,
    height: 720,
    durationMs: undefined,
    thumbnailPath: '/projects/phase-zero/.producer/thumbnails/asset-1/card.png',
    thumbnailStatus: 'ready',
    indexedAt: '1710000000',
    missing: false,
    ...overrides,
  };
}

function buildEdgeSummary(overrides: Partial<GraphEdgeSummary> = {}): GraphEdgeSummary {
  return {
    id: 'edge-1',
    graphId: 'graph-root',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    edgeType: 'references',
    ...overrides,
  };
}

function buildRelationTypeOption(
  overrides: Partial<GraphRelationTypeOption> = {},
): GraphRelationTypeOption {
  return {
    edgeType: 'references',
    label: 'References',
    description: 'References another node in the same graph.',
    ...overrides,
  };
}

function buildNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Opening Brief',
    nodeType: 'brief',
    storedAssetCount: 0,
    status: 'Ready',
    isSystem: false,
    canEnterChildGraph: false,
    layout: {
      x: -180,
      y: -110,
      width: 188,
      height: 118,
    },
    ...overrides,
  };
}

function buildNodeDetail(overrides: Record<string, unknown> = {}): GraphNodeDetail {
  const hasSystemFlag = 'isSystem' in overrides;
  const hasChildGraphFlag = 'canEnterChildGraph' in overrides;
  const baseNodeOverrides: Record<string, unknown> = {};

  if ('id' in overrides) {
    baseNodeOverrides.id = overrides.id;
  }

  if ('graphId' in overrides) {
    baseNodeOverrides.graphId = overrides.graphId;
  }

  if ('title' in overrides) {
    baseNodeOverrides.title = overrides.title;
  }

  if ('nodeType' in overrides) {
    baseNodeOverrides.nodeType = overrides.nodeType;
  }

  if ('status' in overrides) {
    baseNodeOverrides.status = overrides.status;
  }

  if ('isSystem' in overrides) {
    baseNodeOverrides.isSystem = overrides.isSystem;
  }

  if ('canEnterChildGraph' in overrides) {
    baseNodeOverrides.canEnterChildGraph = overrides.canEnterChildGraph;
  }

  if ('layout' in overrides) {
    baseNodeOverrides.layout = overrides.layout;
  }

  const baseNode = buildNode(baseNodeOverrides);
  const payloadOverrides = { ...overrides };
  const payload = payloadOverrides.payload;

  delete payloadOverrides.id;
  delete payloadOverrides.graphId;
  delete payloadOverrides.title;
  delete payloadOverrides.nodeType;
  delete payloadOverrides.storedAssetCount;
  delete payloadOverrides.status;
  delete payloadOverrides.isSystem;
  delete payloadOverrides.canEnterChildGraph;
  delete payloadOverrides.layout;
  delete payloadOverrides.assetBindings;
  delete payloadOverrides.payload;

  const assetBindings = Array.isArray(overrides.assetBindings)
    ? (overrides.assetBindings as GraphNodeDetail['assetBindings'])
    : [];
  const assetRoleOptions = Array.isArray(overrides.assetRoleOptions)
    ? (overrides.assetRoleOptions as GraphNodeDetail['assetRoleOptions'])
    : baseNode.nodeType === 'brief'
      ? [
          { role: 'product_image', label: 'Product Image' },
          { role: 'example_video', label: 'Example Video' },
        ]
      : [];
  const defaultPayload =
    baseNode.nodeType === 'brief'
      ? {
          title: baseNode.title,
          ...(baseNode.status ? { status: baseNode.status } : {}),
          description: '',
        }
      : {
          title: baseNode.title,
          ...(baseNode.status ? { status: baseNode.status } : {}),
        };

  const detail: GraphNodeDetail = {
    ...baseNode,
    storedAssetCount:
      typeof overrides.storedAssetCount === 'number'
        ? (overrides.storedAssetCount as number)
        : assetBindings.length,
    assetBindings,
    assetRoleOptions,
    payload: {
      ...defaultPayload,
      ...(typeof payload === 'object' && payload !== null ? payload : {}),
      ...payloadOverrides,
    },
  };

  if (!hasSystemFlag) {
    delete detail.isSystem;
  }

  if (!hasChildGraphFlag) {
    delete detail.canEnterChildGraph;
  }

  return detail;
}

function buildBridge(overrides: Partial<ProducerBridge> = {}): ProducerBridge {
  return {
    list_available_templates: vi.fn().mockResolvedValue([buildTemplate()]),
    create_project: vi.fn().mockResolvedValue(buildHandle()),
    open_project: vi.fn().mockResolvedValue(buildHandle()),
    get_project_session: vi.fn().mockResolvedValue(null),
    activate_graph: vi.fn(),
    open_node_child_graph: vi.fn(),
    list_graph_nodes: vi.fn().mockResolvedValue([]),
    list_graph_node_type_options: vi.fn().mockResolvedValue([]),
    get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    create_graph_node: vi.fn().mockResolvedValue(buildNodeDetail()),
    update_graph_node_payload: vi.fn().mockResolvedValue(buildNodeDetail()),
    update_graph_node_position: vi.fn().mockResolvedValue(buildNode()),
    delete_graph_node: vi.fn().mockResolvedValue({
      graphId: 'graph-root',
      nodeId: 'node-1',
      deletedGraphIds: [],
    }),
    bind_node_asset: vi.fn(),
    unbind_node_asset: vi.fn(),
    list_graph_edges: vi.fn().mockResolvedValue([]),
    list_graph_relation_type_options: vi.fn().mockResolvedValue([]),
    create_graph_edge: vi.fn(),
    delete_graph_edge: vi.fn(),
    get_project_media_index_summary: vi.fn().mockResolvedValue(buildMediaIndexSummary()),
    refresh_project_media_index: vi.fn().mockResolvedValue(buildMediaIndexSummary()),
    list_project_assets: vi.fn().mockResolvedValue([buildAssetSummary()]),
    ...overrides,
  };
}

function buildNodeTypeOption(overrides: Partial<GraphNodeTypeOption> = {}): GraphNodeTypeOption {
  const nodeType = overrides.nodeType ?? 'prompt';
  const label = overrides.label ?? '提示词';

  return {
    nodeType,
    label,
    description: '用于组织生成提示词与参数策略。',
    defaultTitle: overrides.defaultTitle ?? `新建${label}`,
    defaultSize: {
      width: 220,
      height: 200,
    },
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  delete (window as Window & { __PRODUCER_ENABLE_NODE_DRAG__?: boolean }).__PRODUCER_ENABLE_NODE_DRAG__;
});

const nodeDragInteractionTest =
  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent) ? test.skip : test;

test('shows startup loading, surfaces a launch error, and retries back to ready state', async () => {
  const bridge = buildBridge({
    list_available_templates: vi
      .fn()
      .mockRejectedValueOnce(new Error('Template service unavailable'))
      .mockResolvedValueOnce([buildTemplate()]),
  });

  render(<App bridge={bridge} />);

  expect(screen.getByText(/正在准备工作区/)).toBeInTheDocument();

  expect(await screen.findByText(/producer 启动失败/i)).toBeInTheDocument();

  await userEvent.setup().click(
    screen.getByRole('button', {
      name: /重试启动/,
    }),
  );

  expect(await screen.findByRole('heading', { name: /开始新的创作/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /新建项目/ })).toBeEnabled();
});

test('creates a project from startup and enters the workspace shell', async () => {
  const session = buildSession();
  const createProjectDeferred = createDeferred<ProjectSessionHandle>();
  const bridge = buildBridge({
    create_project: vi.fn().mockImplementation(() => createProjectDeferred.promise),
    get_project_session: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(session),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByRole('heading', { name: /开始新的创作/ })).toBeInTheDocument();

  await userEvent.setup().click(screen.getByRole('button', { name: /新建项目/ }));

  expect(screen.getByText(/正在创建项目/)).toBeInTheDocument();

  createProjectDeferred.resolve(buildHandle());

  await waitFor(() => {
    expect(screen.getByText(/phase zero/i)).toBeInTheDocument();
  });

  expect(screen.getByTestId('canvas-stage-host')).toBeInTheDocument();
  expect(screen.queryByText('/projects/phase-zero')).not.toBeInTheDocument();
  expect(screen.queryByText(/当前画布路径/)).not.toBeInTheDocument();
  expect(bridge.create_project).toHaveBeenCalledWith({ templateId: 'documentary' });
});

test('opens an existing project and lands in the workspace shell', async () => {
  const session = buildSession({
    sessionId: 'session-2',
    projectId: 'project-2',
    projectName: 'Existing Production',
    projectPath: '/projects/existing-production',
  });
  const openProjectDeferred = createDeferred<ProjectSessionHandle>();
  const bridge = buildBridge({
    open_project: vi.fn().mockImplementation(() => openProjectDeferred.promise),
    get_project_session: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(session),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByRole('heading', { name: /开始新的创作/ })).toBeInTheDocument();

  await userEvent.setup().click(screen.getByRole('button', { name: /打开项目/ }));

  expect(screen.getByText(/正在打开项目/)).toBeInTheDocument();

  openProjectDeferred.resolve(buildHandle({ sessionId: 'session-2' }));

  await waitFor(() => {
    expect(screen.getByText(/existing production/i)).toBeInTheDocument();
  });

  expect(screen.getByTestId('canvas-stage-host')).toBeInTheDocument();
  expect(screen.queryByText('/projects/existing-production')).not.toBeInTheDocument();
  expect(bridge.open_project).toHaveBeenCalledTimes(1);
});

test('loads the project media summary on workspace entry and refreshes the index when startup data is stale', async () => {
  const refreshDeferred = createDeferred<ProjectMediaIndexSummary>();
  const bridge = buildBridge({
    get_project_session: vi.fn().mockResolvedValue(buildSession()),
    get_project_media_index_summary: vi.fn().mockResolvedValue(
      buildMediaIndexSummary({
        assetCount: 0,
        lastIndexedAt: undefined,
      }),
    ),
    refresh_project_media_index: vi.fn().mockImplementation(() => refreshDeferred.promise),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByText(/phase zero/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(bridge.get_project_media_index_summary).toHaveBeenCalledWith({
      sessionId: 'session-1',
    });
  });

  await waitFor(() => {
    expect(bridge.refresh_project_media_index).toHaveBeenCalledWith({
      sessionId: 'session-1',
      reason: 'startup',
    });
  });

  expect(screen.getByText(/正在索引素材/)).toBeInTheDocument();

  refreshDeferred.resolve(
    buildMediaIndexSummary({
      assetCount: 2,
      imageCount: 1,
      documentCount: 1,
      readyThumbnailCount: 1,
      lastIndexedAt: '1710000100',
    }),
  );

  expect(await screen.findByText(/2 个素材/)).toBeInTheDocument();
  expect(screen.getByText(/1 个缩略图/)).toBeInTheDocument();
});

test('shows a media indexing error without breaking the canvas workspace', async () => {
  const bridge = buildBridge({
    get_project_session: vi.fn().mockResolvedValue(buildSession()),
    get_project_media_index_summary: vi
      .fn()
      .mockRejectedValue(new Error('Media index unavailable')),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByText(/phase zero/i)).toBeInTheDocument();
  expect(await screen.findByText(/无法获取素材索引/)).toBeInTheDocument();
  expect(screen.getByTestId('canvas-stage-host')).toBeInTheDocument();
});

test('renders a canvas host initialized from the active graph and shows breadcrumb navigation instead of graph switching', async () => {
  const session = buildSession({
    projectName: 'Atlas Project',
    activeGraph: buildGraph({
      id: 'graph-atlas',
      name: 'Atlas Storyboard',
      layerType: 'shot',
    }),
    availableGraphs: [
      buildGraph({
        id: 'graph-atlas',
        name: 'Atlas Storyboard',
        layerType: 'shot',
      }),
    ],
  });
  const bridge = buildBridge({
    get_project_session: vi.fn().mockResolvedValue(session),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByText(/atlas project/i)).toBeInTheDocument();
  expect(screen.getByTestId('canvas-stage-host')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', {
      name: /atlas project/i,
    }),
  ).toBeInTheDocument();
  expect(screen.queryByText('/projects/phase-zero')).not.toBeInTheDocument();
  expect(screen.queryByText(/画布路径/)).not.toBeInTheDocument();
  expect(screen.getAllByText(/镜头工作台/).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('navigation', { name: /画布层级路径/ })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: /可用画布/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/canvas placeholder/i)).not.toBeInTheDocument();
});

test('renders a compact workspace toolbar and hud while keeping redundant chrome out of the canvas', async () => {
  const bridge = buildBridge({
    get_project_session: vi.fn().mockResolvedValue(buildSession()),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByRole('heading', { name: /phase zero/i })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: /工作区工具条/ })).toBeInTheDocument();
  expect(screen.getByLabelText(/工作区状态条/)).toBeInTheDocument();
  expect(screen.getByTestId('canvas-stage-host')).toBeInTheDocument();
  expect(screen.queryByText('/projects/phase-zero')).not.toBeInTheDocument();
  expect(screen.queryByText(/^search$/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/^filter$/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/^export$/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/画布路径/)).not.toBeInTheDocument();
  expect(screen.queryByText(/当前画布路径/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^图谱$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^选中$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^缩放$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^媒体$/)).not.toBeInTheDocument();
  expect(screen.getByText(/^未选中内容$/)).toBeInTheDocument();
  expect(screen.getAllByText(/^100%$/i).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText(/^0 个素材$/)).toBeInTheDocument();
  expect(screen.queryByText(/^视图$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/x 0 · y 0/i)).not.toBeInTheDocument();
});

test('keeps graph loading state out of the center canvas while nodes are still loading', async () => {
  const listGraphNodesDeferred = createDeferred<ReturnType<typeof Promise.resolve<ReturnType<typeof buildNode>[]>> extends Promise<infer T> ? T : never>();
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
    }),
    list_graph_nodes: vi.fn().mockImplementation(() => listGraphNodesDeferred.promise),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  expect(await screen.findByRole('heading', { name: /phase zero/i })).toBeInTheDocument();
  expect(screen.queryByText(/正在加载图谱节点/)).not.toBeInTheDocument();
  expect(screen.getByText(/正在加载节点/)).toBeInTheDocument();

  await act(async () => {
    listGraphNodesDeferred.resolve([buildNode()]);
  });

  expect(await screen.findByRole('button', { name: /opening brief/i })).toBeInTheDocument();
});

test('renders breadcrumb navigation and activates an ancestor graph from the trail', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Root Story',
    layerType: 'story',
  });
  const detailGraph = buildGraph({
    id: 'graph-detail',
    name: 'Scene Detail',
    layerType: 'shot',
    isRoot: false,
  });
  const updatedSession = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(detailGraph, {
        sourceNodeId: 'node-brief',
        sourceNodeTitle: 'Campaign Brief',
      }),
    ],
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const bridge = buildBridge({
    get_project_session: vi.fn().mockResolvedValue(updatedSession),
    activate_graph: vi.fn().mockResolvedValue(rootSession),
  });

  render(<App bridge={bridge} />);

  expect(await screen.findByRole('navigation', { name: /画布层级路径/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /分镜层/ })).toBeInTheDocument();
  expect(screen.getAllByText(/campaign brief/i).length).toBeGreaterThanOrEqual(1);

  await userEvent.setup().click(screen.getByRole('button', { name: /分镜层/ }));

  await waitFor(() => {
    expect(bridge.activate_graph).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
    });
  });
});

test('loads graph nodes inside the workspace, renders them on the canvas, and updates the selection rail', async () => {
  const listGraphNodes = vi.fn().mockResolvedValue([
    buildNode(),
    buildNode({
      id: 'node-2',
      graphId: 'graph-root',
      title: 'Reference Pack',
      nodeType: 'reference',
      status: 'Linked',
      layout: {
        x: 220,
        y: 80,
        width: 280,
        height: 160,
      },
    }),
  ]);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
    }),
    list_graph_nodes: listGraphNodes,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  expect(await screen.findByText(/phase zero/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(listGraphNodes).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
    });
  });

  expect(await screen.findByRole('button', { name: /opening brief/i })).toBeInTheDocument();
  expect(screen.getByText(/reference pack/i)).toBeInTheDocument();
  expect(screen.getByText(/ready/i)).toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();

  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: /opening brief/i }));

  expect(screen.getByText(/已选中：opening brief/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /opening brief/i }));

  expect(screen.getByText(/已选中：opening brief/i)).toBeInTheDocument();
});

test('clears the selected node when the user clicks a blank part of the canvas', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
    }),
    list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  expect(await screen.findByRole('button', { name: /opening brief/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /opening brief/i }));
  expect(screen.getByText(/已选中：opening brief/i)).toBeInTheDocument();

  await user.click(screen.getByTestId('canvas-stage-host'));

  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();
});

test('double-clicks an eligible node to enter its child graph instead of opening the drawer', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Brief Canvas',
    layerType: 'brief',
  });
  const storyboardGraph = buildGraph({
    id: 'graph-storyboard',
    name: 'Storyboard Canvas',
    layerType: 'storyboard',
    isRoot: false,
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, storyboardGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const childSession = buildSession({
    activeGraph: storyboardGraph,
    availableGraphs: [rootGraph, storyboardGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(storyboardGraph, {
        sourceNodeId: 'node-brief',
        sourceNodeTitle: 'Campaign Brief',
      }),
    ],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(rootSession),
      list_graph_nodes: vi.fn().mockImplementation(({ graphId }: { graphId: string }) =>
        Promise.resolve(
          graphId === 'graph-root'
            ? [
                buildNode({
                  id: 'node-brief',
                  title: 'Campaign Brief',
                  nodeType: 'brief',
                  canEnterChildGraph: true,
                }),
              ]
            : [
                buildNode({
                  id: 'node-anchor',
                  graphId: 'graph-storyboard',
                  title: 'Brief Anchor',
                  nodeType: 'system_anchor',
                  isSystem: true,
                  canEnterChildGraph: false,
                  status: undefined,
                  layout: {
                    x: -220,
                    y: -260,
                    width: 420,
                    height: 96,
                  },
                }),
              ],
        ),
      ),
      open_node_child_graph: vi.fn().mockResolvedValue(childSession),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  const briefNode = await screen.findByRole('button', { name: /campaign brief/i });

  await user.dblClick(briefNode);

  await waitFor(() => {
    expect(bridge.open_node_child_graph).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-brief',
    });
  });

  expect(await screen.findByText(/brief anchor/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /需求层/ })).toBeInTheDocument();
  expect(screen.getAllByText(/campaign brief/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
});

test('single-clicks an eligible node to open the drawer immediately', async () => {
  const detailDeferred = createDeferred<GraphNodeDetail>();
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-brief',
          title: 'Campaign Brief',
          nodeType: 'brief',
          canEnterChildGraph: true,
        }),
      ]),
      get_graph_node_detail: vi.fn().mockImplementation(() => detailDeferred.promise),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /campaign brief/i }));

  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByText(/正在加载节点详情/)).toBeInTheDocument();
  expect(screen.getByText(/已选中：campaign brief/i)).toBeInTheDocument();

  detailDeferred.resolve(
    buildNodeDetail({
      id: 'node-brief',
      title: 'Campaign Brief',
      nodeType: 'brief',
    }),
  );

  expect(await screen.findByLabelText(/需求描述/)).toHaveValue('');
  expect(screen.queryByLabelText(/标题/)).not.toBeInTheDocument();
});

test('keeps the drawer open when the user clicks the same eligible node again', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-brief',
          title: 'Campaign Brief',
          nodeType: 'brief',
          canEnterChildGraph: true,
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          id: 'node-brief',
          title: 'Campaign Brief',
          nodeType: 'brief',
        }),
      ),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  const node = await screen.findByRole('button', { name: /campaign brief/i });

  await user.click(node);
  const drawer = await screen.findByTestId('graph-node-drawer');

  await user.click(node);

  expect(screen.getByTestId('graph-node-drawer')).toBe(drawer);
});

test('renders a system anchor without allowing selection or drawer open', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-anchor',
          title: 'Brief Anchor',
          nodeType: 'system_anchor',
          isSystem: true,
          status: undefined,
          layout: {
            x: -240,
            y: -240,
            width: 420,
            height: 96,
          },
        }),
      ]),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  await user.click(await screen.findByText(/brief anchor/i));

  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
});

test('restores the prior selected node for each graph when drilling down and returning via breadcrumb, and reuses cached node lists', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Root Story',
    layerType: 'story',
  });
  const detailGraph = buildGraph({
    id: 'graph-detail',
    name: 'Scene Detail',
    layerType: 'shot',
    isRoot: false,
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const detailSession = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(detailGraph, {
        sourceNodeId: 'node-root',
        sourceNodeTitle: 'Root Brief',
      }),
    ],
  });
  const listGraphNodes = vi.fn().mockImplementation(({ graphId }: { graphId: string }) => {
    if (graphId === 'graph-root') {
      return Promise.resolve([
        buildNode({
          id: 'node-root',
          title: 'Root Brief',
          nodeType: 'brief',
          canEnterChildGraph: true,
        }),
      ]);
    }

    return Promise.resolve([
      buildNode({
        id: 'node-detail',
        graphId: 'graph-detail',
        title: 'Shot Option',
        nodeType: 'still',
      }),
    ]);
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(rootSession),
      open_node_child_graph: vi.fn().mockResolvedValue(detailSession),
      activate_graph: vi.fn().mockResolvedValue(rootSession),
      get_graph_node_detail: vi.fn().mockImplementation(({ nodeId }: { nodeId: string }) =>
        Promise.resolve(
          nodeId === 'node-root'
            ? buildNodeDetail({
                id: 'node-root',
                title: 'Root Brief',
                nodeType: 'brief',
              })
            : buildNodeDetail({
                id: 'node-detail',
                graphId: 'graph-detail',
                title: 'Shot Option',
                nodeType: 'still',
                status: undefined,
              }),
        ),
      ),
      update_graph_node_payload: vi.fn().mockImplementation(
        ({
          graphId,
          nodeId,
          payload,
        }: {
          graphId: string;
          nodeId: string;
          payload: Record<string, unknown>;
        }) =>
          Promise.resolve(
            buildNodeDetail({
              id: nodeId,
              graphId,
              title:
                typeof payload.title === 'string'
                  ? payload.title
                  : nodeId === 'node-detail'
                    ? 'Shot Option'
                    : 'Root Brief',
              nodeType: nodeId === 'node-detail' ? 'still' : 'brief',
              status:
                typeof payload.status === 'string'
                  ? payload.status
                  : nodeId === 'node-detail'
                    ? 'Pending'
                    : 'Ready',
              payload,
            }),
          ),
      ),
    }),
    list_graph_nodes: listGraphNodes,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  expect(await screen.findByRole('button', { name: /root brief/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /root brief/i }));
  expect(await screen.findByText(/已选中：root brief/i)).toBeInTheDocument();

  await user.dblClick(screen.getByRole('button', { name: /root brief/i }));

  expect(await screen.findByRole('button', { name: /shot option/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /shot option/i }));
  expect(screen.getByText(/已选中：shot option/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /分镜层/ }));

  expect(await screen.findByText(/已选中：root brief/i)).toBeInTheDocument();
  expect(bridge.open_node_child_graph).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-root',
  });
  expect(listGraphNodes).toHaveBeenCalledTimes(2);
  expect(listGraphNodes).toHaveBeenNthCalledWith(1, {
    sessionId: 'session-1',
    graphId: 'graph-root',
  });
  expect(listGraphNodes).toHaveBeenNthCalledWith(2, {
    sessionId: 'session-1',
    graphId: 'graph-detail',
  });
});

test('retries graph nodes, edges, and relation types when returning to a graph whose prior load was cancelled', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Brief Canvas',
    layerType: 'brief',
  });
  const detailGraph = buildGraph({
    id: 'graph-shot-lab',
    name: 'Shot Lab',
    layerType: 'shot_lab',
    isRoot: false,
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const detailSession = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(detailGraph, {
        sourceNodeId: 'node-brief',
        sourceNodeTitle: 'Campaign Brief',
      }),
    ],
  });
  const detailNodes = createDeferred<Array<ReturnType<typeof buildNode>>>();
  const detailEdges = createDeferred<GraphEdgeSummary[]>();
  const detailRelationTypes = createDeferred<GraphRelationTypeOption[]>();
  const listGraphNodes = vi.fn().mockImplementation(({ graphId }: { graphId: string }) => {
    if (graphId === 'graph-shot-lab') {
      return detailNodes.promise;
    }

    return Promise.resolve([
      buildNode({
        id: 'node-brief',
        title: 'Campaign Brief',
        nodeType: 'brief',
        canEnterChildGraph: true,
        graphId,
      }),
    ]);
  });
  const listGraphEdges = vi.fn().mockImplementation(({ graphId }: { graphId: string }) => {
    if (graphId === 'graph-shot-lab') {
      return detailEdges.promise;
    }

    return Promise.resolve([]);
  });
  const listGraphRelationTypeOptions = vi.fn().mockImplementation(({ graphId }: { graphId: string }) => {
    if (graphId === 'graph-shot-lab') {
      return detailRelationTypes.promise;
    }

    return Promise.resolve([buildRelationTypeOption()]);
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(rootSession),
      open_node_child_graph: vi.fn().mockResolvedValue(detailSession),
      activate_graph: vi.fn().mockResolvedValue(rootSession),
    }),
    list_graph_nodes: listGraphNodes,
    list_graph_edges: listGraphEdges,
    list_graph_relation_type_options: listGraphRelationTypeOptions,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  await user.dblClick(await screen.findByTestId('producer-node-node-brief'));

  await waitFor(() => {
    expect(bridge.open_node_child_graph).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-brief',
    });
  });
  await waitFor(() => {
    expect(listGraphNodes).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-shot-lab',
    });
    expect(listGraphEdges).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-shot-lab',
    });
    expect(listGraphRelationTypeOptions).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-shot-lab',
    });
  });

  await user.click(await screen.findByRole('button', { name: /需求层/i }));

  await waitFor(() => {
    expect(bridge.activate_graph).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
    });
  });

  await user.dblClick(await screen.findByTestId('producer-node-node-brief'));

  await waitFor(() => {
    expect(bridge.open_node_child_graph).toHaveBeenCalledTimes(2);
  });

  expect(listGraphNodes.mock.calls.filter(([payload]) => payload.graphId === 'graph-shot-lab')).toHaveLength(2);
  expect(listGraphEdges.mock.calls.filter(([payload]) => payload.graphId === 'graph-shot-lab')).toHaveLength(2);
  expect(
    listGraphRelationTypeOptions.mock.calls.filter(([payload]) => payload.graphId === 'graph-shot-lab'),
  ).toHaveLength(2);
});

test('shows an empty-state overlay when the active graph has no nodes', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
    }),
    list_graph_nodes: vi.fn().mockResolvedValue([]),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  expect(await screen.findByText(/空画布/)).toBeInTheDocument();
  expect(screen.getByText(/当前画布还没有节点/)).toBeInTheDocument();
  expect(screen.getByText(/按 tab 创建第一个节点/i)).toBeInTheDocument();
  expect(screen.getByTestId('producer-placeholder-node')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /创建节点/ })).toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();
  expect(screen.getByText(/^0 个素材$/)).toBeInTheDocument();
  expect(screen.queryByText(/图谱状态/)).not.toBeInTheDocument();
});

test('opens quick add from the empty-state create node action', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([]),
      list_graph_node_type_options: vi.fn().mockResolvedValue([buildNodeTypeOption()]),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  await screen.findByText(/当前画布还没有节点/);
  await user.click(screen.getByRole('button', { name: /创建节点/ }));

  const quickAddDialog = await screen.findByRole('dialog', { name: /节点快速创建器/ });

  expect(quickAddDialog).toBeInTheDocument();
  expect(quickAddDialog).toHaveStyle({ zIndex: '4' });
});

test('surfaces graph node loading failures inside the workspace without leaving the canvas shell', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
    }),
    list_graph_nodes: vi.fn().mockRejectedValue(new Error('Graph node index is unavailable')),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  expect((await screen.findAllByText(/无法加载节点索引/)).length).toBeGreaterThan(0);
  expect(screen.getByText(/phase zero/i)).toBeInTheDocument();
  expect(screen.getByTestId('canvas-stage-host')).toBeInTheDocument();
});

test('opens the drawer in a loading state and then renders node detail content', async () => {
  const detailDeferred = createDeferred<GraphNodeDetail>();
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockImplementation(() => detailDeferred.promise),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByText(/正在加载节点详情/)).toBeInTheDocument();
  expect(bridge.get_graph_node_detail).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
  });

  detailDeferred.resolve(
    buildNodeDetail({
      payload: {
        title: 'Opening Brief',
        status: 'Ready',
        description: 'All-terrain sneaker\nOwn the first five seconds',
      },
      assetBindings: [],
      assetRoleOptions: [
        { role: 'product_image', label: 'Product Image' },
        { role: 'example_video', label: 'Example Video' },
      ],
    }),
  );

  expect(await screen.findByLabelText(/需求描述/)).toHaveValue(
    'All-terrain sneaker\nOwn the first five seconds',
  );
  expect(screen.getByRole('heading', { name: '产品图' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '示例视频' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/标题/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^附件$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^关系$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^其他字段$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/已保存到本地/)).not.toBeInTheDocument();
});

test('keeps the drawer mounted while switching selected nodes and swaps the detail content', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-1',
          title: 'Opening Brief',
        }),
        buildNode({
          id: 'node-2',
          title: 'Reference Pack',
          nodeType: 'reference',
          status: 'Linked',
          layout: {
            x: 220,
            y: 80,
            width: 280,
            height: 160,
          },
        }),
      ]),
      get_graph_node_detail: vi.fn().mockImplementation(({ nodeId }: { nodeId: string }) =>
        Promise.resolve(
          nodeId === 'node-1'
            ? buildNodeDetail({
                id: 'node-1',
                title: 'Opening Brief',
                payload: {
                  title: 'Opening Brief',
                  status: 'Ready',
                  description: 'Trail shoe',
                },
              })
            : buildNodeDetail({
                id: 'node-2',
                title: 'Reference Pack',
                nodeType: 'reference',
                status: 'Linked',
                product: undefined,
                objective: undefined,
                audience: undefined,
                key_message: undefined,
                render_meta: undefined,
                tags: undefined,
                reference_type: 'image',
                source: 'https://example.com/reference',
                excerpt: 'Night city framing',
              }),
        ),
      ),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(await screen.findByDisplayValue(/trail shoe/i)).toBeInTheDocument();
  const drawer = screen.getByTestId('graph-node-drawer');

  await user.click(screen.getByRole('button', { name: /reference pack/i }));

  expect(screen.getByTestId('graph-node-drawer')).toBe(drawer);
  expect(await screen.findByDisplayValue(/https:\/\/example.com\/reference/i)).toBeInTheDocument();
  expect(screen.queryByDisplayValue(/trail shoe/i)).not.toBeInTheDocument();
});

test('clears the selection and closes the drawer on blank click and Escape', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();

  await user.click(screen.getByTestId('canvas-stage-host'));
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /opening brief/i }));
  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();

  await user.keyboard('{Escape}');
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();
});

test('deletes the selected node on Delete and clears the drawer and selection hud', async () => {
  const deleteGraphNode = vi.fn().mockResolvedValue({
    graphId: 'graph-root',
    nodeId: 'node-1',
    deletedGraphIds: [],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
    delete_graph_node: deleteGraphNode,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Delete' });

  await waitFor(() => {
    expect(deleteGraphNode).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
    });
  });

  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /opening brief/i })).not.toBeInTheDocument();
  });
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();
});

test('deletes the selected node on Backspace when focus is outside editable controls', async () => {
  const deleteGraphNode = vi.fn().mockResolvedValue({
    graphId: 'graph-root',
    nodeId: 'node-1',
    deletedGraphIds: [],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
    delete_graph_node: deleteGraphNode,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Backspace' });

  await waitFor(() => {
    expect(deleteGraphNode).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
    });
  });
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();
});

test('deletes the selected node when the focused canvas node receives Backspace', async () => {
  const deleteGraphNode = vi.fn().mockResolvedValue({
    graphId: 'graph-root',
    nodeId: 'node-1',
    deletedGraphIds: [],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
    delete_graph_node: deleteGraphNode,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  const nodeButton = await screen.findByRole('button', { name: /opening brief/i });

  await user.click(nodeButton);
  expect(nodeButton).toHaveFocus();

  await user.keyboard('{Backspace}');

  await waitFor(() => {
    expect(deleteGraphNode).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
    });
  });
});

test('does not delete the selected node when Delete or Backspace is pressed inside editable drawer controls', async () => {
  const deleteGraphNode = vi.fn();
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-prompt',
          title: 'Prompt A',
          nodeType: 'prompt',
          status: 'Draft',
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          id: 'node-prompt',
          title: 'Prompt A',
          nodeType: 'prompt',
          status: 'Draft',
          payload: {
            title: 'Prompt A',
            status: 'Draft',
            prompt_text: 'Hero shoe on reflective floor',
            negative_prompt: 'blurry frame',
          },
        }),
      ),
    }),
    delete_graph_node: deleteGraphNode,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /prompt a/i }));

  const titleInput = await screen.findByLabelText(/标题/);
  const assetSearchInput = screen.getByLabelText(/搜索素材/);
  const relationTypeSelect = screen.getByLabelText(/关系类型/);

  titleInput.focus();
  fireEvent.keyDown(titleInput, { key: 'Backspace', bubbles: true });
  assetSearchInput.focus();
  fireEvent.keyDown(assetSearchInput, { key: 'Delete', bubbles: true });
  relationTypeSelect.focus();
  fireEvent.keyDown(relationTypeSelect, { key: 'Delete', bubbles: true });

  expect(deleteGraphNode).not.toHaveBeenCalled();
  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /prompt a/i })).toBeInTheDocument();
});

test('preserves drafts across drawer close, node switching, and graph switching within a session', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Root Story',
    layerType: 'story',
  });
  const detailGraph = buildGraph({
    id: 'graph-detail',
    name: 'Scene Detail',
    layerType: 'shot',
    isRoot: false,
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const detailSession = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(detailGraph, {
        sourceNodeId: 'node-root',
        sourceNodeTitle: 'Root Brief',
      }),
    ],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(rootSession),
      open_node_child_graph: vi.fn().mockResolvedValue(detailSession),
      activate_graph: vi.fn().mockResolvedValue(rootSession),
      list_graph_nodes: vi.fn().mockImplementation(({ graphId }: { graphId: string }) =>
        Promise.resolve(
          graphId === 'graph-root'
            ? [
                buildNode({
                  id: 'node-root',
                  title: 'Root Brief',
                  canEnterChildGraph: true,
                }),
                buildNode({
                  id: 'node-root-2',
                  title: 'Secondary Brief',
                  layout: {
                    x: 220,
                    y: 60,
                    width: 280,
                    height: 160,
                  },
                }),
              ]
            : [
                buildNode({
                  id: 'node-detail',
                  graphId: 'graph-detail',
                  title: 'Shot Option',
                  nodeType: 'still',
                  status: 'Pending',
                }),
              ],
        ),
      ),
      get_graph_node_detail: vi.fn().mockImplementation(({ nodeId }: { nodeId: string }) => {
        if (nodeId === 'node-root') {
          return Promise.resolve(
            buildNodeDetail({
              id: 'node-root',
              title: 'Root Brief',
              payload: {
                title: 'Root Brief',
                status: 'Ready',
                description: 'Trail shoe',
              },
            }),
          );
        }

        if (nodeId === 'node-root-2') {
          return Promise.resolve(
            buildNodeDetail({
              id: 'node-root-2',
              title: 'Secondary Brief',
              payload: {
                title: 'Secondary Brief',
                status: 'Ready',
                description: 'Archive brief',
              },
            }),
          );
        }

        return Promise.resolve(
          buildNodeDetail({
            id: 'node-detail',
            graphId: 'graph-detail',
            title: 'Shot Option',
            nodeType: 'still',
            status: 'Pending',
            selection_reason: 'Most dynamic composition',
          }),
        );
      }),
      update_graph_node_payload: vi.fn().mockImplementation(
        ({
          graphId,
          nodeId,
          payload,
        }: {
          graphId: string;
          nodeId: string;
          payload: Record<string, unknown>;
        }) =>
          Promise.resolve(
            buildNodeDetail({
              id: nodeId,
              graphId,
              title:
                typeof payload.title === 'string'
                  ? payload.title
                  : nodeId === 'node-detail'
                    ? 'Shot Option'
                    : nodeId === 'node-root-2'
                      ? 'Secondary Brief'
                      : 'Root Brief',
              nodeType: nodeId === 'node-detail' ? 'still' : 'brief',
              status:
                typeof payload.status === 'string'
                  ? payload.status
                  : nodeId === 'node-detail'
                    ? 'Pending'
                    : 'Ready',
              payload,
            }),
          ),
      ),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: /root brief/i }));
  const descriptionInput = await screen.findByLabelText(/需求描述/);
  fireEvent.change(descriptionInput, { target: { value: 'Root Brief Draft' } });
  await waitFor(() => {
    expect(screen.getByDisplayValue(/root brief draft/i)).toBeInTheDocument();
  });

  await user.click(screen.getByTestId('canvas-stage-host'));
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();

  await user.click(await screen.findByRole('button', { name: /root brief draft/i }));
  expect(await screen.findByDisplayValue(/root brief draft/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /secondary brief/i }));
  expect(await screen.findByDisplayValue(/archive brief/i)).toBeInTheDocument();

  await user.click(await screen.findByRole('button', { name: /root brief draft/i }));
  expect(await screen.findByDisplayValue(/root brief draft/i)).toBeInTheDocument();

  await user.dblClick(await screen.findByRole('button', { name: /root brief draft/i }));
  await user.click(await screen.findByRole('button', { name: /shot option/i }));
  const detailTitleInput = await screen.findByLabelText(/标题/);
  fireEvent.change(detailTitleInput, { target: { value: 'Shot Option Draft' } });
  await waitFor(() => {
    expect(screen.getByDisplayValue(/shot option draft/i)).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /分镜层/ }));
  expect(await screen.findByDisplayValue(/root brief draft/i)).toBeInTheDocument();

  await user.dblClick(await screen.findByRole('button', { name: /root brief draft/i }));
  expect(await screen.findByDisplayValue(/shot option draft/i)).toBeInTheDocument();
});

test('debounce-saves drawer edits, projects title and decision immediately, and updates the drawer footer state', async () => {
  const saveDeferred = createDeferred<GraphNodeDetail>();
  const updateGraphNodePayload = vi.fn().mockImplementation(() => saveDeferred.promise);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
          decision: 'Pending',
          feedback: 'Needs stronger product focus.',
        }),
      ),
    }),
    update_graph_node_payload: updateGraphNodePayload,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /review outcome/i }));

  const titleInput = await screen.findByLabelText(/标题/);
  const decisionInput = screen.getByLabelText(/结论/);
  expect(screen.getByText(/已保存到本地/)).toBeInTheDocument();

  vi.useFakeTimers();

  fireEvent.change(titleInput, {
    target: { value: 'Approved Review' },
  });
  fireEvent.change(decisionInput, {
    target: { value: 'Approved' },
  });

  expect(screen.getByRole('button', { name: /approved review/i })).toBeInTheDocument();
  expect(screen.getAllByText(/^approved$/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(/已选中：approved review/i)).toBeInTheDocument();
  expect(screen.getByText(/正在保存到本地/)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(299);
  });

  expect(updateGraphNodePayload).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });

  expect(updateGraphNodePayload).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-review',
    payload: expect.objectContaining({
      title: 'Approved Review',
      decision: 'Approved',
      feedback: 'Needs stronger product focus.',
    }),
  });

  saveDeferred.resolve(
    buildNodeDetail({
      id: 'node-review',
      title: 'Approved Review',
      nodeType: 'review',
      status: undefined,
      decision: 'Approved',
      feedback: 'Needs stronger product focus.',
    }),
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText(/已保存到本地/)).toBeInTheDocument();

  vi.useRealTimers();
});

test('shows a save error in the drawer footer when the latest debounced payload save fails', async () => {
  const updateGraphNodePayload = vi.fn().mockRejectedValue(new Error('Could not save node payload'));
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
          payload: {
            title: 'Review Outcome',
            decision: 'Pending',
            feedback: 'Needs stronger product focus.',
          },
        }),
      ),
    }),
    update_graph_node_payload: updateGraphNodePayload,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /review outcome/i }));

  const titleInput = await screen.findByLabelText(/标题/);

  vi.useFakeTimers();

  fireEvent.change(titleInput, {
    target: { value: 'Review Outcome Draft' },
  });

  expect(screen.getByText(/正在保存到本地/)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(updateGraphNodePayload).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-review',
    payload: expect.objectContaining({
      title: 'Review Outcome Draft',
    }),
  });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText(/无法保存到本地/)).toBeInTheDocument();

  vi.useRealTimers();
});

test('ignores an in-flight payload save response after the selected node is deleted', async () => {
  const saveDeferred = createDeferred<GraphNodeDetail>();
  const updateGraphNodePayload = vi.fn().mockImplementation(() => saveDeferred.promise);
  const deleteGraphNode = vi.fn().mockResolvedValue({
    graphId: 'graph-root',
    nodeId: 'node-review',
    deletedGraphIds: [],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
          payload: {
            title: 'Review Outcome',
            decision: 'Pending',
            feedback: 'Needs stronger product focus.',
          },
        }),
      ),
    }),
    update_graph_node_payload: updateGraphNodePayload,
    delete_graph_node: deleteGraphNode,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /review outcome/i }));

  const titleInput = await screen.findByLabelText(/标题/);

  vi.useFakeTimers();

  fireEvent.change(titleInput, {
    target: { value: 'Review Outcome Draft' },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(updateGraphNodePayload).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-review',
    payload: expect.objectContaining({
      title: 'Review Outcome Draft',
    }),
  });

  fireEvent.keyDown(window, { key: 'Delete' });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(deleteGraphNode).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-review',
  });

  saveDeferred.resolve(
    buildNodeDetail({
      id: 'node-review',
      title: 'Review Outcome Draft',
      nodeType: 'review',
      status: undefined,
      payload: {
        title: 'Review Outcome Draft',
        decision: 'Pending',
        feedback: 'Needs stronger product focus.',
      },
    }),
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(screen.queryByRole('button', { name: /review outcome draft/i })).not.toBeInTheDocument();
  expect(screen.queryByTestId('graph-node-drawer')).not.toBeInTheDocument();
  expect(screen.getByText(/未选中内容/)).toBeInTheDocument();

  vi.useRealTimers();
});

nodeDragInteractionTest('drags a node with optimistic preview and commits the final position once on release', async () => {
  (window as Window & { __PRODUCER_ENABLE_NODE_DRAG__?: boolean }).__PRODUCER_ENABLE_NODE_DRAG__ =
    true;
  const updateGraphNodePosition = vi.fn().mockResolvedValue(
    buildNode({
      id: 'node-1',
      title: 'Opening Brief',
      layout: {
        x: -140,
        y: -78,
        width: 188,
        height: 118,
      },
    }),
  );
  const updateGraphNodePayload = vi.fn().mockResolvedValue(buildNodeDetail());
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
    }),
    update_graph_node_position: updateGraphNodePosition,
    update_graph_node_payload: updateGraphNodePayload,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const nodeButton = await screen.findByRole('button', { name: /opening brief/i });
  const nodeWrapper = screen.getByTestId('rf__node-node-1');
  await screen.findByTestId('canvas-stage-host');

  expect(nodeButton).toHaveAttribute('data-node-world-x', '-180');
  expect(nodeButton).toHaveAttribute('data-node-world-y', '-110');

  await act(async () => {
    fireEvent.mouseDown(nodeWrapper, { button: 0, buttons: 1, clientX: 554, clientY: 309 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 594, clientY: 341 });
  });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /opening brief/i })).toHaveAttribute(
      'data-node-world-x',
      '-140',
    );
    expect(screen.getByRole('button', { name: /opening brief/i })).toHaveAttribute(
      'data-node-world-y',
      '-78',
    );
  });

  await act(async () => {
    fireEvent.mouseUp(window, { clientX: 594, clientY: 341 });
  });

  await waitFor(() => {
    expect(updateGraphNodePosition).toHaveBeenCalledTimes(1);
  });
  expect(updateGraphNodePosition).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
    position: {
      x: -140,
      y: -78,
    },
  });
  expect(updateGraphNodePayload).not.toHaveBeenCalled();
});

nodeDragInteractionTest('reverts an optimistic node drag when position persistence fails', async () => {
  (window as Window & { __PRODUCER_ENABLE_NODE_DRAG__?: boolean }).__PRODUCER_ENABLE_NODE_DRAG__ =
    true;
  const updateGraphNodePosition = vi.fn().mockRejectedValue(new Error('Could not save node position'));
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
    }),
    update_graph_node_position: updateGraphNodePosition,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const nodeButton = await screen.findByRole('button', { name: /opening brief/i });
  const nodeWrapper = screen.getByTestId('rf__node-node-1');
  await screen.findByTestId('canvas-stage-host');

  await act(async () => {
    fireEvent.mouseDown(nodeWrapper, { button: 0, buttons: 1, clientX: 554, clientY: 309 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 594, clientY: 341 });
  });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /opening brief/i })).toHaveAttribute(
      'data-node-world-x',
      '-140',
    );
    expect(screen.getByRole('button', { name: /opening brief/i })).toHaveAttribute(
      'data-node-world-y',
      '-78',
    );
  });

  await act(async () => {
    fireEvent.mouseUp(window, { clientX: 594, clientY: 341 });
  });

  await waitFor(() => {
    expect(updateGraphNodePosition).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(nodeButton).toHaveAttribute('data-node-world-x', '-180');
    expect(nodeButton).toHaveAttribute('data-node-world-y', '-110');
  });
  expect(await screen.findByText(/无法保存到本地/)).toBeInTheDocument();
});

test('binds an indexed asset from the drawer and shows the attachment preview', async () => {
  const previewAsset = buildAssetSummary({
    id: 'asset-preview',
    relativePath: 'images/preview-frame.png',
    filePath: '/projects/phase-zero/assets/images/preview-frame.png',
    thumbnailPath: '/projects/phase-zero/.producer/thumbnails/asset-preview/card.png',
  });
  const bindNodeAsset = vi.fn().mockResolvedValue({
    ...buildNodeDetail({
      id: 'node-still',
      title: 'Hero Still',
      nodeType: 'still',
      status: 'Candidate',
      selection_reason: 'Most usable composition',
    }),
    assetBindings: [
      {
        assetId: previewAsset.id,
        role: 'preview',
        asset: previewAsset,
      },
    ],
    assetRoleOptions: [
      { role: 'reference', label: 'Reference' },
      { role: 'preview', label: 'Preview' },
      { role: 'output', label: 'Output' },
    ],
  });
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-still',
          title: 'Hero Still',
          nodeType: 'still',
          status: 'Candidate',
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue({
        ...buildNodeDetail({
          id: 'node-still',
          title: 'Hero Still',
          nodeType: 'still',
          status: 'Candidate',
          selection_reason: 'Most usable composition',
        }),
        assetBindings: [],
        assetRoleOptions: [
          { role: 'reference', label: 'Reference' },
          { role: 'preview', label: 'Preview' },
          { role: 'output', label: 'Output' },
        ],
      }),
      list_project_assets: vi.fn().mockResolvedValue([previewAsset]),
    }),
    bind_node_asset: bindNodeAsset,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /hero still/i }));

  expect(await screen.findByText(/^附件$/)).toBeInTheDocument();
  expect(screen.getByText(/当前还没有绑定附件/)).toBeInTheDocument();

  await user.type(screen.getByLabelText(/搜索素材/), 'preview');
  expect(bridge.list_project_assets).toHaveBeenCalledWith({
    sessionId: 'session-1',
    query: 'preview',
    limit: 20,
  });

  await user.selectOptions(screen.getByLabelText(/附件角色/), 'preview');
  await user.click(await screen.findByRole('button', { name: /绑定 preview-frame\.png/i }));

  expect(bindNodeAsset).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-still',
    assetId: 'asset-preview',
    role: 'preview',
  });

  expect(await screen.findByText(/images\/preview-frame\.png/i)).toBeInTheDocument();
  expect(screen.getAllByText(/^预览$/).length).toBeGreaterThan(0);
  expect(screen.getByRole('img', { name: /hero still附件预览/i })).toBeInTheDocument();
});

test('brief drawer derives the hidden title from description edits and filters media search by slot', async () => {
  const updateGraphNodePayload = vi.fn().mockResolvedValue(
    buildNodeDetail({
      title: 'Hero launch concept',
      payload: {
        title: 'Hero launch concept',
        status: 'Ready',
        description: 'Hero launch concept',
      },
      assetRoleOptions: [
        { role: 'product_image', label: 'Product Image' },
        { role: 'example_video', label: 'Example Video' },
      ],
    }),
  );
  const listProjectAssets = vi.fn().mockResolvedValue([]);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          payload: {
            title: 'Opening Brief',
            status: 'Ready',
            description: 'Existing launch direction',
          },
          assetBindings: [],
          assetRoleOptions: [
            { role: 'product_image', label: 'Product Image' },
            { role: 'example_video', label: 'Example Video' },
          ],
        }),
      ),
      list_project_assets: listProjectAssets,
    }),
    update_graph_node_payload: updateGraphNodePayload,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(screen.queryByLabelText(/标题/)).not.toBeInTheDocument();
  const descriptionInput = await screen.findByLabelText(/需求描述/);

  vi.useFakeTimers();

  fireEvent.change(descriptionInput, {
    target: {
      value: 'Hero launch concept',
    },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(updateGraphNodePayload).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
    payload: expect.objectContaining({
      title: 'Hero launch concept',
      description: 'Hero launch concept',
    }),
  });
  expect(screen.getByRole('button', { name: /hero launch concept/i })).toBeInTheDocument();
  vi.useRealTimers();

  fireEvent.change(screen.getByLabelText(/搜索产品图素材/), {
    target: { value: 'hero' },
  });

  await waitFor(() => {
    expect(listProjectAssets).toHaveBeenCalledWith({
      sessionId: 'session-1',
      query: 'hero',
      limit: 20,
      mediaType: 'image',
    });
  });

  fireEvent.change(screen.getByLabelText(/搜索示例视频素材/), {
    target: { value: 'teaser' },
  });

  await waitFor(() => {
    expect(listProjectAssets).toHaveBeenCalledWith({
      sessionId: 'session-1',
      query: 'teaser',
      limit: 20,
      mediaType: 'video',
    });
  });
});

test('brief drawer synthesizes description from legacy payload fields', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          payload: {
            title: 'Opening Brief',
            status: 'Ready',
            product: 'Trail shoe',
            objective: 'Launch a social teaser',
            audience: 'Urban runners',
            key_message: 'Grip for every surface',
            constraints: 'Keep the framing minimal',
            tone: 'Confident',
          },
          assetBindings: [],
          assetRoleOptions: [
            { role: 'product_image', label: 'Product Image' },
            { role: 'example_video', label: 'Example Video' },
          ],
        }),
      ),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  const descriptionInput = await screen.findByLabelText(/需求描述/);
  const descriptionValue = (descriptionInput as HTMLTextAreaElement).value;

  expect(descriptionValue).toContain('产品：Trail shoe');
  expect(descriptionValue).toContain('目标：Launch a social teaser');
  expect(descriptionValue).toContain('目标受众：Urban runners');
  expect(descriptionValue).toContain('核心信息：Grip for every surface');
  expect(screen.queryByLabelText(/^产品$/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^目标$/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^目标受众$/)).not.toBeInTheDocument();
});

test('brief media slots bind with their dedicated role and replace an existing slot binding', async () => {
  const unbindNodeAsset = vi.fn().mockResolvedValue(
    buildNodeDetail({
      assetBindings: [],
      assetRoleOptions: [
        { role: 'product_image', label: 'Product Image' },
        { role: 'example_video', label: 'Example Video' },
      ],
      payload: {
        title: 'Opening Brief',
        status: 'Ready',
        description: 'Existing launch direction',
      },
    }),
  );
  const bindNodeAsset = vi.fn().mockResolvedValue(
    buildNodeDetail({
      assetBindings: [
        {
          assetId: 'asset-image-next',
          role: 'product_image',
          asset: {
            id: 'asset-image-next',
            mediaType: 'image',
            relativePath: 'refs/new-hero.png',
            detail: '1280 x 720 PNG',
            missing: false,
            status: 'ready',
          },
        },
      ],
      assetRoleOptions: [
        { role: 'product_image', label: 'Product Image' },
        { role: 'example_video', label: 'Example Video' },
      ],
      payload: {
        title: 'Opening Brief',
        status: 'Ready',
        description: 'Existing launch direction',
      },
    }),
  );
  const listProjectAssets = vi.fn().mockResolvedValue([
    {
      id: 'asset-image-next',
      title: 'New hero still',
      mediaType: 'image',
      status: 'ready',
      detail: '1280 x 720 PNG',
    },
  ]);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          assetBindings: [
            {
              assetId: 'asset-image-current',
              role: 'product_image',
              asset: {
                id: 'asset-image-current',
                mediaType: 'image',
                relativePath: 'refs/current-hero.png',
                detail: '960 x 540 PNG',
                missing: false,
                status: 'ready',
              },
            },
          ],
          assetRoleOptions: [
            { role: 'product_image', label: 'Product Image' },
            { role: 'example_video', label: 'Example Video' },
          ],
          payload: {
            title: 'Opening Brief',
            status: 'Ready',
            description: 'Existing launch direction',
          },
        }),
      ),
      list_project_assets: listProjectAssets,
    }),
    bind_node_asset: bindNodeAsset,
    unbind_node_asset: unbindNodeAsset,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  fireEvent.change(await screen.findByLabelText(/搜索产品图素材/), {
    target: { value: 'hero' },
  });

  await waitFor(() => {
    expect(listProjectAssets).toHaveBeenCalledWith({
      sessionId: 'session-1',
      query: 'hero',
      limit: 20,
      mediaType: 'image',
    });
  });

  await user.click(screen.getByRole('button', { name: /绑定 new hero still/i }));

  await waitFor(() => {
    expect(unbindNodeAsset).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
      assetId: 'asset-image-current',
      role: 'product_image',
    });
  });
  expect(bindNodeAsset).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
    assetId: 'asset-image-next',
    role: 'product_image',
  });
});

test('creates and deletes relations from the drawer and updates the edge overlay', async () => {
  const createGraphEdge = vi.fn().mockResolvedValue(
    buildEdgeSummary({
      id: 'edge-created',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
      edgeType: 'references',
    }),
  );
  const deleteGraphEdge = vi.fn().mockResolvedValue(undefined);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-1',
          title: 'Prompt A',
          nodeType: 'prompt',
          status: 'Draft',
          layout: {
            x: -160,
            y: -80,
            width: 224,
            height: 124,
          },
        }),
        buildNode({
          id: 'node-2',
          title: 'Reference B',
          nodeType: 'reference',
          status: 'Linked',
          layout: {
            x: 200,
            y: 20,
            width: 224,
            height: 124,
          },
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue({
        ...buildNodeDetail({
          id: 'node-1',
          title: 'Prompt A',
          nodeType: 'prompt',
          status: 'Draft',
          prompt_text: 'Hero shoe on reflective floor',
        }),
        assetBindings: [],
        assetRoleOptions: [{ role: 'reference', label: 'Reference' }],
      }),
      list_graph_edges: vi.fn().mockResolvedValue([]),
      list_graph_relation_type_options: vi.fn().mockResolvedValue([
        buildRelationTypeOption({
          edgeType: 'references',
          label: 'References',
        }),
      ]),
    }),
    create_graph_edge: createGraphEdge,
    delete_graph_edge: deleteGraphEdge,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /prompt a/i }));

  expect(await screen.findByText(/^关系$/)).toBeInTheDocument();
  expect(screen.getAllByText(/当前节点还没有关系/).length).toBeGreaterThan(0);

  await user.selectOptions(screen.getByLabelText(/关系类型/), 'references');
  await user.selectOptions(screen.getByLabelText(/目标节点/), 'node-2');
  await user.click(screen.getByRole('button', { name: /添加关系/ }));

  expect(createGraphEdge).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    edgeType: 'references',
  });

  expect(await screen.findByText(/参考 → reference b/i)).toBeInTheDocument();
  expect(screen.getByTestId('rf__wrapper').querySelector('.react-flow__edges')).not.toBeNull();

  await user.click(screen.getByRole('button', { name: /删除关系 edge-created：参考 → reference b/i }));
  expect(deleteGraphEdge).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-root',
    edgeId: 'edge-created',
  });
});

test('keeps the latest payload save result when older responses resolve out of order', async () => {
  const firstSave = createDeferred<GraphNodeDetail>();
  const secondSave = createDeferred<GraphNodeDetail>();
  const updateGraphNodePayload = vi
    .fn()
    .mockImplementationOnce(() => firstSave.promise)
    .mockImplementationOnce(() => secondSave.promise);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([
        buildNode({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
        }),
      ]),
      get_graph_node_detail: vi.fn().mockResolvedValue(
        buildNodeDetail({
          id: 'node-review',
          title: 'Review Outcome',
          nodeType: 'review',
          status: undefined,
          payload: {
            title: 'Review Outcome',
            decision: 'Pending',
            feedback: 'Needs stronger product focus.',
          },
        }),
      ),
    }),
    update_graph_node_payload: updateGraphNodePayload,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /review outcome/i }));

  const titleInput = await screen.findByLabelText(/标题/);

  vi.useFakeTimers();

  fireEvent.change(titleInput, {
    target: { value: 'Review Outcome v1' },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(updateGraphNodePayload).toHaveBeenNthCalledWith(1, {
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-review',
    payload: expect.objectContaining({
      title: 'Review Outcome v1',
    }),
  });

  fireEvent.change(titleInput, {
    target: { value: 'Review Outcome v2' },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(updateGraphNodePayload).toHaveBeenNthCalledWith(2, {
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-review',
    payload: expect.objectContaining({
      title: 'Review Outcome v2',
    }),
  });

  secondSave.resolve(
    buildNodeDetail({
      id: 'node-review',
      title: 'Review Outcome v2',
      nodeType: 'review',
      status: undefined,
      payload: {
        title: 'Review Outcome v2',
        decision: 'Approved',
        feedback: 'Needs stronger product focus.',
      },
    }),
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText(/已保存到本地/)).toBeInTheDocument();

  expect(screen.getByDisplayValue(/review outcome v2/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /review outcome v2/i })).toBeInTheDocument();

  firstSave.resolve(
    buildNodeDetail({
      id: 'node-review',
      title: 'Review Outcome v1',
      nodeType: 'review',
      status: undefined,
      payload: {
        title: 'Review Outcome v1',
        decision: 'Pending',
        feedback: 'Needs stronger product focus.',
      },
    }),
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(screen.getByDisplayValue(/review outcome v2/i)).toBeInTheDocument();
  expect(screen.queryByDisplayValue(/review outcome v1/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /review outcome v2/i })).toBeInTheDocument();
  expect(screen.getByText(/已保存到本地/)).toBeInTheDocument();

  vi.useRealTimers();
});

test('keeps the drawer as an overlay while the canvas host remains mounted', async () => {
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  const canvas = screen.getByLabelText(/producer 画布/i);
  const drawer = await screen.findByTestId('graph-node-drawer');
  const host = screen.getByTestId('canvas-stage-host');

  expect(canvas).toContainElement(drawer);
  expect(canvas).toContainElement(host);
  expect(drawer).not.toContainElement(host);
});

test('opens quick add from a focused canvas host, loads graph options, filters them, and caches options per graph key', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Brief Canvas',
    layerType: 'brief',
  });
  const detailGraph = buildGraph({
    id: 'graph-shot-lab',
    name: 'Shot Lab Canvas',
    layerType: 'shot_lab',
    isRoot: false,
  });
  const rootSession = buildSession({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const detailSession = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [rootGraph, detailGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(detailGraph, {
        sourceNodeId: 'node-root',
        sourceNodeTitle: 'Root Brief',
      }),
    ],
  });
  const listGraphNodeTypeOptions = vi.fn().mockImplementation(({ graphId }: { graphId: string }) =>
    Promise.resolve(
      graphId === 'graph-root'
        ? [
            buildNodeTypeOption({
              nodeType: 'brief',
              label: 'Brief',
            }),
            buildNodeTypeOption({
              nodeType: 'reference',
              label: 'Reference',
            }),
            buildNodeTypeOption({
              nodeType: 'review',
              label: 'Review',
            }),
          ]
        : [
            buildNodeTypeOption({
              nodeType: 'reference',
              label: 'Reference',
            }),
            buildNodeTypeOption({
              nodeType: 'review',
              label: 'Review',
            }),
            buildNodeTypeOption({
              nodeType: 'still',
              label: 'Still',
            }),
          ],
    ),
  );
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(rootSession),
      open_node_child_graph: vi.fn().mockResolvedValue(detailSession),
      activate_graph: vi.fn().mockResolvedValue(rootSession),
      list_graph_nodes: vi.fn().mockImplementation(({ graphId }: { graphId: string }) =>
        Promise.resolve(
          graphId === 'graph-root'
            ? [
                buildNode({
                  id: 'node-root',
                  title: 'Root Brief',
                  canEnterChildGraph: true,
                }),
              ]
            : [],
        ),
      ),
    }),
    list_graph_node_type_options: listGraphNodeTypeOptions,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await screen.findByRole('button', { name: /root brief/i });
  const host = await screen.findByTestId('canvas-stage-host');

  fireEvent.pointerMove(host, { clientX: 280, clientY: 220 });
  host.focus();
  fireEvent.keyDown(host, { key: 'Tab' });

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();
  await waitFor(() => {
    expect(listGraphNodeTypeOptions).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
    });
  });

  const search = screen.getByRole('searchbox', {
    name: /搜索节点类型/,
  });
  const briefOption = await screen.findByRole('option', {
    name: /需求/,
  });

  await user.type(search, 'br');

  expect(briefOption).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('option', { name: /参考/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /评审/ })).not.toBeInTheDocument();

  await user.dblClick(screen.getByRole('button', { name: /root brief/i }));

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /节点快速创建器/ })).not.toBeInTheDocument();
  });

  const detailHost = await screen.findByTestId('canvas-stage-host');
  fireEvent.pointerMove(detailHost, { clientX: 320, clientY: 240 });
  detailHost.focus();
  await user.keyboard('{Tab}');

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();
  expect(listGraphNodeTypeOptions).toHaveBeenNthCalledWith(2, {
    sessionId: 'session-1',
    graphId: 'graph-shot-lab',
  });
  expect(await screen.findByRole('option', { name: /静帧/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /参考/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /评审/ })).toBeInTheDocument();

  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: /需求层/ }));

  const rootHost = await screen.findByTestId('canvas-stage-host');
  fireEvent.pointerMove(rootHost, { clientX: 300, clientY: 200 });
  rootHost.focus();
  await user.keyboard('{Tab}');

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();
  expect(listGraphNodeTypeOptions).toHaveBeenCalledTimes(2);
});

test('creates a persisted node from quick add at the tracked pointer position and opens the drawer ready', async () => {
  const shotLabGraph = buildGraph({
    id: 'graph-shot-lab',
    name: 'Shot Lab Canvas',
    layerType: 'shot_lab',
    isRoot: false,
  });
  const createGraphNode = vi.fn().mockResolvedValue(
    buildNodeDetail({
      id: 'node-created',
      graphId: 'graph-shot-lab',
      title: '新建评审',
      nodeType: 'review',
      status: undefined,
      layout: {
        x: -380,
        y: -160,
        width: 224,
        height: 124,
      },
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    }),
  );
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(
        buildSession({
          activeGraph: shotLabGraph,
          availableGraphs: [shotLabGraph],
          graphTrail: [buildTrailItem(shotLabGraph)],
        }),
      ),
      list_graph_nodes: vi.fn().mockResolvedValue([]),
    }),
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        nodeType: 'review',
        label: 'Review',
      }),
    ]),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await screen.findByText(/当前画布还没有节点/);
  const host = await screen.findByTestId('canvas-stage-host');

  fireEvent.pointerMove(host, { clientX: 260, clientY: 200 });
  host.focus();
  await user.keyboard('{Tab}');

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: /评审/ })).toBeInTheDocument();

  await user.keyboard('{Enter}');

  const nodeButton = await screen.findByRole('button', {
    name: /新建评审/,
  });

  expect(createGraphNode).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-shot-lab',
    nodeType: 'review',
    position: {
      x: -380,
      y: -160,
    },
    payload: {
      title: '新建评审',
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    },
  });
  expect(nodeButton).toHaveAttribute('data-node-id', 'node-created');
  expect(nodeButton).toHaveAttribute('data-node-world-x', '-380');
  expect(nodeButton).toHaveAttribute('data-node-world-y', '-160');
  expect(screen.getByText(/已选中：新建评审/)).toBeInTheDocument();
  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.queryByText(/正在加载节点详情/)).not.toBeInTheDocument();
  expect(screen.getByDisplayValue(/新建评审/)).toBeInTheDocument();
  expect(screen.getByLabelText(/结论/)).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /节点快速创建器/ })).not.toBeInTheDocument();
  expect(screen.getByText(/已保存到本地/)).toBeInTheDocument();
});

test('keeps quick add open and shows an error when persisted node creation fails', async () => {
  const shotLabGraph = buildGraph({
    id: 'graph-shot-lab',
    name: 'Shot Lab Canvas',
    layerType: 'shot_lab',
    isRoot: false,
  });
  const createGraphNode = vi.fn().mockRejectedValue(new Error('Could not create graph node'));
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(
        buildSession({
          activeGraph: shotLabGraph,
          availableGraphs: [shotLabGraph],
          graphTrail: [buildTrailItem(shotLabGraph)],
        }),
      ),
      list_graph_nodes: vi.fn().mockResolvedValue([]),
    }),
    create_graph_node: createGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        nodeType: 'review',
        label: 'Review',
      }),
    ]),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await screen.findByText(/当前画布还没有节点/);
  const host = await screen.findByTestId('canvas-stage-host');

  fireEvent.pointerMove(host, { clientX: 260, clientY: 200 });
  host.focus();
  await user.keyboard('{Tab}');

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();

  await user.keyboard('{Enter}');

  expect(createGraphNode).toHaveBeenCalledWith({
    sessionId: 'session-1',
    graphId: 'graph-shot-lab',
    nodeType: 'review',
    position: {
      x: -380,
      y: -160,
    },
    payload: {
      title: '新建评审',
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    },
  });

  expect(await screen.findByText(/无法创建节点/)).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /新建评审/ })).not.toBeInTheDocument();
});

test('keeps normal tab behavior inside drawer inputs instead of opening quick add', async () => {
  const listGraphNodeTypeOptions = vi.fn().mockResolvedValue([
    buildNodeTypeOption({
      nodeType: 'brief',
      label: 'Brief',
    }),
  ]);
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
    list_graph_node_type_options: listGraphNodeTypeOptions,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  const descriptionInput = await screen.findByLabelText(/需求描述/);
  descriptionInput.focus();

  await user.tab();

  expect(screen.getByLabelText(/搜索产品图素材/)).toHaveFocus();
  expect(screen.queryByRole('dialog', { name: /节点快速创建器/ })).not.toBeInTheDocument();
  expect(listGraphNodeTypeOptions).not.toHaveBeenCalled();

  const host = screen.getByTestId('canvas-stage-host');
  host.focus();
  fireEvent.pointerMove(host, { clientX: 680, clientY: 360 });
  fireEvent.keyDown(host, { key: 'Tab' });

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();

  await user.keyboard('{Escape}');

  expect(screen.queryByRole('dialog', { name: /节点快速创建器/ })).not.toBeInTheDocument();
  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(screen.getByText(/已选中：opening brief/i)).toBeInTheDocument();
});

test('does not delete the selected node while quick add is open', async () => {
  const deleteGraphNode = vi.fn();
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
    delete_graph_node: deleteGraphNode,
    list_graph_node_type_options: vi.fn().mockResolvedValue([
      buildNodeTypeOption({
        nodeType: 'brief',
        label: 'Brief',
      }),
    ]),
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  const host = screen.getByTestId('canvas-stage-host');
  host.focus();
  fireEvent.pointerMove(host, { clientX: 680, clientY: 360 });
  fireEvent.keyDown(host, { key: 'Tab' });

  expect(await screen.findByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Delete' });

  expect(deleteGraphNode).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: /节点快速创建器/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /opening brief/i })).toBeInTheDocument();
});

test('keeps the selected node open and shows a workspace error when node deletion fails', async () => {
  const deleteGraphNode = vi.fn().mockRejectedValue(new Error('Could not delete node'));
  const bridge = {
    ...buildBridge({
      get_project_session: vi.fn().mockResolvedValue(buildSession()),
      list_graph_nodes: vi.fn().mockResolvedValue([buildNode()]),
      get_graph_node_detail: vi.fn().mockResolvedValue(buildNodeDetail()),
    }),
    delete_graph_node: deleteGraphNode,
  } as unknown as ProducerBridge;

  render(<App bridge={bridge} />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /opening brief/i }));

  expect(await screen.findByTestId('graph-node-drawer')).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Delete' });

  await waitFor(() => {
    expect(deleteGraphNode).toHaveBeenCalledWith({
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
    });
  });

  expect(screen.getByRole('button', { name: /opening brief/i })).toBeInTheDocument();
  expect(screen.getByTestId('graph-node-drawer')).toBeInTheDocument();
  expect(await screen.findByText(/无法删除节点/)).toBeInTheDocument();
});
