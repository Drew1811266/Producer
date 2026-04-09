import { createTauriProducerBridge } from './tauri';
import type {
  GraphContextTrailItem,
  GraphNodeDetail,
  ProjectAssetSummary,
  ProjectGraphSummary,
  ProjectMediaIndexSummary,
  ProjectSession,
} from './contracts';

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-root',
    name: 'Root Story',
    layerType: 'story',
    isRoot: true,
    ...overrides,
  };
}

function buildSession(overrides: Partial<ProjectSession> = {}): ProjectSession {
  const activeGraph = buildGraph();

  return {
    sessionId: 'session-1',
    projectId: 'project-1',
    projectName: 'Producer Demo',
    projectPath: '/projects/demo',
    templateId: 'documentary',
    templateVersion: 1,
    graphCount: 1,
    assetCount: 0,
    activeGraph,
    availableGraphs: [activeGraph],
    graphTrail: [
      {
        graphId: activeGraph.id,
        graphName: activeGraph.name,
        layerType: activeGraph.layerType,
      },
    ],
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

function buildNodeDetail(overrides: Record<string, unknown> = {}): GraphNodeDetail {
  const baseNode = {
    id: ('id' in overrides ? overrides.id : 'node-1') as string,
    graphId: ('graphId' in overrides ? overrides.graphId : 'graph-root') as string,
    title: ('title' in overrides ? overrides.title : 'Opening Brief') as string,
    nodeType: ('nodeType' in overrides ? overrides.nodeType : 'brief') as string,
    storedAssetCount: ('storedAssetCount' in overrides ? overrides.storedAssetCount : 0) as number,
    status: ('status' in overrides ? overrides.status : 'Ready') as string | undefined,
    layout: ('layout' in overrides
      ? overrides.layout
      : {
          x: -180,
          y: -120,
          width: 360,
          height: 180,
        }) as GraphNodeDetail['layout'],
  };
  const payloadOverrides = { ...overrides };
  const payload = payloadOverrides.payload;
  const assetBindings = Array.isArray(overrides.assetBindings)
    ? (overrides.assetBindings as GraphNodeDetail['assetBindings'])
    : [];

  delete payloadOverrides.id;
  delete payloadOverrides.graphId;
  delete payloadOverrides.title;
  delete payloadOverrides.nodeType;
  delete payloadOverrides.storedAssetCount;
  delete payloadOverrides.status;
  delete payloadOverrides.layout;
  delete payloadOverrides.assetBindings;
  delete payloadOverrides.payload;

  return {
    ...baseNode,
    storedAssetCount:
      'storedAssetCount' in overrides ? baseNode.storedAssetCount : assetBindings.length,
    assetBindings,
    assetRoleOptions: [],
    payload: {
      title: baseNode.title,
      ...(baseNode.status ? { status: baseNode.status } : {}),
      product: 'Trail shoe',
      objective: 'Launch a social teaser',
      ...(typeof payload === 'object' && payload !== null ? payload : {}),
      ...payloadOverrides,
    },
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

function buildAssetSummary(
  overrides: Partial<ProjectAssetSummary> = {},
): ProjectAssetSummary {
  return {
    id: 'asset-1',
    relativePath: 'images/hero.png',
    mediaType: 'image',
    mimeType: 'image/png',
    byteSize: 1024,
    width: 1280,
    height: 720,
    durationMs: undefined,
    thumbnailPath: '/projects/demo/.producer/thumbnails/asset-1/card.png',
    thumbnailStatus: 'ready',
    indexedAt: '1710000100',
    missing: false,
    ...overrides,
  };
}

test('normalizes a backend session into activeGraph and availableGraphs', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Root Graph',
    layerType: 'sequence',
  });
  const command = vi.fn().mockResolvedValue({
    sessionId: 'session-1',
    projectId: 'project-1',
    projectName: 'Producer Demo',
    projectPath: '/projects/demo',
    templateId: 'documentary',
    templateVersion: 1,
    graphCount: 1,
    assetCount: 0,
    rootGraph,
  });
  const bridge = createTauriProducerBridge(command);

  const session = await bridge.get_project_session();

  expect(command).toHaveBeenCalledWith('get_project_session', {
    request: {},
  });
  expect(session).toMatchObject({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
});

test('activate_graph forwards the payload and caches the returned session', async () => {
  const detailGraph = buildGraph({
    id: 'graph-detail',
    name: 'Detail Graph',
    layerType: 'shot',
    isRoot: false,
  });
  const session = buildSession({
    activeGraph: detailGraph,
    availableGraphs: [buildGraph(), detailGraph],
  });
  const command = vi.fn().mockResolvedValue(session);
  const bridge = createTauriProducerBridge(command);

  const activatedSession = await bridge.activate_graph({
    sessionId: 'session-1',
    graphId: 'graph-detail',
  });
  const cachedSession = await bridge.get_project_session({ sessionId: 'session-1' });

  expect(command).toHaveBeenCalledWith('activate_graph', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-detail',
    },
  });
  expect(command).toHaveBeenCalledTimes(1);
  expect(activatedSession.activeGraph).toEqual(detailGraph);
  expect(cachedSession).toEqual(activatedSession);
});

test('open_node_child_graph forwards the payload and caches the returned session with graphTrail', async () => {
  const rootGraph = buildGraph({
    id: 'graph-root',
    name: 'Brief Canvas',
    layerType: 'brief',
  });
  const childGraph = buildGraph({
    id: 'graph-storyboard',
    name: 'Storyboard Canvas',
    layerType: 'storyboard',
    isRoot: false,
  });
  const session = buildSession({
    activeGraph: childGraph,
    availableGraphs: [rootGraph, childGraph],
    graphTrail: [
      buildTrailItem(rootGraph),
      buildTrailItem(childGraph, {
        sourceNodeId: 'node-brief',
        sourceNodeTitle: 'Campaign Brief',
      }),
    ],
  });
  const command = vi.fn().mockResolvedValue(session);
  const bridge = createTauriProducerBridge(command);

  const nextSession = await bridge.open_node_child_graph({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-brief',
  });
  const cachedSession = await bridge.get_project_session({ sessionId: 'session-1' });

  expect(command).toHaveBeenCalledWith('open_node_child_graph', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-brief',
    },
  });
  expect(nextSession.graphTrail).toEqual(session.graphTrail);
  expect(cachedSession).toEqual(nextSession);
});

test('delete_graph_node forwards the payload to tauri and prunes deleted graphs from the cached session', async () => {
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
  const shotLabGraph = buildGraph({
    id: 'graph-shot-lab',
    name: 'Shot Lab Canvas',
    layerType: 'shot_lab',
    isRoot: false,
  });
  const session = buildSession({
    sessionId: 'session-delete-1',
    activeGraph: rootGraph,
    availableGraphs: [rootGraph, storyboardGraph, shotLabGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
  const command = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_project_session') {
      return Promise.resolve(session);
    }

    if (name === 'delete_graph_node') {
      return Promise.resolve({
        graphId: 'graph-root',
        nodeId: 'node-brief',
        deletedGraphIds: ['graph-shot-lab', 'graph-storyboard'],
      });
    }

    throw new Error(`unexpected command ${name}`);
  });
  const bridge = createTauriProducerBridge(command) as unknown as {
    delete_graph_node(payload: {
      sessionId: string;
      graphId: string;
      nodeId: string;
    }): Promise<{
      graphId: string;
      nodeId: string;
      deletedGraphIds: string[];
    }>;
    get_project_session(payload?: { sessionId?: string }): Promise<ProjectSession | null>;
  };

  await bridge.get_project_session({ sessionId: 'session-delete-1' });

  const result = await bridge.delete_graph_node({
    sessionId: 'session-delete-1',
    graphId: 'graph-root',
    nodeId: 'node-brief',
  });
  const cachedSession = await bridge.get_project_session({ sessionId: 'session-delete-1' });

  expect(command).toHaveBeenCalledWith('delete_graph_node', {
    request: {
      sessionId: 'session-delete-1',
      graphId: 'graph-root',
      nodeId: 'node-brief',
    },
  });
  expect(result).toEqual({
    graphId: 'graph-root',
    nodeId: 'node-brief',
    deletedGraphIds: ['graph-shot-lab', 'graph-storyboard'],
  });
  expect(cachedSession).toMatchObject({
    activeGraph: rootGraph,
    availableGraphs: [rootGraph],
    graphTrail: [buildTrailItem(rootGraph)],
  });
});

test('list_graph_nodes forwards the payload to tauri', async () => {
  const command = vi.fn().mockResolvedValue([
    {
      id: 'node-1',
      graphId: 'graph-root',
      title: 'Opening Brief',
      nodeType: 'brief',
      storedAssetCount: 0,
      status: 'Ready',
      layout: {
        x: -180,
        y: -120,
        width: 360,
        height: 180,
      },
    },
  ]);
  const bridge = createTauriProducerBridge(command) as unknown as {
    list_graph_nodes(payload: { sessionId: string; graphId: string }): Promise<unknown[]>;
  };

  const nodes = await bridge.list_graph_nodes({
    sessionId: 'session-1',
    graphId: 'graph-root',
  });

  expect(command).toHaveBeenCalledWith('list_graph_nodes', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
    },
  });
  expect(nodes).toEqual([
    {
      id: 'node-1',
      graphId: 'graph-root',
      title: 'Opening Brief',
      nodeType: 'brief',
      storedAssetCount: 0,
      status: 'Ready',
      layout: {
        x: -180,
        y: -120,
        width: 360,
        height: 180,
      },
    },
  ]);
});

test('get_graph_node_detail forwards the payload to tauri', async () => {
  const detail = buildNodeDetail({
    title: 'Review Outcome',
    nodeType: 'review',
    status: undefined,
    decision: 'Approved',
    feedback: 'Strong framing and product read.',
  });
  const command = vi.fn().mockResolvedValue(detail);
  const bridge = createTauriProducerBridge(command);

  const nodeDetail = await bridge.get_graph_node_detail({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
  });

  expect(command).toHaveBeenCalledWith('get_graph_node_detail', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
    },
  });
  expect(nodeDetail).toEqual(detail);
});

test('create_graph_node forwards the payload to tauri', async () => {
  const detail = buildNodeDetail({
    id: 'node-created',
    title: 'New Review',
    nodeType: 'review',
    status: undefined,
    layout: {
      x: -380,
      y: -160,
      width: 168,
      height: 104,
    },
    payload: {
      title: 'New Review',
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    },
  });
  const command = vi.fn().mockResolvedValue(detail);
  const bridge = createTauriProducerBridge(command) as unknown as {
    create_graph_node(payload: {
      sessionId: string;
      graphId: string;
      nodeType: string;
      layout: { x: number; y: number; width: number; height: number };
      payload: Record<string, unknown>;
    }): Promise<GraphNodeDetail>;
  };

  const createdNode = await bridge.create_graph_node({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeType: 'review',
    layout: {
      x: -380,
      y: -160,
      width: 168,
      height: 104,
    },
    payload: {
      title: 'New Review',
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    },
  });

  expect(command).toHaveBeenCalledWith('create_graph_node', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeType: 'review',
      layout: {
        x: -380,
        y: -160,
        width: 168,
        height: 104,
      },
      payload: {
        title: 'New Review',
        decision: '',
        feedback: '',
        reviewer: '',
        reviewed_at: '',
      },
    },
  });
  expect(createdNode).toEqual(detail);
});

test('update_graph_node_payload forwards the payload to tauri', async () => {
  const detail = buildNodeDetail({
    id: 'node-1',
    title: 'Approved Review',
    nodeType: 'review',
    status: undefined,
    payload: {
      title: 'Approved Review',
      decision: 'Approved',
      feedback: 'Strong framing and product read.',
      reviewer: 'Drew',
      reviewed_at: '2026-03-18',
    },
  });
  const command = vi.fn().mockResolvedValue(detail);
  const bridge = createTauriProducerBridge(command) as unknown as {
    update_graph_node_payload(payload: {
      sessionId: string;
      graphId: string;
      nodeId: string;
      payload: Record<string, unknown>;
    }): Promise<GraphNodeDetail>;
  };

  const updatedNode = await bridge.update_graph_node_payload({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
    payload: {
      title: 'Approved Review',
      decision: 'Approved',
      feedback: 'Strong framing and product read.',
      reviewer: 'Drew',
      reviewed_at: '2026-03-18',
    },
  });

  expect(command).toHaveBeenCalledWith('update_graph_node_payload', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
      payload: {
        title: 'Approved Review',
        decision: 'Approved',
        feedback: 'Strong framing and product read.',
        reviewer: 'Drew',
        reviewed_at: '2026-03-18',
      },
    },
  });
  expect(updatedNode).toEqual(detail);
});

test('list_graph_node_type_options forwards the payload to tauri', async () => {
  const command = vi.fn().mockResolvedValue([
    {
      nodeType: 'brief',
      label: 'Brief',
    },
    {
      nodeType: 'review',
      label: 'Review',
    },
  ]);
  const bridge = createTauriProducerBridge(command) as unknown as {
    list_graph_node_type_options(payload: { sessionId: string; graphId: string }): Promise<unknown[]>;
  };

  const options = await bridge.list_graph_node_type_options({
    sessionId: 'session-1',
    graphId: 'graph-root',
  });

  expect(command).toHaveBeenCalledWith('list_graph_node_type_options', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
    },
  });
  expect(options).toEqual([
    {
      nodeType: 'brief',
      label: 'Brief',
    },
    {
      nodeType: 'review',
      label: 'Review',
    },
  ]);
});

test('create_graph_node forwards the payload to tauri', async () => {
  const detail = buildNodeDetail({
    id: 'node-new',
    title: 'New Review',
    nodeType: 'review',
    status: undefined,
    payload: {
      title: 'New Review',
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    },
  });
  const command = vi.fn().mockResolvedValue(detail);
  const bridge = createTauriProducerBridge(command) as unknown as {
    create_graph_node(payload: {
      sessionId: string;
      graphId: string;
      nodeType: string;
      layout: { x: number; y: number; width: number; height: number };
      payload: Record<string, unknown>;
    }): Promise<GraphNodeDetail>;
  };

  const created = await bridge.create_graph_node({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeType: 'review',
    layout: {
      width: 168,
      height: 104,
      x: 320,
      y: 180,
    },
    payload: {
      title: 'New Review',
      decision: '',
      feedback: '',
      reviewer: '',
      reviewed_at: '',
    },
  });

  expect(command).toHaveBeenCalledWith('create_graph_node', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeType: 'review',
      layout: {
        width: 168,
        height: 104,
        x: 320,
        y: 180,
      },
      payload: {
        title: 'New Review',
        decision: '',
        feedback: '',
        reviewer: '',
        reviewed_at: '',
      },
    },
  });
  expect(created).toEqual(detail);
});

test('update_graph_node_payload forwards the payload to tauri', async () => {
  const detail = buildNodeDetail({
    id: 'node-1',
    title: 'Updated Brief',
    payload: {
      title: 'Updated Brief',
      status: 'Approved',
      product: 'Trail shoe',
    },
  });
  const command = vi.fn().mockResolvedValue(detail);
  const bridge = createTauriProducerBridge(command) as unknown as {
    update_graph_node_payload(payload: {
      sessionId: string;
      graphId: string;
      nodeId: string;
      payload: Record<string, unknown>;
    }): Promise<GraphNodeDetail>;
  };

  const updated = await bridge.update_graph_node_payload({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
    payload: {
      title: 'Updated Brief',
      status: 'Approved',
      product: 'Trail shoe',
    },
  });

  expect(command).toHaveBeenCalledWith('update_graph_node_payload', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
      payload: {
        title: 'Updated Brief',
        status: 'Approved',
        product: 'Trail shoe',
      },
    },
  });
  expect(updated).toEqual(detail);
});

test('update_graph_node_position forwards the payload to tauri', async () => {
  const summary = {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Updated Brief',
    nodeType: 'brief',
    status: 'Ready',
    layout: {
      x: 240,
      y: 160,
      width: 208,
      height: 128,
    },
  };
  const command = vi.fn().mockResolvedValue(summary);
  const bridge = createTauriProducerBridge(command) as unknown as {
    update_graph_node_position(payload: {
      sessionId: string;
      graphId: string;
      nodeId: string;
      position: { x: number; y: number };
    }): Promise<typeof summary>;
  };

  const updated = await bridge.update_graph_node_position({
    sessionId: 'session-1',
    graphId: 'graph-root',
    nodeId: 'node-1',
    position: {
      x: 240,
      y: 160,
    },
  });

  expect(command).toHaveBeenCalledWith('update_graph_node_position', {
    request: {
      sessionId: 'session-1',
      graphId: 'graph-root',
      nodeId: 'node-1',
      position: {
        x: 240,
        y: 160,
      },
    },
  });
  expect(updated).toEqual(summary);
});

test('get_project_media_index_summary forwards the payload to tauri', async () => {
  const summary = buildMediaIndexSummary({
    assetCount: 3,
    imageCount: 2,
    readyThumbnailCount: 2,
  });
  const command = vi.fn().mockResolvedValue(summary);
  const bridge = createTauriProducerBridge(command);

  const result = await bridge.get_project_media_index_summary({
    sessionId: 'session-1',
  });

  expect(command).toHaveBeenCalledWith('get_project_media_index_summary', {
    request: {
      sessionId: 'session-1',
    },
  });
  expect(result).toEqual(summary);
});

test('refresh_project_media_index forwards the payload to tauri', async () => {
  const summary = buildMediaIndexSummary({
    assetCount: 1,
    imageCount: 1,
    readyThumbnailCount: 1,
  });
  const command = vi.fn().mockResolvedValue(summary);
  const bridge = createTauriProducerBridge(command);

  const result = await bridge.refresh_project_media_index({
    sessionId: 'session-1',
    reason: 'startup',
  });

  expect(command).toHaveBeenCalledWith('refresh_project_media_index', {
    request: {
      sessionId: 'session-1',
      reason: 'startup',
    },
  });
  expect(result).toEqual(summary);
});

test('list_project_assets forwards the payload to tauri', async () => {
  const assets = [buildAssetSummary()];
  const command = vi.fn().mockResolvedValue(assets);
  const bridge = createTauriProducerBridge(command);

  const result = await bridge.list_project_assets({
    sessionId: 'session-1',
    mediaType: 'image',
    limit: 20,
  });

  expect(command).toHaveBeenCalledWith('list_project_assets', {
    request: {
      sessionId: 'session-1',
      mediaType: 'image',
      limit: 20,
    },
  });
  expect(result).toEqual(assets);
});
