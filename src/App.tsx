import { startTransition, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Connection } from '@xyflow/react';

import type {
  GraphEdgeSummary,
  GraphNodeDetail,
  GraphNodeAssetBinding,
  GraphNodePosition,
  GraphNodeSummary,
  GraphNodeTypeOption,
  GraphRelationTypeOption,
  NodeAssetRole,
  ProducerBridge,
  ProjectAssetSummary,
  ProjectMediaIndexSummary,
  ProjectSession,
  ProjectTemplate,
} from './bridge/contracts';
import { tauriBridge } from './bridge/tauri';
import {
  formatAssetCountZh,
  formatSelectedNodeCountZh,
  formatSelectedEdgeSummaryZh,
  formatSelectedNodeSummaryZh,
  formatTemplateDescriptionZh,
  formatTemplateNameZh,
  formatThumbnailCountZh,
  toUiErrorMessage,
  zhCN,
} from './copy/zh-CN';
import { computeAutoLayout } from './canvas/autoLayout';
import { CanvasViewport } from './canvas/CanvasViewport';
import type { CameraState } from './canvas/camera';
import { DEFAULT_CAMERA } from './canvas/camera';
import { filterProducerNodeTypeOptionsForLayer } from './canvas/producerNodeSystem';
import { GraphNodeDrawer } from './drawer/GraphNodeDrawer';
import { resolveDrawerWidth } from './drawer/layout';
import {
  extractGraphNodePayload,
  projectGraphNodeSummaryWithDraft,
  type GraphNodeDraft,
} from './drawer/nodeDraft';
import { GraphBreadcrumbs } from './navigation/GraphBreadcrumbs';
import { QuickAddOverlay } from './quick-add/QuickAddOverlay';
import { buildGraphNodeCreateRequest } from './quick-add/localNode';
import type {
  CachedNodeTypeOptions,
  CanvasQuickAddAnchor,
  CanvasQuickAddPendingConnection,
  CanvasQuickAddRequest,
} from './quick-add/types';

type LaunchState =
  | {
      screen: 'loading';
    }
  | {
      screen: 'error';
      message: string;
    }
  | {
      screen: 'startup';
      templates: ProjectTemplate[];
      selectedTemplateId: string;
      pendingAction: 'create' | 'open' | null;
      message?: string;
    }
  | {
      screen: 'workspace';
      session: ProjectSession;
    };

type AppProps = {
  bridge?: ProducerBridge;
};

function normalizeError(error: unknown, fallback: string = zhCN.app.bridgeUnavailable): string {
  return toUiErrorMessage(error, fallback);
}

function toStartupState(
  templates: ProjectTemplate[],
  selectedTemplateId = templates[0]?.id ?? '',
  message?: string,
  pendingAction: 'create' | 'open' | null = null,
): Extract<LaunchState, { screen: 'startup' }> {
  return {
    screen: 'startup',
    templates,
    selectedTemplateId,
    pendingAction,
    message,
  };
}

async function resolveSession(
  bridge: ProducerBridge,
  sessionId: string,
): Promise<ProjectSession> {
  const session = await bridge.get_project_session({ sessionId });

  if (!session) {
    throw new Error(zhCN.app.invalidProjectSession);
  }

  return session;
}

function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'),
  );
}

function omitRecordKeys<T>(
  current: Record<string, T>,
  keys: readonly string[],
): Record<string, T> {
  if (keys.length === 0) {
    return current;
  }

  let changed = false;
  const next = { ...current };

  for (const key of keys) {
    if (!(key in next)) {
      continue;
    }

    changed = true;
    delete next[key];
  }

  return changed ? next : current;
}

function omitRecordEntriesByPrefix<T>(
  current: Record<string, T>,
  prefixes: readonly string[],
): Record<string, T> {
  if (prefixes.length === 0) {
    return current;
  }

  let changed = false;
  const next: Record<string, T> = {};

  for (const [key, value] of Object.entries(current)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      changed = true;
      continue;
    }

    next[key] = value;
  }

  return changed ? next : current;
}

function buildConnectionFromPendingQuickAdd(
  nodeId: string,
  pendingConnection: CanvasQuickAddPendingConnection,
): Connection {
  if (pendingConnection.sourceHandleType === 'target') {
    return {
      source: nodeId,
      sourceHandle: 'out',
      target: pendingConnection.sourceNodeId,
      targetHandle: pendingConnection.sourceHandleId ?? 'in',
    };
  }

  return {
    source: pendingConnection.sourceNodeId,
    sourceHandle: pendingConnection.sourceHandleId ?? 'out',
    target: nodeId,
    targetHandle: 'in',
  };
}

type WorkspaceScreenProps = {
  bridge: ProducerBridge;
  session: ProjectSession;
  onSessionChange(session: ProjectSession): void;
};

type HydrationTrackedState = {
  mutationRevision: number;
  pendingHydration: boolean;
  requestId: number;
};

type CachedGraphNodes = {
  status: 'loading' | 'ready' | 'error';
  nodes: GraphNodeSummary[];
  error: string | null;
} & HydrationTrackedState;

type NodeDetailLoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
};

type QuickAddState = {
  anchor: CanvasQuickAddAnchor;
  createError: string | null;
  graphKey: string;
  pendingConnection: CanvasQuickAddPendingConnection | null;
  pendingNodeType: string | null;
};

type NodeSaveState = {
  error: string | null;
  inFlightVersion: number | null;
  latestVersion: number;
  status: 'idle' | 'saving' | 'error';
};

type WorkspaceMediaIndexState = {
  error: string | null;
  status: 'loading' | 'refreshing' | 'ready' | 'error';
  summary: ProjectMediaIndexSummary | null;
};

type CachedGraphEdges = {
  edges: GraphEdgeSummary[];
  error: string | null;
  status: 'loading' | 'ready' | 'error';
} & HydrationTrackedState;

type CachedRelationTypeOptions = {
  error: string | null;
  options: GraphRelationTypeOption[];
  status: 'loading' | 'ready' | 'error';
} & HydrationTrackedState;

type AssetSearchState = {
  assets: ProjectAssetSummary[];
  error: string | null;
  mediaType?: ProjectAssetSummary['mediaType'];
  query: string;
  selectedRole: NodeAssetRole | '';
  status: 'idle' | 'loading' | 'ready' | 'error';
};

type RelationComposerState = {
  createError: string | null;
  deleteError: string | null;
  pendingDeleteEdgeId: string | null;
  pendingSubmit: boolean;
  selectedTargetNodeId: string;
  selectedType: string;
};

type CanvasOcclusionInsets = {
  top: number;
  right: number;
  bottom: number;
};

type CachedNodeIdentity = {
  graphId: string;
  graphKey: string;
  nodeId: string;
  nodeKey: string;
  sessionId: string;
};

const DEFAULT_VIEWPORT_WIDTH = 1280;
const NODE_SAVE_DEBOUNCE_MS = 300;
const EMPTY_SELECTED_NODE_IDS: string[] = [];

function toGraphCacheKey(sessionId: string, graphId: string): string {
  return `${sessionId}:${graphId}`;
}

function toNodeCacheKey(sessionId: string, graphId: string, nodeId: string): string {
  return `${sessionId}:${graphId}:${nodeId}`;
}

function toEdgeCacheKey(sessionId: string, graphId: string, edgeId: string): string {
  return `${sessionId}:${graphId}:${edgeId}`;
}

function reconcileSelectedNodeId(
  selectedNodeId: string | null | undefined,
  nodes: GraphNodeSummary[],
): string | null {
  if (!selectedNodeId) {
    return null;
  }

  return nodes.some((node) => node.id === selectedNodeId && !node.isSystem) ? selectedNodeId : null;
}

function areStringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function reconcileSelectedNodeIds(
  selectedNodeIds: readonly string[] | null | undefined,
  nodes: GraphNodeSummary[],
): string[] {
  if (!selectedNodeIds || selectedNodeIds.length === 0) {
    return EMPTY_SELECTED_NODE_IDS;
  }

  const selectedNodeIdSet = new Set(selectedNodeIds);
  const nextSelectedNodeIds = nodes
    .map((node) => (!node.isSystem && selectedNodeIdSet.has(node.id) ? node.id : null))
    .filter((nodeId): nodeId is string => nodeId !== null);

  if (nextSelectedNodeIds.length === 0) {
    return EMPTY_SELECTED_NODE_IDS;
  }

  return areStringArraysEqual(selectedNodeIds, nextSelectedNodeIds)
    ? (selectedNodeIds as string[])
    : nextSelectedNodeIds;
}

function reconcileSelectedEdgeId(
  selectedEdgeId: string | null | undefined,
  edges: GraphEdgeSummary[],
): string | null {
  if (!selectedEdgeId) {
    return null;
  }

  return edges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null;
}

function formatSelectedNodeSummary(node: GraphNodeSummary | null): string {
  return formatSelectedNodeSummaryZh(node);
}

function formatSelectedNodeCountSummary(count: number): string {
  return formatSelectedNodeCountZh(count);
}

function formatSelectedEdgeSummary(
  edge: GraphEdgeSummary | null,
  nodes: GraphNodeSummary[],
): string {
  if (!edge) {
    return formatSelectedEdgeSummaryZh(null);
  }

  const sourceTitle = nodes.find((node) => node.id === edge.sourceNodeId)?.title ?? edge.sourceNodeId;
  const targetTitle = nodes.find((node) => node.id === edge.targetNodeId)?.title ?? edge.targetNodeId;

  return formatSelectedEdgeSummaryZh({
    relationType: edge.edgeType,
    sourceTitle,
    targetTitle,
  });
}

function buildIdleNodeSaveState(): NodeSaveState {
  return {
    error: null,
    inFlightVersion: null,
    latestVersion: 0,
    status: 'idle',
  };
}

function buildInitialGraphNodesState(): CachedGraphNodes {
  return {
    error: null,
    mutationRevision: 0,
    nodes: [],
    pendingHydration: true,
    requestId: 0,
    status: 'loading',
  };
}

function buildInitialGraphEdgesState(): CachedGraphEdges {
  return {
    edges: [],
    error: null,
    mutationRevision: 0,
    pendingHydration: true,
    requestId: 0,
    status: 'loading',
  };
}

function buildInitialRelationTypeOptionsState(): CachedRelationTypeOptions {
  return {
    error: null,
    mutationRevision: 0,
    options: [],
    pendingHydration: true,
    requestId: 0,
    status: 'loading',
  };
}

function buildLoadingMediaIndexState(): WorkspaceMediaIndexState {
  return {
    error: null,
    status: 'loading',
    summary: null,
  };
}

function buildIdleAssetSearchState(defaultRole: NodeAssetRole | '' = ''): AssetSearchState {
  return {
    assets: [],
    error: null,
    mediaType: resolveAssetSearchMediaType(defaultRole),
    query: '',
    selectedRole: defaultRole,
    status: 'idle',
  };
}

function resolveAssetSearchMediaType(
  role: NodeAssetRole | '',
): ProjectAssetSummary['mediaType'] | undefined {
  switch (role) {
    case 'product_image':
      return 'image';
    case 'example_video':
      return 'video';
    default:
      return undefined;
  }
}

function buildInitialRelationComposerState(defaultType = ''): RelationComposerState {
  return {
    createError: null,
    deleteError: null,
    pendingDeleteEdgeId: null,
    pendingSubmit: false,
    selectedTargetNodeId: '',
    selectedType: defaultType,
  };
}

function applyRolePriority(bindings: GraphNodeAssetBinding[]): GraphNodeAssetBinding | null {
  if (bindings.length === 0) {
    return null;
  }

  const rolePriority: NodeAssetRole[] = [
    'preview',
    'product_image',
    'example_video',
    'output',
    'reference',
    'source',
  ];

  for (const role of rolePriority) {
    const match = bindings.find((binding) => binding.role === role);

    if (match) {
      return match;
    }
  }

  return bindings[0] ?? null;
}

function normalizeGraphNodeDetail(detail: GraphNodeDetail): GraphNodeDetail {
  return {
    ...detail,
    assetBindings: detail.assetBindings ?? [],
    assetRoleOptions: detail.assetRoleOptions ?? [],
  };
}

function isLoDGlobalView(camera: CameraState): boolean {
  return camera.zoom < 0.25;
}

function filterVisibleEdges(
  edges: GraphEdgeSummary[],
  selectedEdgeId: string | null,
  selectedNodeId: string | null,
  camera: CameraState,
): GraphEdgeSummary[] {
  if (!isLoDGlobalView(camera)) {
    return edges;
  }

  if (selectedEdgeId) {
    return edges.filter((edge) => edge.id === selectedEdgeId);
  }

  if (!selectedNodeId) {
    return [];
  }

  return edges.filter(
    (edge) => edge.sourceNodeId === selectedNodeId || edge.targetNodeId === selectedNodeId,
  );
}

function filterRenderableEdges(
  edges: GraphEdgeSummary[],
  nodes: GraphNodeSummary[],
): GraphEdgeSummary[] {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return edges.filter(
    (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId),
  );
}

function splitNodeRelations(edges: GraphEdgeSummary[], nodeId: string) {
  return {
    incoming: edges.filter((edge) => edge.targetNodeId === nodeId),
    outgoing: edges.filter((edge) => edge.sourceNodeId === nodeId),
  };
}

function shouldRefreshMediaIndex(summary: ProjectMediaIndexSummary): boolean {
  return summary.assetCount === 0 && !summary.lastIndexedAt;
}

function WorkspaceScreen({ bridge, session, onSessionChange }: WorkspaceScreenProps) {
  const [pendingGraphId, setPendingGraphId] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [mediaIndexState, setMediaIndexState] = useState<WorkspaceMediaIndexState>(() => buildLoadingMediaIndexState());
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);
  const [canvasOcclusionInsets, setCanvasOcclusionInsets] = useState<CanvasOcclusionInsets>({
    top: 0,
    right: 0,
    bottom: 0,
  });
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth,
  );
  const [cameraByGraphKey, setCameraByGraphKey] = useState<Record<string, CameraState>>({});
  const [nodesByGraphKey, setNodesByGraphKey] = useState<Record<string, CachedGraphNodes>>({});
  const [edgesByGraphKey, setEdgesByGraphKey] = useState<Record<string, CachedGraphEdges>>({});
  const [selectedEdgeIdByGraphKey, setSelectedEdgeIdByGraphKey] = useState<Record<string, string | null>>({});
  const [selectedNodeIdsByGraphKey, setSelectedNodeIdsByGraphKey] = useState<Record<string, string[]>>({});
  const [drawerNodeIdByGraphKey, setDrawerNodeIdByGraphKey] = useState<Record<string, string | null>>({});
  const [nodeDetailByNodeKey, setNodeDetailByNodeKey] = useState<Record<string, GraphNodeDetail>>({});
  const [nodeDetailLoadStateByNodeKey, setNodeDetailLoadStateByNodeKey] = useState<
    Record<string, NodeDetailLoadState>
  >({});
  const [nodeDraftByNodeKey, setNodeDraftByNodeKey] = useState<Record<string, GraphNodeDraft>>({});
  const [nodeSaveStateByNodeKey, setNodeSaveStateByNodeKey] = useState<Record<string, NodeSaveState>>({});
  const [nodeTypeOptionsByGraphKey, setNodeTypeOptionsByGraphKey] = useState<
    Record<string, CachedNodeTypeOptions>
  >({});
  const [relationTypeOptionsByGraphKey, setRelationTypeOptionsByGraphKey] = useState<
    Record<string, CachedRelationTypeOptions>
  >({});
  const [newlyCreatedNodeIdByGraphKey, setNewlyCreatedNodeIdByGraphKey] = useState<Record<string, string | null>>(
    {},
  );
  const [assetSearchByNodeKey, setAssetSearchByNodeKey] = useState<Record<string, AssetSearchState>>({});
  const [relationComposerByNodeKey, setRelationComposerByNodeKey] = useState<
    Record<string, RelationComposerState>
  >({});
  const [quickAddState, setQuickAddState] = useState<QuickAddState | null>(null);
  const nodesByGraphKeyRef = useRef(nodesByGraphKey);
  const edgesByGraphKeyRef = useRef(edgesByGraphKey);
  const relationTypeOptionsByGraphKeyRef = useRef(relationTypeOptionsByGraphKey);
  const nodeHydrationInFlightByGraphKeyRef = useRef<Record<string, number | undefined>>({});
  const edgeHydrationInFlightByGraphKeyRef = useRef<Record<string, number | undefined>>({});
  const relationTypeHydrationInFlightByGraphKeyRef = useRef<Record<string, number | undefined>>({});
  const previousGraphCameraKeyRef = useRef<string | null>(null);
  const quickAddStateRef = useRef<QuickAddState | null>(null);
  const workspaceCanvasRef = useRef<HTMLElement | null>(null);
  const workspaceTopbarRef = useRef<HTMLDivElement | null>(null);
  const pendingSaveTimeoutByNodeKeyRef = useRef<Record<string, number>>({});
  const nodeDraftVersionByNodeKeyRef = useRef<Record<string, number>>({});
  const nodePositionVersionByNodeKeyRef = useRef<Record<string, number>>({});
  const nodeDragOriginByNodeKeyRef = useRef<Record<string, GraphNodePosition>>({});
  const pendingDeleteNodeKeySetRef = useRef<Set<string>>(new Set());
  const pendingDeleteEdgeKeySetRef = useRef<Set<string>>(new Set());
  const deletedNodeKeySetRef = useRef<Set<string>>(new Set());

  const graphCameraKey = toGraphCacheKey(session.sessionId, session.activeGraph.id);
  const camera = cameraByGraphKey[graphCameraKey] ?? DEFAULT_CAMERA;
  const graphNodesState = nodesByGraphKey[graphCameraKey] ?? buildInitialGraphNodesState();
  const graphEdgesState = edgesByGraphKey[graphCameraKey] ?? buildInitialGraphEdgesState();
  const projectedNodes = graphNodesState.nodes.map((node) =>
    projectGraphNodeSummaryWithDraft(
      node,
      nodeDraftByNodeKey[toNodeCacheKey(session.sessionId, session.activeGraph.id, node.id)],
    ),
  );
  const selectedNodeIds = useMemo(
    () =>
      graphNodesState.status === 'ready'
        ? reconcileSelectedNodeIds(selectedNodeIdsByGraphKey[graphCameraKey], projectedNodes)
        : EMPTY_SELECTED_NODE_IDS,
    [graphCameraKey, graphNodesState.status, projectedNodes, selectedNodeIdsByGraphKey],
  );
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] ?? null : null;
  const selectedEdgeId = reconcileSelectedEdgeId(selectedEdgeIdByGraphKey[graphCameraKey], graphEdgesState.edges);
  const selectedNode = projectedNodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = graphEdgesState.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const ordinaryProjectedNodes = useMemo(
    () => projectedNodes.filter((node) => !node.isSystem),
    [projectedNodes],
  );
  const selectedOrdinaryNodes = useMemo(() => {
    if (selectedNodeIds.length === 0) {
      return [] as GraphNodeSummary[];
    }

    const selectedNodeIdSet = new Set(selectedNodeIds);

    return projectedNodes.filter((node) => !node.isSystem && selectedNodeIdSet.has(node.id));
  }, [projectedNodes, selectedNodeIds]);
  const autoLayoutTargetNodes = selectedOrdinaryNodes.length > 0 ? selectedOrdinaryNodes : ordinaryProjectedNodes;
  const autoLayoutScopeLabel =
    selectedOrdinaryNodes.length > 0 ? zhCN.workspace.autoLayoutSelected : zhCN.workspace.autoLayoutAll;
  const autoLayoutDisabled = isAutoLayouting || autoLayoutTargetNodes.length < 2;
  const shouldRenderAutoLayoutButton = ordinaryProjectedNodes.length > 1 || selectedOrdinaryNodes.length > 0;
  const autoLayoutButtonTitle = isAutoLayouting
    ? zhCN.workspace.autoLayoutRunning
    : autoLayoutDisabled
      ? `${autoLayoutScopeLabel} · ${zhCN.workspace.autoLayoutDisabled}`
      : autoLayoutScopeLabel;
  const selectableRailNode = selectedNode && !selectedNode.isSystem ? selectedNode : null;
  const drawerNodeId =
    graphNodesState.status === 'ready'
      ? reconcileSelectedNodeId(drawerNodeIdByGraphKey[graphCameraKey], projectedNodes)
      : null;
  const drawerNode = projectedNodes.find((node) => node.id === drawerNodeId) ?? null;
  const selectableSelectedNode = drawerNode && !drawerNode.isSystem ? drawerNode : null;
  const selectedNodeCacheKey =
    drawerNodeId && selectableSelectedNode
      ? toNodeCacheKey(session.sessionId, session.activeGraph.id, drawerNodeId)
      : null;
  const selectedNodeDetail = selectedNodeCacheKey ? nodeDetailByNodeKey[selectedNodeCacheKey] ?? null : null;
  const selectedNodeDraft = selectedNodeCacheKey ? nodeDraftByNodeKey[selectedNodeCacheKey] ?? null : null;
  const selectedNodeLoadState = selectedNodeCacheKey
    ? nodeDetailLoadStateByNodeKey[selectedNodeCacheKey] ?? { status: 'idle', error: null }
    : { status: 'idle', error: null };
  const selectedNodeSaveState = selectedNodeCacheKey
    ? nodeSaveStateByNodeKey[selectedNodeCacheKey] ?? buildIdleNodeSaveState()
    : buildIdleNodeSaveState();
  const selectedNodeDetailAssetBindings = selectedNodeDetail?.assetBindings ?? [];
  const selectedNodeAssetRoleOptions = selectedNodeDetail?.assetRoleOptions ?? [];
  const selectedNodePrimaryAsset = applyRolePriority(selectedNodeDetailAssetBindings);
  const assetSearchState = selectedNodeCacheKey
    ? assetSearchByNodeKey[selectedNodeCacheKey] ??
      buildIdleAssetSearchState(selectedNodeAssetRoleOptions[0]?.role ?? '')
    : buildIdleAssetSearchState();
  const relationTypeOptionsState =
    relationTypeOptionsByGraphKey[graphCameraKey] ?? buildInitialRelationTypeOptionsState();
  const relationComposerState = selectedNodeCacheKey
    ? relationComposerByNodeKey[selectedNodeCacheKey] ??
      buildInitialRelationComposerState(relationTypeOptionsState.options[0]?.edgeType ?? '')
    : buildInitialRelationComposerState();
  const selectedNodeRelations =
    selectedNodeId != null ? splitNodeRelations(graphEdgesState.edges, selectedNodeId) : { incoming: [], outgoing: [] };
  const visibleEdges = filterRenderableEdges(
    filterVisibleEdges(graphEdgesState.edges, selectedEdgeId, selectedNodeId, camera),
    projectedNodes,
  );
  const selectionSummary = selectedEdge
    ? formatSelectedEdgeSummary(selectedEdge, projectedNodes)
    : selectedNodeIds.length > 1
      ? formatSelectedNodeCountSummary(selectedNodeIds.length)
      : formatSelectedNodeSummary(selectableRailNode);
  const nodeTypeOptionsState = nodeTypeOptionsByGraphKey[graphCameraKey] ?? {
    status: 'loading',
    options: [],
    error: null,
  };
  const filteredNodeTypeOptionsState = {
    ...nodeTypeOptionsState,
    options: filterProducerNodeTypeOptionsForLayer(
      session.activeGraph.layerType,
      nodeTypeOptionsState.options,
    ),
  };
  const drawerWidth = resolveDrawerWidth(viewportWidth);

  useEffect(() => {
    setWorkspaceMessage(null);
  }, [session.activeGraph.id, session.sessionId]);

  useLayoutEffect(() => {
    const workspaceCanvas = workspaceCanvasRef.current;

    if (!workspaceCanvas) {
      return;
    }

    const syncOcclusionInsets = () => {
      const canvasBounds = workspaceCanvas.getBoundingClientRect();
      const topbarBounds = workspaceTopbarRef.current?.getBoundingClientRect();
      const nextInsets: CanvasOcclusionInsets = {
        top: topbarBounds ? Math.max(0, topbarBounds.bottom - canvasBounds.top) : 0,
        right: 0,
        bottom: 0,
      };

      setCanvasOcclusionInsets((current) =>
        current.top === nextInsets.top &&
        current.right === nextInsets.right &&
        current.bottom === nextInsets.bottom
          ? current
          : nextInsets,
      );
    };

    syncOcclusionInsets();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncOcclusionInsets) : null;

    resizeObserver?.observe(workspaceCanvas);

    if (workspaceTopbarRef.current) {
      resizeObserver?.observe(workspaceTopbarRef.current);
    }

    window.addEventListener('resize', syncOcclusionInsets);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncOcclusionInsets);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setMediaIndexState(buildLoadingMediaIndexState());

    void (async () => {
      try {
        const summary = await bridge.get_project_media_index_summary({
          sessionId: session.sessionId,
        });

        if (cancelled) {
          return;
        }

        if (shouldRefreshMediaIndex(summary)) {
          setMediaIndexState({
            error: null,
            status: 'refreshing',
            summary,
          });

          try {
            const refreshedSummary = await bridge.refresh_project_media_index({
              sessionId: session.sessionId,
              reason: 'startup',
            });

            if (cancelled) {
              return;
            }

            setMediaIndexState({
              error: null,
              status: 'ready',
              summary: refreshedSummary,
            });
          } catch (error) {
            if (cancelled) {
              return;
            }

            setMediaIndexState({
              error: normalizeError(error, zhCN.workspace.mediaIndexUnavailable),
              status: 'error',
              summary,
            });
          }

          return;
        }

        setMediaIndexState({
          error: null,
          status: 'ready',
          summary,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMediaIndexState({
          error: normalizeError(error, zhCN.workspace.mediaIndexUnavailable),
          status: 'error',
          summary: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bridge, session.projectPath, session.sessionId]);

  useEffect(() => {
    quickAddStateRef.current = quickAddState;
  }, [quickAddState]);

  useLayoutEffect(() => {
    nodesByGraphKeyRef.current = nodesByGraphKey;
  }, [nodesByGraphKey]);

  useLayoutEffect(() => {
    edgesByGraphKeyRef.current = edgesByGraphKey;
  }, [edgesByGraphKey]);

  useLayoutEffect(() => {
    relationTypeOptionsByGraphKeyRef.current = relationTypeOptionsByGraphKey;
  }, [relationTypeOptionsByGraphKey]);

  useEffect(() => {
    const pendingTimeouts = pendingSaveTimeoutByNodeKeyRef.current;

    return () => {
      Object.values(pendingTimeouts).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  useEffect(() => {
    const syncViewportWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    syncViewportWidth();
    window.addEventListener('resize', syncViewportWidth);

    return () => {
      window.removeEventListener('resize', syncViewportWidth);
    };
  }, []);

  useEffect(() => {
    if (!quickAddState || quickAddState.graphKey === graphCameraKey) {
      return;
    }

    setQuickAddState(null);
  }, [graphCameraKey, quickAddState]);

  const requestGraphNodesHydration = useEffectEvent(
    (graphKey: string, graphId: string, sessionId: string, force = false) => {
      const currentGraphNodes = nodesByGraphKeyRef.current[graphKey];
      const inFlightRequestId = nodeHydrationInFlightByGraphKeyRef.current[graphKey];

      if (
        !force &&
        currentGraphNodes &&
        !currentGraphNodes.pendingHydration &&
        currentGraphNodes.status !== 'loading'
      ) {
        return;
      }

      if (typeof inFlightRequestId === 'number') {
        if (!currentGraphNodes || currentGraphNodes.requestId === inFlightRequestId) {
          return;
        }

        delete nodeHydrationInFlightByGraphKeyRef.current[graphKey];
      }

      const requestId = (currentGraphNodes?.requestId ?? 0) + 1;
      const mutationRevisionAtRequestStart = currentGraphNodes?.mutationRevision ?? 0;

      nodeHydrationInFlightByGraphKeyRef.current[graphKey] = requestId;
      setNodesByGraphKey((current) => {
        const nextCurrentGraphNodes = current[graphKey] ?? buildInitialGraphNodesState();

        return {
          ...current,
          [graphKey]: {
            ...nextCurrentGraphNodes,
            error: null,
            pendingHydration: false,
            requestId,
            status: nextCurrentGraphNodes.nodes.length > 0 ? 'ready' : 'loading',
          },
        };
      });

      void bridge
        .list_graph_nodes({
          sessionId,
          graphId,
        })
        .then((nodes) => {
          const shouldRetryHydration =
            nodesByGraphKeyRef.current[graphKey]?.requestId === requestId &&
            nodesByGraphKeyRef.current[graphKey]?.mutationRevision !== mutationRevisionAtRequestStart;

          setNodesByGraphKey((current) => {
            const nextCurrentGraphNodes = current[graphKey];

            if (!nextCurrentGraphNodes || nextCurrentGraphNodes.requestId !== requestId) {
              return current;
            }

            if (shouldRetryHydration) {
              return {
                ...current,
                [graphKey]: {
                  ...nextCurrentGraphNodes,
                  error: null,
                  pendingHydration: true,
                },
              };
            }

            return {
              ...current,
              [graphKey]: {
                ...nextCurrentGraphNodes,
                pendingHydration: false,
                requestId,
                status: 'ready',
                nodes,
                error: null,
              },
            };
          });

          if (nodeHydrationInFlightByGraphKeyRef.current[graphKey] === requestId) {
            delete nodeHydrationInFlightByGraphKeyRef.current[graphKey];
          }

          if (shouldRetryHydration) {
            requestGraphNodesHydration(graphKey, graphId, sessionId, true);
          }
        })
        .catch((error) => {
          setNodesByGraphKey((current) => {
            const nextCurrentGraphNodes = current[graphKey];

            if (!nextCurrentGraphNodes || nextCurrentGraphNodes.requestId !== requestId) {
              return current;
            }

            return {
              ...current,
              [graphKey]: {
                ...nextCurrentGraphNodes,
                pendingHydration: false,
                requestId,
                status: 'error',
                nodes: nextCurrentGraphNodes.nodes,
                error: normalizeError(error, zhCN.workspace.nodeIndexUnavailable),
              },
            };
          });

          if (nodeHydrationInFlightByGraphKeyRef.current[graphKey] === requestId) {
            delete nodeHydrationInFlightByGraphKeyRef.current[graphKey];
          }
        });
    },
  );

  const requestGraphEdgesHydration = useEffectEvent(
    (graphKey: string, graphId: string, sessionId: string, force = false) => {
      const currentGraphEdges = edgesByGraphKeyRef.current[graphKey];
      const inFlightRequestId = edgeHydrationInFlightByGraphKeyRef.current[graphKey];

      if (
        !force &&
        currentGraphEdges &&
        !currentGraphEdges.pendingHydration &&
        currentGraphEdges.status !== 'loading'
      ) {
        return;
      }

      if (typeof inFlightRequestId === 'number') {
        if (!currentGraphEdges || currentGraphEdges.requestId === inFlightRequestId) {
          return;
        }

        delete edgeHydrationInFlightByGraphKeyRef.current[graphKey];
      }

      const requestId = (currentGraphEdges?.requestId ?? 0) + 1;
      const mutationRevisionAtRequestStart = currentGraphEdges?.mutationRevision ?? 0;

      edgeHydrationInFlightByGraphKeyRef.current[graphKey] = requestId;
      setEdgesByGraphKey((current) => {
        const nextCurrentGraphEdges = current[graphKey] ?? buildInitialGraphEdgesState();

        return {
          ...current,
          [graphKey]: {
            ...nextCurrentGraphEdges,
            error: null,
            pendingHydration: false,
            requestId,
            status: nextCurrentGraphEdges.edges.length > 0 ? 'ready' : 'loading',
          },
        };
      });

      void bridge
        .list_graph_edges({
          sessionId,
          graphId,
        })
        .then((edges) => {
          const shouldRetryHydration =
            edgesByGraphKeyRef.current[graphKey]?.requestId === requestId &&
            edgesByGraphKeyRef.current[graphKey]?.mutationRevision !== mutationRevisionAtRequestStart;

          setEdgesByGraphKey((current) => {
            const nextCurrentGraphEdges = current[graphKey];

            if (!nextCurrentGraphEdges || nextCurrentGraphEdges.requestId !== requestId) {
              return current;
            }

            if (shouldRetryHydration) {
              return {
                ...current,
                [graphKey]: {
                  ...nextCurrentGraphEdges,
                  error: null,
                  pendingHydration: true,
                },
              };
            }

            return {
              ...current,
              [graphKey]: {
                ...nextCurrentGraphEdges,
                pendingHydration: false,
                requestId,
                status: 'ready',
                edges,
                error: null,
              },
            };
          });

          if (edgeHydrationInFlightByGraphKeyRef.current[graphKey] === requestId) {
            delete edgeHydrationInFlightByGraphKeyRef.current[graphKey];
          }

          if (shouldRetryHydration) {
            requestGraphEdgesHydration(graphKey, graphId, sessionId, true);
          }
        })
        .catch((error) => {
          setEdgesByGraphKey((current) => {
            const nextCurrentGraphEdges = current[graphKey];

            if (!nextCurrentGraphEdges || nextCurrentGraphEdges.requestId !== requestId) {
              return current;
            }

            return {
              ...current,
              [graphKey]: {
                ...nextCurrentGraphEdges,
                pendingHydration: false,
                requestId,
                status: 'error',
                edges: nextCurrentGraphEdges.edges,
                error: normalizeError(error, zhCN.workspace.nodeIndexUnavailable),
              },
            };
          });

          if (edgeHydrationInFlightByGraphKeyRef.current[graphKey] === requestId) {
            delete edgeHydrationInFlightByGraphKeyRef.current[graphKey];
          }
        });
    },
  );

  const requestGraphRelationTypeHydration = useEffectEvent(
    (graphKey: string, graphId: string, sessionId: string, force = false) => {
      const currentGraphRelationTypes = relationTypeOptionsByGraphKeyRef.current[graphKey];
      const inFlightRequestId = relationTypeHydrationInFlightByGraphKeyRef.current[graphKey];

      if (
        !force &&
        currentGraphRelationTypes &&
        !currentGraphRelationTypes.pendingHydration &&
        currentGraphRelationTypes.status !== 'loading'
      ) {
        return;
      }

      if (typeof inFlightRequestId === 'number') {
        if (!currentGraphRelationTypes || currentGraphRelationTypes.requestId === inFlightRequestId) {
          return;
        }

        delete relationTypeHydrationInFlightByGraphKeyRef.current[graphKey];
      }

      const requestId = (currentGraphRelationTypes?.requestId ?? 0) + 1;

      relationTypeHydrationInFlightByGraphKeyRef.current[graphKey] = requestId;
      setRelationTypeOptionsByGraphKey((current) => {
        const nextCurrentRelationTypes =
          current[graphKey] ?? buildInitialRelationTypeOptionsState();

        return {
          ...current,
          [graphKey]: {
            ...nextCurrentRelationTypes,
            error: null,
            pendingHydration: false,
            requestId,
            status: nextCurrentRelationTypes.options.length > 0 ? 'ready' : 'loading',
          },
        };
      });

      void bridge
        .list_graph_relation_type_options({
          sessionId,
          graphId,
        })
        .then((options) => {
          setRelationTypeOptionsByGraphKey((current) => {
            const nextCurrentRelationTypes = current[graphKey];

            if (!nextCurrentRelationTypes || nextCurrentRelationTypes.requestId !== requestId) {
              return current;
            }

            return {
              ...current,
              [graphKey]: {
                ...nextCurrentRelationTypes,
                pendingHydration: false,
                requestId,
                status: 'ready',
                options,
                error: null,
              },
            };
          });

          if (relationTypeHydrationInFlightByGraphKeyRef.current[graphKey] === requestId) {
            delete relationTypeHydrationInFlightByGraphKeyRef.current[graphKey];
          }
        })
        .catch((error) => {
          setRelationTypeOptionsByGraphKey((current) => {
            const nextCurrentRelationTypes = current[graphKey];

            if (!nextCurrentRelationTypes || nextCurrentRelationTypes.requestId !== requestId) {
              return current;
            }

            return {
              ...current,
              [graphKey]: {
                ...nextCurrentRelationTypes,
                pendingHydration: false,
                requestId,
                status: 'error',
                options: nextCurrentRelationTypes.options,
                error: normalizeError(error, '无法加载关系类型。'),
              },
            };
          });

          if (relationTypeHydrationInFlightByGraphKeyRef.current[graphKey] === requestId) {
            delete relationTypeHydrationInFlightByGraphKeyRef.current[graphKey];
          }
        });
    },
  );

  useEffect(() => {
    requestGraphNodesHydration(graphCameraKey, session.activeGraph.id, session.sessionId);
  }, [graphCameraKey, session.activeGraph.id, session.sessionId]);

  useEffect(() => {
    requestGraphEdgesHydration(graphCameraKey, session.activeGraph.id, session.sessionId);
  }, [graphCameraKey, session.activeGraph.id, session.sessionId]);

  useEffect(() => {
    requestGraphRelationTypeHydration(graphCameraKey, session.activeGraph.id, session.sessionId);
  }, [graphCameraKey, session.activeGraph.id, session.sessionId]);

  useLayoutEffect(() => {
    const previousGraphKey = previousGraphCameraKeyRef.current;
    previousGraphCameraKeyRef.current = graphCameraKey;

    if (!previousGraphKey || previousGraphKey === graphCameraKey) {
      return;
    }

    const previousGraphNodes = nodesByGraphKeyRef.current[previousGraphKey];
    const previousGraphEdges = edgesByGraphKeyRef.current[previousGraphKey];
    const previousGraphRelationTypes = relationTypeOptionsByGraphKeyRef.current[previousGraphKey];
    const inFlightNodeRequestId = nodeHydrationInFlightByGraphKeyRef.current[previousGraphKey];
    const inFlightEdgeRequestId = edgeHydrationInFlightByGraphKeyRef.current[previousGraphKey];
    const inFlightRelationTypeRequestId =
      relationTypeHydrationInFlightByGraphKeyRef.current[previousGraphKey];

    if (
      previousGraphNodes &&
      (typeof inFlightNodeRequestId === 'number' ||
        previousGraphNodes.pendingHydration ||
        previousGraphNodes.status !== 'ready')
    ) {
      delete nodeHydrationInFlightByGraphKeyRef.current[previousGraphKey];
      setNodesByGraphKey((current) => {
        const currentGraphNodes = current[previousGraphKey];

        if (!currentGraphNodes) {
          return current;
        }

        return {
          ...current,
          [previousGraphKey]: {
            ...currentGraphNodes,
            pendingHydration: true,
            requestId: currentGraphNodes.requestId + 1,
          },
        };
      });
    }

    if (
      previousGraphEdges &&
      (typeof inFlightEdgeRequestId === 'number' ||
        previousGraphEdges.pendingHydration ||
        previousGraphEdges.status !== 'ready')
    ) {
      delete edgeHydrationInFlightByGraphKeyRef.current[previousGraphKey];
      setEdgesByGraphKey((current) => {
        const currentGraphEdges = current[previousGraphKey];

        if (!currentGraphEdges) {
          return current;
        }

        return {
          ...current,
          [previousGraphKey]: {
            ...currentGraphEdges,
            pendingHydration: true,
            requestId: currentGraphEdges.requestId + 1,
          },
        };
      });
    }

    if (
      previousGraphRelationTypes &&
      (typeof inFlightRelationTypeRequestId === 'number' ||
        previousGraphRelationTypes.pendingHydration ||
        previousGraphRelationTypes.status !== 'ready')
    ) {
      delete relationTypeHydrationInFlightByGraphKeyRef.current[previousGraphKey];
      setRelationTypeOptionsByGraphKey((current) => {
        const currentGraphRelationTypes = current[previousGraphKey];

        if (!currentGraphRelationTypes) {
          return current;
        }

        return {
          ...current,
          [previousGraphKey]: {
            ...currentGraphRelationTypes,
            pendingHydration: true,
            requestId: currentGraphRelationTypes.requestId + 1,
          },
        };
      });
    }
  }, [graphCameraKey]);

  useEffect(() => {
    if (graphNodesState.status !== 'ready') {
      return;
    }

    setSelectedNodeIdsByGraphKey((current) => {
      const nextSelectedNodeIds = reconcileSelectedNodeIds(current[graphCameraKey], graphNodesState.nodes);

      if (areStringArraysEqual(current[graphCameraKey] ?? [], nextSelectedNodeIds)) {
        return current;
      }

      return {
        ...current,
        [graphCameraKey]: nextSelectedNodeIds,
      };
    });
  }, [graphCameraKey, graphNodesState.nodes, graphNodesState.status]);

  useEffect(() => {
    setSelectedEdgeIdByGraphKey((current) => {
      const nextSelectedEdgeId = reconcileSelectedEdgeId(current[graphCameraKey], graphEdgesState.edges);

      if ((current[graphCameraKey] ?? null) === nextSelectedEdgeId) {
        return current;
      }

      return {
        ...current,
        [graphCameraKey]: nextSelectedEdgeId,
      };
    });
  }, [graphCameraKey, graphEdgesState.edges]);

  const selectedNodeIsSystem = Boolean(selectedNode?.isSystem);

  useEffect(() => {
    if (!selectedNodeId || selectedNodeIsSystem) {
      setDrawerNodeIdByGraphKey((current) => ({
        ...current,
        [graphCameraKey]: null,
      }));

      return;
    }

    setDrawerNodeIdByGraphKey((current) =>
      current[graphCameraKey] === selectedNodeId
        ? current
        : {
            ...current,
            [graphCameraKey]: selectedNodeId,
          },
    );
  }, [graphCameraKey, selectedNodeId, selectedNodeIsSystem]);

  useEffect(() => {
    if (!selectedNodeCacheKey || !selectedNodeDetail || selectedNodeDraft) {
      return;
    }

    setNodeDraftByNodeKey((current) => {
      if (current[selectedNodeCacheKey]) {
        return current;
      }

      return {
        ...current,
        [selectedNodeCacheKey]: extractGraphNodePayload(selectedNodeDetail),
      };
    });
    setNodeSaveStateByNodeKey((current) => {
      if (current[selectedNodeCacheKey]) {
        return current;
      }

      return {
        ...current,
        [selectedNodeCacheKey]: buildIdleNodeSaveState(),
      };
    });
  }, [selectedNodeCacheKey, selectedNodeDetail, selectedNodeDraft]);

  useEffect(() => {
    if (!selectedNodeCacheKey || !selectedNodeDetail) {
      return;
    }

    setAssetSearchByNodeKey((current) => {
      if (current[selectedNodeCacheKey]) {
        return current;
      }

      return {
        ...current,
        [selectedNodeCacheKey]: buildIdleAssetSearchState(
          selectedNodeDetail.assetRoleOptions?.[0]?.role ?? '',
        ),
      };
    });
  }, [selectedNodeCacheKey, selectedNodeDetail]);

  useEffect(() => {
    if (!selectedNodeCacheKey) {
      return;
    }

    setRelationComposerByNodeKey((current) => {
      if (current[selectedNodeCacheKey]) {
        return current;
      }

      return {
        ...current,
        [selectedNodeCacheKey]: buildInitialRelationComposerState(
          relationTypeOptionsState.options[0]?.edgeType ?? '',
        ),
      };
    });
  }, [relationTypeOptionsState.options, selectedNodeCacheKey]);

  useEffect(() => {
    if (!selectedNodeCacheKey || !selectedNodeId || graphNodesState.status !== 'ready' || selectedNodeDetail) {
      return;
    }

    let cancelled = false;

    setNodeDetailLoadStateByNodeKey((current) => {
      if (current[selectedNodeCacheKey]?.status === 'loading') {
        return current;
      }

      return {
        ...current,
        [selectedNodeCacheKey]: {
          status: 'loading',
          error: null,
        },
      };
    });

    void (async () => {
      try {
        const detail = normalizeGraphNodeDetail(await bridge.get_graph_node_detail({
          sessionId: session.sessionId,
          graphId: session.activeGraph.id,
          nodeId: selectedNodeId,
        }));

        if (cancelled) {
          return;
        }

        setNodeDetailByNodeKey((current) => ({
          ...current,
          [selectedNodeCacheKey]: detail,
        }));
        setNodeDetailLoadStateByNodeKey((current) => ({
          ...current,
          [selectedNodeCacheKey]: {
            status: 'ready',
            error: null,
          },
        }));
        setNodeDraftByNodeKey((current) => {
          if (current[selectedNodeCacheKey]) {
            return current;
          }

          return {
            ...current,
            [selectedNodeCacheKey]: extractGraphNodePayload(detail),
          };
        });
        setNodeSaveStateByNodeKey((current) => {
          if (current[selectedNodeCacheKey]) {
            return current;
          }

          return {
            ...current,
            [selectedNodeCacheKey]: buildIdleNodeSaveState(),
          };
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setNodeDetailLoadStateByNodeKey((current) => ({
          ...current,
          [selectedNodeCacheKey]: {
            status: 'error',
            error: normalizeError(error, zhCN.drawer.loadErrorBody),
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bridge,
    graphNodesState.status,
    selectedNodeCacheKey,
    selectedNodeDetail,
    selectedNodeId,
    session.activeGraph.id,
    session.sessionId,
  ]);

  useEffect(() => {
    if (!selectedNodeCacheKey) {
      return;
    }

    if (!assetSearchState.query.trim()) {
      return;
    }

    let cancelled = false;

    setAssetSearchByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState()),
        status: 'loading',
        error: null,
      },
    }));

    void (async () => {
      try {
        const assets = await bridge.list_project_assets({
          sessionId: session.sessionId,
          query: assetSearchState.query,
          limit: 20,
          mediaType: assetSearchState.mediaType,
        });

        if (cancelled) {
          return;
        }

        setAssetSearchByNodeKey((current) => ({
          ...current,
          [selectedNodeCacheKey]: {
            ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState()),
            assets,
            error: null,
            status: 'ready',
          },
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAssetSearchByNodeKey((current) => ({
          ...current,
          [selectedNodeCacheKey]: {
            ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState()),
            assets: [],
            error: normalizeError(error, zhCN.drawer.assetSearchError),
            status: 'error',
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetSearchState.mediaType, assetSearchState.query, bridge, selectedNodeCacheKey, session.sessionId]);

  function clearPendingNodeSave(nodeKey: string) {
    const timeoutId = pendingSaveTimeoutByNodeKeyRef.current[nodeKey];

    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
      delete pendingSaveTimeoutByNodeKeyRef.current[nodeKey];
    }
  }

  function removeGraphNodeSummary(graphKey: string, nodeId: string) {
    setNodesByGraphKey((current) => {
      const currentGraphNodes = current[graphKey];

      if (!currentGraphNodes || !currentGraphNodes.nodes.some((node) => node.id === nodeId)) {
        return current;
      }

      return {
        ...current,
        [graphKey]: {
          ...currentGraphNodes,
          mutationRevision: currentGraphNodes.mutationRevision + 1,
          status: 'ready',
          error: null,
          nodes: currentGraphNodes.nodes.filter((node) => node.id !== nodeId),
        },
      };
    });
    setEdgesByGraphKey((current) => {
      const currentGraphEdges = current[graphKey];

      if (
        !currentGraphEdges ||
        !currentGraphEdges.edges.some(
          (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
        )
      ) {
        return current;
      }

      return {
        ...current,
        [graphKey]: {
          ...currentGraphEdges,
          mutationRevision: currentGraphEdges.mutationRevision + 1,
          status: 'ready',
          error: null,
          edges: currentGraphEdges.edges.filter(
            (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
          ),
        },
      };
    });
  }

  function clearDeletedNodeState(nodeKey: string, deletedGraphIds: readonly string[]) {
    clearPendingNodeSave(nodeKey);
    delete nodeDraftVersionByNodeKeyRef.current[nodeKey];
    delete nodePositionVersionByNodeKeyRef.current[nodeKey];
    delete nodeDragOriginByNodeKeyRef.current[nodeKey];

    const deletedGraphKeys = deletedGraphIds.map((graphId) =>
      toGraphCacheKey(session.sessionId, graphId),
    );
    const deletedNodeKeyPrefixes = deletedGraphIds.map(
      (graphId) => `${session.sessionId}:${graphId}:`,
    );

    setNodeDetailByNodeKey((current) =>
      omitRecordEntriesByPrefix(omitRecordKeys(current, [nodeKey]), deletedNodeKeyPrefixes),
    );
    setNodeDetailLoadStateByNodeKey((current) =>
      omitRecordEntriesByPrefix(omitRecordKeys(current, [nodeKey]), deletedNodeKeyPrefixes),
    );
    setNodeDraftByNodeKey((current) =>
      omitRecordEntriesByPrefix(omitRecordKeys(current, [nodeKey]), deletedNodeKeyPrefixes),
    );
    setNodeSaveStateByNodeKey((current) =>
      omitRecordEntriesByPrefix(omitRecordKeys(current, [nodeKey]), deletedNodeKeyPrefixes),
    );
    setAssetSearchByNodeKey((current) =>
      omitRecordEntriesByPrefix(omitRecordKeys(current, [nodeKey]), deletedNodeKeyPrefixes),
    );
    setRelationComposerByNodeKey((current) =>
      omitRecordEntriesByPrefix(omitRecordKeys(current, [nodeKey]), deletedNodeKeyPrefixes),
    );
    setCameraByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setNodesByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setEdgesByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setSelectedNodeIdsByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setSelectedEdgeIdByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setDrawerNodeIdByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setNewlyCreatedNodeIdByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setNodeTypeOptionsByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));
    setRelationTypeOptionsByGraphKey((current) => omitRecordKeys(current, deletedGraphKeys));

    for (const graphKey of deletedGraphKeys) {
      delete nodeHydrationInFlightByGraphKeyRef.current[graphKey];
      delete edgeHydrationInFlightByGraphKeyRef.current[graphKey];
      delete relationTypeHydrationInFlightByGraphKeyRef.current[graphKey];
    }

    for (const prefix of deletedNodeKeyPrefixes) {
      for (const existingNodeKey of Object.keys(pendingSaveTimeoutByNodeKeyRef.current)) {
        if (existingNodeKey.startsWith(prefix)) {
          clearPendingNodeSave(existingNodeKey);
        }
      }

      for (const record of [
        nodeDraftVersionByNodeKeyRef.current,
        nodePositionVersionByNodeKeyRef.current,
        nodeDragOriginByNodeKeyRef.current,
      ]) {
        for (const existingNodeKey of Object.keys(record)) {
          if (existingNodeKey.startsWith(prefix)) {
            delete record[existingNodeKey];
          }
        }
      }
    }
  }

  function upsertGraphNodeSummary(graphKey: string, summary: GraphNodeSummary) {
    setNodesByGraphKey((current) => {
      const currentGraphNodes = current[graphKey] ?? buildInitialGraphNodesState();
      const existingIndex = currentGraphNodes.nodes.findIndex((node) => node.id === summary.id);
      const normalizedSummary =
        existingIndex >= 0
          ? {
              ...summary,
              isSystem: summary.isSystem || currentGraphNodes.nodes[existingIndex]?.isSystem,
              canEnterChildGraph:
                summary.canEnterChildGraph || currentGraphNodes.nodes[existingIndex]?.canEnterChildGraph,
            }
          : summary;
      const nextNodes =
        existingIndex >= 0
          ? currentGraphNodes.nodes.map((node) => (node.id === summary.id ? normalizedSummary : node))
          : [...currentGraphNodes.nodes, normalizedSummary];

      return {
        ...current,
        [graphKey]: {
          ...currentGraphNodes,
          mutationRevision: currentGraphNodes.mutationRevision + 1,
          status: 'ready',
          nodes: nextNodes,
          error: null,
        },
      };
    });
  }

  function updateCachedNodePosition(identity: CachedNodeIdentity, position: GraphNodePosition) {
    setNodesByGraphKey((current) => {
      const graphNodes = current[identity.graphKey];

      if (!graphNodes) {
        return current;
      }

      let changed = false;
      const nextNodes = graphNodes.nodes.map((node) => {
        if (node.id !== identity.nodeId) {
          return node;
        }

        if (node.layout.x === position.x && node.layout.y === position.y) {
          return node;
        }

        changed = true;

        return {
          ...node,
          layout: {
            ...node.layout,
            x: position.x,
            y: position.y,
          },
        };
      });

      if (!changed) {
        return current;
      }

      return {
        ...current,
        [identity.graphKey]: {
          ...graphNodes,
          mutationRevision: graphNodes.mutationRevision + 1,
          nodes: nextNodes,
        },
      };
    });
    setNodeDetailByNodeKey((current) => {
      const detail = current[identity.nodeKey];

      if (!detail) {
        return current;
      }

      if (detail.layout.x === position.x && detail.layout.y === position.y) {
        return current;
      }

      return {
        ...current,
        [identity.nodeKey]: {
          ...detail,
          layout: {
            ...detail.layout,
            x: position.x,
            y: position.y,
          },
        },
      };
    });
  }

  function cachePersistedNodeSummary(identity: CachedNodeIdentity, summary: GraphNodeSummary) {
    upsertGraphNodeSummary(identity.graphKey, summary);
    setNodeDetailByNodeKey((current) => {
      const detail = current[identity.nodeKey];

      if (!detail) {
        return current;
      }

      return {
        ...current,
        [identity.nodeKey]: {
          ...detail,
          ...summary,
          layout: {
            ...detail.layout,
            ...summary.layout,
          },
        },
      };
    });
  }

  function cachePersistedNode(identity: CachedNodeIdentity, detail: GraphNodeDetail) {
    const existingSummary =
      nodesByGraphKeyRef.current[identity.graphKey]?.nodes.find((node) => node.id === detail.id) ?? null;
    const nextSummary: GraphNodeSummary = {
      ...detail,
      isSystem: Boolean(detail.isSystem) || Boolean(existingSummary?.isSystem),
      canEnterChildGraph:
        Boolean(detail.canEnterChildGraph) || Boolean(existingSummary?.canEnterChildGraph),
    };
    const nextDraft = extractGraphNodePayload(detail);

    upsertGraphNodeSummary(identity.graphKey, nextSummary);
    setNodeDetailByNodeKey((current) => ({
      ...current,
      [identity.nodeKey]: {
        ...detail,
        ...nextSummary,
      },
    }));
    setNodeDetailLoadStateByNodeKey((current) => ({
      ...current,
      [identity.nodeKey]: {
        status: 'ready',
        error: null,
      },
    }));
    setNodeDraftByNodeKey((current) => ({
      ...current,
      [identity.nodeKey]: nextDraft,
    }));
    setNodeSaveStateByNodeKey((current) => ({
      ...current,
      [identity.nodeKey]: {
        error: null,
        inFlightVersion: null,
        latestVersion: nodeDraftVersionByNodeKeyRef.current[identity.nodeKey] ?? 0,
        status: 'idle',
      },
    }));
  }

  function upsertGraphEdgeSummary(graphKey: string, edge: GraphEdgeSummary) {
    setEdgesByGraphKey((current) => {
      const currentGraphEdges = current[graphKey] ?? buildInitialGraphEdgesState();
      const existingIndex = currentGraphEdges.edges.findIndex((currentEdge) => currentEdge.id === edge.id);
      const nextEdges =
        existingIndex >= 0
          ? currentGraphEdges.edges.map((currentEdge) => (currentEdge.id === edge.id ? edge : currentEdge))
          : [...currentGraphEdges.edges, edge];

      return {
        ...current,
        [graphKey]: {
          ...currentGraphEdges,
          mutationRevision: currentGraphEdges.mutationRevision + 1,
          status: 'ready',
          edges: nextEdges,
          error: null,
        },
      };
    });
  }

  function findCachedGraphEdgeSummary({
    edgeType,
    graphKey,
    sourceNodeId,
    targetNodeId,
  }: {
    edgeType: string;
    graphKey: string;
    sourceNodeId: string;
    targetNodeId: string;
  }): GraphEdgeSummary | null {
    return (
      edgesByGraphKeyRef.current[graphKey]?.edges.find(
        (edge) =>
          edge.sourceNodeId === sourceNodeId &&
          edge.targetNodeId === targetNodeId &&
          edge.edgeType === edgeType,
      ) ?? null
    );
  }

  async function resolveDefaultRelationTypeForGraph({
    graphId,
    graphKey,
    sessionId,
  }: {
    graphId: string;
    graphKey: string;
    sessionId: string;
  }): Promise<string | null> {
    const cachedDefaultType = relationTypeOptionsByGraphKeyRef.current[graphKey]?.options[0]?.edgeType?.trim() ?? '';

    if (cachedDefaultType) {
      return cachedDefaultType;
    }

    try {
      const options = await bridge.list_graph_relation_type_options({
        sessionId,
        graphId,
      });

      setRelationTypeOptionsByGraphKey((current) => ({
        ...current,
        [graphKey]: {
          ...(current[graphKey] ?? buildInitialRelationTypeOptionsState()),
          status: 'ready',
          options,
          error: null,
        },
      }));

      return options[0]?.edgeType?.trim() || null;
    } catch (error) {
      setRelationTypeOptionsByGraphKey((current) => ({
        ...current,
        [graphKey]: {
          ...(current[graphKey] ?? buildInitialRelationTypeOptionsState()),
          status: 'error',
          options: [],
          error: normalizeError(error, '无法加载关系类型。'),
        },
      }));

      return null;
    }
  }

  async function autoConnectNewShotLabNodeToSystemAnchor({
    graphId,
    graphKey,
    nodeId,
    sessionId,
  }: {
    graphId: string;
    graphKey: string;
    nodeId: string;
    sessionId: string;
  }) {
    const anchorNode =
      nodesByGraphKeyRef.current[graphKey]?.nodes.find(
        (node) => node.isSystem && node.nodeType === 'system_anchor',
      ) ?? null;

    if (!anchorNode) {
      return;
    }

    const edgeAlreadyExists =
      edgesByGraphKeyRef.current[graphKey]?.edges.some(
        (edge) => edge.sourceNodeId === anchorNode.id && edge.targetNodeId === nodeId,
      ) ?? false;

    if (edgeAlreadyExists) {
      return;
    }

    const defaultRelationType = await resolveDefaultRelationTypeForGraph({
      graphId,
      graphKey,
      sessionId,
    });

    if (!defaultRelationType) {
      return;
    }

    await persistGraphConnection({
      connection: {
        source: anchorNode.id,
        sourceHandle: 'out',
        target: nodeId,
        targetHandle: 'in',
      },
      graphId,
      graphKey,
      sessionId,
    });
  }

  function removeGraphEdgeSummary(graphKey: string, edgeId: string) {
    setEdgesByGraphKey((current) => {
      const currentGraphEdges = current[graphKey];

      if (!currentGraphEdges) {
        return current;
      }

      return {
        ...current,
        [graphKey]: {
          ...currentGraphEdges,
          status: 'ready',
          error: null,
          mutationRevision: currentGraphEdges.mutationRevision + 1,
          edges: currentGraphEdges.edges.filter((edge) => edge.id !== edgeId),
        },
      };
    });
  }

  async function persistGraphNodeDraft(identity: CachedNodeIdentity, version: number, draft: GraphNodeDraft) {
    setNodeSaveStateByNodeKey((current) => ({
      ...current,
      [identity.nodeKey]: {
        error: null,
        inFlightVersion: version,
        latestVersion: Math.max(current[identity.nodeKey]?.latestVersion ?? 0, version),
        status: 'saving',
      },
    }));

    try {
      const detail = normalizeGraphNodeDetail(await bridge.update_graph_node_payload({
        sessionId: identity.sessionId,
        graphId: identity.graphId,
        nodeId: identity.nodeId,
        payload: draft,
      }));

      if (deletedNodeKeySetRef.current.has(identity.nodeKey)) {
        return;
      }

      if ((nodeDraftVersionByNodeKeyRef.current[identity.nodeKey] ?? 0) !== version) {
        return;
      }

      if (detail.id !== identity.nodeId || detail.graphId !== identity.graphId) {
        setNodeSaveStateByNodeKey((current) => ({
          ...current,
          [identity.nodeKey]: {
            error: null,
            inFlightVersion: null,
            latestVersion: version,
            status: 'idle',
          },
        }));

        return;
      }

      cachePersistedNode(identity, detail);
    } catch (error) {
      if (deletedNodeKeySetRef.current.has(identity.nodeKey)) {
        return;
      }

      if ((nodeDraftVersionByNodeKeyRef.current[identity.nodeKey] ?? 0) !== version) {
        return;
      }

      setNodeSaveStateByNodeKey((current) => ({
        ...current,
        [identity.nodeKey]: {
          error: normalizeError(error, zhCN.drawer.saveError),
          inFlightVersion: null,
          latestVersion: version,
          status: 'error',
        },
      }));
    }
  }

  function scheduleGraphNodeDraftSave(identity: CachedNodeIdentity, draft: GraphNodeDraft) {
    const nextVersion = (nodeDraftVersionByNodeKeyRef.current[identity.nodeKey] ?? 0) + 1;

    nodeDraftVersionByNodeKeyRef.current[identity.nodeKey] = nextVersion;
    clearPendingNodeSave(identity.nodeKey);
    setNodeSaveStateByNodeKey((current) => ({
      ...current,
      [identity.nodeKey]: {
        error: null,
        inFlightVersion: current[identity.nodeKey]?.inFlightVersion ?? null,
        latestVersion: nextVersion,
        status: 'saving',
      },
    }));
    pendingSaveTimeoutByNodeKeyRef.current[identity.nodeKey] = window.setTimeout(() => {
      delete pendingSaveTimeoutByNodeKeyRef.current[identity.nodeKey];
      void persistGraphNodeDraft(identity, nextVersion, draft);
    }, NODE_SAVE_DEBOUNCE_MS);
  }

  async function persistGraphNodePosition(
    identity: CachedNodeIdentity,
    version: number,
    position: GraphNodePosition,
    origin: GraphNodePosition,
  ) {
    try {
      const summary = await bridge.update_graph_node_position({
        sessionId: identity.sessionId,
        graphId: identity.graphId,
        nodeId: identity.nodeId,
        position,
      });

      if (deletedNodeKeySetRef.current.has(identity.nodeKey)) {
        return;
      }

      if ((nodePositionVersionByNodeKeyRef.current[identity.nodeKey] ?? 0) !== version) {
        return;
      }

      if (summary.id !== identity.nodeId || summary.graphId !== identity.graphId) {
        return;
      }

      cachePersistedNodeSummary(identity, summary);
    } catch (error) {
      if (deletedNodeKeySetRef.current.has(identity.nodeKey)) {
        return;
      }

      if ((nodePositionVersionByNodeKeyRef.current[identity.nodeKey] ?? 0) !== version) {
        return;
      }

      updateCachedNodePosition(identity, origin);
      setWorkspaceMessage(normalizeError(error, zhCN.drawer.saveError));
    }
  }

  function handleCameraChange(nextCamera: CameraState) {
    setCameraByGraphKey((current) => {
      const previousCamera = current[graphCameraKey] ?? DEFAULT_CAMERA;

      if (
        Math.abs(previousCamera.x - nextCamera.x) < 0.5 &&
        Math.abs(previousCamera.y - nextCamera.y) < 0.5 &&
        Math.abs(previousCamera.zoom - nextCamera.zoom) < 0.001
      ) {
        return current;
      }

      return {
        ...current,
        [graphCameraKey]: nextCamera,
      };
    });
  }

  function handleSelectedNodesChange(nodeIds: string[]) {
    const nextSelectedNodeIds =
      graphNodesState.status === 'ready' ? reconcileSelectedNodeIds(nodeIds, projectedNodes) : nodeIds;

    setSelectedNodeIdsByGraphKey((current) => {
      const currentNodeIds = current[graphCameraKey] ?? [];

      if (areStringArraysEqual(currentNodeIds, nextSelectedNodeIds)) {
        return current;
      }

      return {
        ...current,
        [graphCameraKey]: nextSelectedNodeIds,
      };
    });
    setSelectedEdgeIdByGraphKey((current) =>
      current[graphCameraKey] == null
        ? current
        : {
            ...current,
            [graphCameraKey]: null,
          },
    );
    if (nextSelectedNodeIds.length !== 1) {
      setDrawerNodeIdByGraphKey((current) =>
        current[graphCameraKey] == null
          ? current
          : {
              ...current,
              [graphCameraKey]: null,
            },
      );
    }

    setNewlyCreatedNodeIdByGraphKey((current) => {
      if (!current[graphCameraKey] || nodeIds.includes(current[graphCameraKey])) {
        return current;
      }

      return {
        ...current,
        [graphCameraKey]: null,
      };
    });
  }

  function handleSelectedEdgeChange(edgeId: string | null) {
    setSelectedEdgeIdByGraphKey((current) =>
      (current[graphCameraKey] ?? null) === edgeId
        ? current
        : {
            ...current,
            [graphCameraKey]: edgeId,
          },
    );

    if (edgeId === null) {
      return;
    }

    setSelectedNodeIdsByGraphKey((current) =>
      !current[graphCameraKey] || current[graphCameraKey].length === 0
        ? current
        : {
            ...current,
            [graphCameraKey]: [],
          },
    );
    setDrawerNodeIdByGraphKey((current) =>
      current[graphCameraKey] == null
        ? current
        : {
            ...current,
            [graphCameraKey]: null,
          },
    );
  }

  const handleDeleteSelectedNodes = useEffectEvent(async () => {
    if (selectedNodeIds.length === 0 || quickAddState) {
      return;
    }

    const deletableNodeIds = selectedNodeIds.filter((nodeId) => {
      const matchingNode = projectedNodes.find((node) => node.id === nodeId);

      return Boolean(matchingNode && !matchingNode.isSystem);
    });

    if (deletableNodeIds.length === 0) {
      return;
    }

    for (const nodeId of deletableNodeIds) {
      const nodeKey = toNodeCacheKey(session.sessionId, session.activeGraph.id, nodeId);

      if (pendingDeleteNodeKeySetRef.current.has(nodeKey)) {
        return;
      }

      pendingDeleteNodeKeySetRef.current.add(nodeKey);
      clearPendingNodeSave(nodeKey);

      try {
        const result = await bridge.delete_graph_node({
          sessionId: session.sessionId,
          graphId: session.activeGraph.id,
          nodeId,
        });

        pendingDeleteNodeKeySetRef.current.delete(nodeKey);
        deletedNodeKeySetRef.current.add(nodeKey);
        removeGraphNodeSummary(graphCameraKey, nodeId);
        clearDeletedNodeState(nodeKey, result.deletedGraphIds);
        setWorkspaceMessage(null);
      } catch (error) {
        pendingDeleteNodeKeySetRef.current.delete(nodeKey);
        setWorkspaceMessage(normalizeError(error, '无法删除节点。'));
        return;
      }
    }
  });

  const handleDeleteSelectedEdge = useEffectEvent(async () => {
    if (!selectedEdgeId || quickAddState) {
      return;
    }

    const edgeKey = toEdgeCacheKey(session.sessionId, session.activeGraph.id, selectedEdgeId);

    if (pendingDeleteEdgeKeySetRef.current.has(edgeKey)) {
      return;
    }

    pendingDeleteEdgeKeySetRef.current.add(edgeKey);

    try {
      await bridge.delete_graph_edge({
        sessionId: session.sessionId,
        graphId: session.activeGraph.id,
        edgeId: selectedEdgeId,
      });

      pendingDeleteEdgeKeySetRef.current.delete(edgeKey);
      removeGraphEdgeSummary(graphCameraKey, selectedEdgeId);
      setSelectedEdgeIdByGraphKey((current) =>
        current[graphCameraKey] !== selectedEdgeId
          ? current
          : {
              ...current,
              [graphCameraKey]: null,
            },
      );
      setWorkspaceMessage(null);
    } catch (error) {
      pendingDeleteEdgeKeySetRef.current.delete(edgeKey);
      setWorkspaceMessage(normalizeError(error, '无法删除关系。'));
    }
  });

  useEffect(() => {
    if (selectedNodeIds.length === 0 && !selectedEdgeId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (quickAddState) {
          return;
        }

        setSelectedNodeIdsByGraphKey((current) => ({
          ...current,
          [graphCameraKey]: [],
        }));
        setSelectedEdgeIdByGraphKey((current) => ({
          ...current,
          [graphCameraKey]: null,
        }));
        setDrawerNodeIdByGraphKey((current) => ({
          ...current,
          [graphCameraKey]: null,
        }));

        return;
      }

      if (quickAddState) {
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }

      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableHotkeyTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      if (selectedEdgeId) {
        void handleDeleteSelectedEdge();
        return;
      }

      void handleDeleteSelectedNodes();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    graphCameraKey,
    quickAddState,
    selectedEdgeId,
    selectedNodeIds,
  ]);

  function handleNodePositionPreview(nodeId: string, position: GraphNodePosition) {
    const identity: CachedNodeIdentity = {
      sessionId: session.sessionId,
      graphId: session.activeGraph.id,
      graphKey: graphCameraKey,
      nodeId,
      nodeKey: toNodeCacheKey(session.sessionId, session.activeGraph.id, nodeId),
    };
    const currentNode =
      nodesByGraphKeyRef.current[identity.graphKey]?.nodes.find((node) => node.id === nodeId) ?? null;

    if (!currentNode || currentNode.isSystem) {
      return;
    }

    if (!nodeDragOriginByNodeKeyRef.current[identity.nodeKey]) {
      nodeDragOriginByNodeKeyRef.current[identity.nodeKey] = {
        x: currentNode.layout.x,
        y: currentNode.layout.y,
      };
    }

    updateCachedNodePosition(identity, position);
  }

  async function commitNodePosition(nodeId: string, position: GraphNodePosition) {
    const identity: CachedNodeIdentity = {
      sessionId: session.sessionId,
      graphId: session.activeGraph.id,
      graphKey: graphCameraKey,
      nodeId,
      nodeKey: toNodeCacheKey(session.sessionId, session.activeGraph.id, nodeId),
    };
    const currentNode =
      nodesByGraphKeyRef.current[identity.graphKey]?.nodes.find((node) => node.id === nodeId) ?? null;

    if (!currentNode || currentNode.isSystem) {
      return;
    }

    const origin = nodeDragOriginByNodeKeyRef.current[identity.nodeKey] ?? {
      x: currentNode.layout.x,
      y: currentNode.layout.y,
    };
    const nextVersion = (nodePositionVersionByNodeKeyRef.current[identity.nodeKey] ?? 0) + 1;

    nodePositionVersionByNodeKeyRef.current[identity.nodeKey] = nextVersion;
    delete nodeDragOriginByNodeKeyRef.current[identity.nodeKey];
    await persistGraphNodePosition(identity, nextVersion, position, origin);
  }

  function handleNodePositionCommit(nodeId: string, position: GraphNodePosition) {
    void commitNodePosition(nodeId, position);
  }

  async function handleAutoLayout() {
    if (isAutoLayouting || autoLayoutTargetNodes.length < 2) {
      return;
    }

    const nextPositions = computeAutoLayout(autoLayoutTargetNodes, graphEdgesState.edges);

    if (nextPositions.length < 2) {
      return;
    }

    setIsAutoLayouting(true);

    try {
      for (const { nodeId, position } of nextPositions) {
        handleNodePositionPreview(nodeId, position);
      }

      for (const { nodeId, position } of nextPositions) {
        await commitNodePosition(nodeId, position);
      }
    } finally {
      setIsAutoLayouting(false);
    }
  }

  function handleSelectedNodeDraftChange(nextDraft: GraphNodeDraft) {
    if (!selectedNodeCacheKey || !selectedNodeId) {
      return;
    }

    setNodeDraftByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: nextDraft,
    }));
    scheduleGraphNodeDraftSave(
      {
        graphId: session.activeGraph.id,
        graphKey: graphCameraKey,
        nodeId: selectedNodeId,
        nodeKey: selectedNodeCacheKey,
        sessionId: session.sessionId,
      },
      nextDraft,
    );
  }

  function handleAssetSearchQueryChange(query: string) {
    if (!selectedNodeCacheKey) {
      return;
    }

    setAssetSearchByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState(selectedNodeAssetRoleOptions[0]?.role ?? '')),
        assets: [],
        error: null,
        query,
        status: query.trim() ? 'idle' : 'ready',
      },
    }));
  }

  function handleSelectedAssetRoleChange(role: NodeAssetRole) {
    if (!selectedNodeCacheKey) {
      return;
    }

    setAssetSearchByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState(role)),
        mediaType: resolveAssetSearchMediaType(role),
        selectedRole: role,
      },
    }));
  }

  async function handleBindNodeAsset(assetId: string) {
    if (!selectedNodeCacheKey || !selectedNodeId || !assetSearchState.selectedRole) {
      return;
    }

    setAssetSearchByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState()),
        error: null,
        status: 'loading',
      },
    }));

    try {
      if (
        selectableSelectedNode?.nodeType === 'brief' &&
        (assetSearchState.selectedRole === 'product_image' ||
          assetSearchState.selectedRole === 'example_video')
      ) {
        const bindingsToReplace = selectedNodeDetailAssetBindings.filter(
          (binding) =>
            binding.role === assetSearchState.selectedRole && binding.assetId !== assetId,
        );

        for (const binding of bindingsToReplace) {
          await bridge.unbind_node_asset({
            sessionId: session.sessionId,
            graphId: session.activeGraph.id,
            nodeId: selectedNodeId,
            assetId: binding.assetId,
            role: binding.role,
          });
        }
      }

      const detail = normalizeGraphNodeDetail(await bridge.bind_node_asset({
        sessionId: session.sessionId,
        graphId: session.activeGraph.id,
        nodeId: selectedNodeId,
        assetId,
        role: assetSearchState.selectedRole,
      }));
      const identity = {
        graphId: session.activeGraph.id,
        graphKey: graphCameraKey,
        nodeId: selectedNodeId,
        nodeKey: selectedNodeCacheKey,
        sessionId: session.sessionId,
      };

      cachePersistedNode(identity, detail);
      setAssetSearchByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ??
            buildIdleAssetSearchState(detail.assetRoleOptions?.[0]?.role ?? '')),
          assets: [],
          error: null,
          query: '',
          selectedRole:
            current[selectedNodeCacheKey]?.selectedRole &&
            (detail.assetRoleOptions ?? []).some(
              (option) => option.role === current[selectedNodeCacheKey]?.selectedRole,
            )
              ? current[selectedNodeCacheKey]!.selectedRole
              : detail.assetRoleOptions?.[0]?.role ?? '',
          status: 'ready',
        },
      }));
    } catch (error) {
      setAssetSearchByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ?? buildIdleAssetSearchState()),
          error: normalizeError(error, '无法绑定素材。'),
          status: 'error',
        },
      }));
    }
  }

  async function handleUnbindNodeAsset(binding: GraphNodeAssetBinding) {
    if (!selectedNodeCacheKey || !selectedNodeId) {
      return;
    }

    try {
      const detail = normalizeGraphNodeDetail(await bridge.unbind_node_asset({
        sessionId: session.sessionId,
        graphId: session.activeGraph.id,
        nodeId: selectedNodeId,
        assetId: binding.assetId,
        role: binding.role,
      }));
      const identity = {
        graphId: session.activeGraph.id,
        graphKey: graphCameraKey,
        nodeId: selectedNodeId,
        nodeKey: selectedNodeCacheKey,
        sessionId: session.sessionId,
      };

      cachePersistedNode(identity, detail);
    } catch (error) {
      setWorkspaceMessage(normalizeError(error, '无法解绑素材。'));
    }
  }

  function handleRelationTypeChange(edgeType: string) {
    if (!selectedNodeCacheKey) {
      return;
    }

    setRelationComposerByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState(edgeType)),
        createError: null,
        selectedType: edgeType,
      },
    }));
  }

  function handleRelationTargetChange(targetNodeId: string) {
    if (!selectedNodeCacheKey) {
      return;
    }

    setRelationComposerByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
        createError: null,
        selectedTargetNodeId: targetNodeId,
      },
    }));
  }

  async function handleCreateRelation() {
    if (!selectedNodeCacheKey || !selectedNodeId) {
      return;
    }

    if (!relationComposerState.selectedType || !relationComposerState.selectedTargetNodeId) {
      setRelationComposerByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
          createError: '请先选择关系类型和目标节点。',
        },
      }));
      return;
    }

    setRelationComposerByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
        createError: null,
        pendingSubmit: true,
      },
    }));

    try {
      const existingEdge = findCachedGraphEdgeSummary({
        edgeType: relationComposerState.selectedType,
        graphKey: graphCameraKey,
        sourceNodeId: selectedNodeId,
        targetNodeId: relationComposerState.selectedTargetNodeId,
      });

      if (existingEdge) {
        upsertGraphEdgeSummary(graphCameraKey, existingEdge);
        setRelationComposerByNodeKey((current) => ({
          ...current,
          [selectedNodeCacheKey]: {
            ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
            createError: null,
            deleteError: null,
            pendingDeleteEdgeId: null,
            pendingSubmit: false,
            selectedTargetNodeId: '',
            selectedType: current[selectedNodeCacheKey]?.selectedType ?? relationComposerState.selectedType,
          },
        }));
        return;
      }

      const edge = await bridge.create_graph_edge({
        sessionId: session.sessionId,
        graphId: session.activeGraph.id,
        sourceNodeId: selectedNodeId,
        targetNodeId: relationComposerState.selectedTargetNodeId,
        edgeType: relationComposerState.selectedType,
      });

      upsertGraphEdgeSummary(graphCameraKey, edge);
      setRelationComposerByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
          createError: null,
          deleteError: null,
          pendingDeleteEdgeId: null,
          pendingSubmit: false,
          selectedTargetNodeId: '',
          selectedType: current[selectedNodeCacheKey]?.selectedType ?? relationComposerState.selectedType,
        },
      }));
    } catch (error) {
      setRelationComposerByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
          createError: normalizeError(error, '无法创建关系。'),
          pendingSubmit: false,
        },
      }));
    }
  }

  async function handleDeleteRelation(edgeId: string) {
    if (!selectedNodeCacheKey) {
      return;
    }

    setRelationComposerByNodeKey((current) => ({
      ...current,
      [selectedNodeCacheKey]: {
        ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
        deleteError: null,
        pendingDeleteEdgeId: edgeId,
      },
    }));

    try {
      await bridge.delete_graph_edge({
        sessionId: session.sessionId,
        graphId: session.activeGraph.id,
        edgeId,
      });
      removeGraphEdgeSummary(graphCameraKey, edgeId);
      setRelationComposerByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
          deleteError: null,
          pendingDeleteEdgeId: null,
        },
      }));
    } catch (error) {
      setRelationComposerByNodeKey((current) => ({
        ...current,
        [selectedNodeCacheKey]: {
          ...(current[selectedNodeCacheKey] ?? buildInitialRelationComposerState()),
          deleteError: normalizeError(error, '无法删除关系。'),
          pendingDeleteEdgeId: null,
        },
      }));
    }
  }

  async function persistGraphConnection({
    connection,
    graphId,
    graphKey,
    sessionId,
  }: {
    connection: Connection;
    graphId: string;
    graphKey: string;
    sessionId: string;
  }) {
    if (!connection.source || !connection.target) {
      throw new Error('连接缺少 source 或 target。');
    }

    const defaultRelationType =
      (await resolveDefaultRelationTypeForGraph({
        sessionId,
        graphId,
        graphKey,
      })) ?? '';

    if (!defaultRelationType) {
      throw new Error('当前图层没有可用的默认关系类型。');
    }

    const existingEdge = findCachedGraphEdgeSummary({
      edgeType: defaultRelationType,
      graphKey,
      sourceNodeId: connection.source,
      targetNodeId: connection.target,
    });

    if (existingEdge) {
      upsertGraphEdgeSummary(graphKey, existingEdge);
      return;
    }

    const edge = await bridge.create_graph_edge({
      sessionId,
      graphId,
      sourceNodeId: connection.source,
      targetNodeId: connection.target,
      edgeType: defaultRelationType,
    });

    upsertGraphEdgeSummary(graphKey, edge);
  }

  async function handleEdgeConnect(connection: Connection) {
    await persistGraphConnection({
      connection,
      graphId: session.activeGraph.id,
      graphKey: graphCameraKey,
      sessionId: session.sessionId,
    });
  }

  function handleQuickAddRequest(request: CanvasQuickAddRequest) {
    const requestGraphKey = graphCameraKey;
    const requestGraphId = session.activeGraph.id;
    const requestSessionId = session.sessionId;

    setQuickAddState({
      anchor: request.anchor,
      createError: null,
      graphKey: requestGraphKey,
      pendingConnection: request.pendingConnection ?? null,
      pendingNodeType: null,
    });

    if (nodeTypeOptionsByGraphKey[requestGraphKey]?.status === 'ready') {
      return;
    }

    setNodeTypeOptionsByGraphKey((current) => ({
      ...current,
      [requestGraphKey]: {
        status: 'loading',
        options: current[requestGraphKey]?.options ?? [],
        error: null,
      },
    }));

    void (async () => {
      try {
        const options = await bridge.list_graph_node_type_options({
          sessionId: requestSessionId,
          graphId: requestGraphId,
        });

        setNodeTypeOptionsByGraphKey((current) => {
          const currentNodeTypeOptions = current[requestGraphKey];

          if (currentNodeTypeOptions && currentNodeTypeOptions.status !== 'loading') {
            return current;
          }

          return {
            ...current,
            [requestGraphKey]: {
              status: 'ready',
              options,
              error: null,
            },
          };
        });
      } catch (error) {
        setNodeTypeOptionsByGraphKey((current) => {
          const currentNodeTypeOptions = current[requestGraphKey];

          if (currentNodeTypeOptions && currentNodeTypeOptions.status !== 'loading') {
            return current;
          }

          return {
            ...current,
            [requestGraphKey]: {
              status: 'error',
              options: currentNodeTypeOptions?.options ?? [],
              error: normalizeError(error, zhCN.quickAdd.loadError),
            },
          };
        });
      }
    })();
  }

  function handleQuickAddClose() {
    setQuickAddState(null);
  }

  function handleQuickAddCreate(option: GraphNodeTypeOption) {
    if (!quickAddState || quickAddState.graphKey !== graphCameraKey) {
      return;
    }

    const createRequest = buildGraphNodeCreateRequest({
      graphId: session.activeGraph.id,
      option,
      anchor: quickAddState.anchor,
    });
    const requestGraphKey = graphCameraKey;
    const requestGraphId = session.activeGraph.id;
    const requestGraphLayerType = session.activeGraph.layerType;
    const requestSessionId = session.sessionId;
    const requestPendingConnection = quickAddState.pendingConnection;

    setQuickAddState((current) =>
      current && current.graphKey === requestGraphKey
        ? {
            ...current,
            createError: null,
            pendingNodeType: option.nodeType,
          }
        : current,
    );

    void (async () => {
      try {
        const detail = normalizeGraphNodeDetail(await bridge.create_graph_node({
          sessionId: requestSessionId,
          ...createRequest,
        }));

        if (quickAddStateRef.current?.graphKey !== requestGraphKey) {
          return;
        }

        const identity = {
          graphId: requestGraphId,
          graphKey: requestGraphKey,
          nodeId: detail.id,
          nodeKey: toNodeCacheKey(requestSessionId, requestGraphId, detail.id),
          sessionId: requestSessionId,
        };

        cachePersistedNode(identity, detail);
        setSelectedNodeIdsByGraphKey((current) => ({
          ...current,
          [requestGraphKey]: [detail.id],
        }));
        setNewlyCreatedNodeIdByGraphKey((current) => ({
          ...current,
          [requestGraphKey]: detail.id,
        }));
        setQuickAddState(null);

        if (requestPendingConnection && !detail.isSystem) {
          try {
            await persistGraphConnection({
              connection: buildConnectionFromPendingQuickAdd(detail.id, requestPendingConnection),
              graphId: requestGraphId,
              graphKey: requestGraphKey,
              sessionId: requestSessionId,
            });
          } catch (error) {
            setWorkspaceMessage(normalizeError(error, '节点已创建，但未能建立连接。'));
          }
        } else if (requestGraphLayerType === 'shot_lab' && !detail.isSystem) {
          void autoConnectNewShotLabNodeToSystemAnchor({
            sessionId: requestSessionId,
            graphId: requestGraphId,
            graphKey: requestGraphKey,
            nodeId: detail.id,
          }).catch((error) => {
            setWorkspaceMessage(normalizeError(error, '节点已创建，但未能自动连接到上下文锚点。'));
          });
        }
      } catch (error) {
        setQuickAddState((current) =>
          current && current.graphKey === requestGraphKey
            ? {
                ...current,
                createError: normalizeError(error, '无法创建节点。'),
                pendingNodeType: null,
              }
            : current,
        );
      }
    })();
  }

  async function handleActivateGraph(graphId: string) {
    if (graphId === session.activeGraph.id || pendingGraphId !== null) {
      return;
    }

    setPendingGraphId(graphId);
    setQuickAddState(null);
    setWorkspaceMessage(null);

    try {
      const nextSession = await bridge.activate_graph({
        sessionId: session.sessionId,
        graphId,
      });

      startTransition(() => {
        onSessionChange(nextSession);
      });
    } catch (error) {
      setWorkspaceMessage(normalizeError(error, '无法切换画布。'));
    } finally {
      setPendingGraphId(null);
    }
  }

  async function handleOpenNodeChildGraph(nodeId: string) {
    if (pendingGraphId !== null) {
      return;
    }

    setPendingGraphId(`node:${nodeId}`);
    setQuickAddState(null);
    setWorkspaceMessage(null);

    try {
      const nextSession = await bridge.open_node_child_graph({
        sessionId: session.sessionId,
        graphId: session.activeGraph.id,
        nodeId,
      });

      startTransition(() => {
        onSessionChange(nextSession);
      });
    } catch (error) {
      setWorkspaceMessage(normalizeError(error, '无法进入子画布。'));
    } finally {
      setPendingGraphId(null);
    }
  }

  async function handleRefreshMediaIndex(reason: 'startup' | 'manual' = 'manual') {
    if (mediaIndexState.status === 'refreshing') {
      return;
    }

    setMediaIndexState((current) => ({
      error: null,
      status: 'refreshing',
      summary: current.summary,
    }));

    try {
      const summary = await bridge.refresh_project_media_index({
        sessionId: session.sessionId,
        reason,
      });

      setMediaIndexState({
        error: null,
        status: 'ready',
        summary,
      });
    } catch (error) {
      setMediaIndexState((current) => ({
        error: normalizeError(error, zhCN.workspace.mediaIndexUnavailable),
        status: 'error',
        summary: current.summary,
      }));
    }
  }

  const mediaIndexSummary = mediaIndexState.summary;
  const mediaIndexPendingCount = mediaIndexSummary?.pendingJobCount ?? 0;
  const mediaIndexReadyCount = mediaIndexSummary?.assetCount ?? 0;
  const mediaIndexErrorCount = mediaIndexSummary?.failedJobCount ?? 0;
  const mediaIndexThumbnailCount = mediaIndexSummary?.readyThumbnailCount ?? 0;
  const mediaIndexIsIndexing = mediaIndexState.status === 'refreshing' || mediaIndexPendingCount > 0;
  const mediaHudSummary =
    mediaIndexState.status === 'error'
      ? mediaIndexState.error ?? zhCN.workspace.mediaIndexUnavailable
      : [
          formatAssetCountZh(mediaIndexReadyCount),
          mediaIndexIsIndexing ? `索引中 ${mediaIndexPendingCount}` : null,
          mediaIndexErrorCount > 0
            ? `${mediaIndexErrorCount} 项失败`
            : mediaIndexThumbnailCount > 0
              ? formatThumbnailCountZh(mediaIndexThumbnailCount)
              : null,
        ]
          .filter((segment): segment is string => Boolean(segment))
          .join(' · ');
  const compactZoomSummary = `${Math.round(camera.zoom * 100)}%`;
  const toolbarNotice = workspaceMessage
    ? {
        tone: 'error' as const,
        value: workspaceMessage,
      }
      : pendingGraphId !== null
        ? {
            tone: 'default' as const,
            value: zhCN.workspace.switchingGraph,
          }
      : graphNodesState.status === 'loading'
        ? {
            tone: 'default' as const,
            value: zhCN.workspace.loadingNodes,
          }
        : graphNodesState.status === 'error'
          ? {
              tone: 'error' as const,
              value: graphNodesState.error ?? zhCN.workspace.nodeIndexUnavailable,
            }
          : mediaIndexIsIndexing
            ? {
                tone: 'default' as const,
                value: zhCN.workspace.indexingAssets,
              }
            : null;
  const relationTargetOptions = projectedNodes
    .filter((node) => !node.isSystem && node.id !== selectedNodeId)
    .map((node) => ({
      label: node.title,
      nodeId: node.id,
    }));

  return (
    <main className="workspace-shell">
      <section ref={workspaceCanvasRef} className="workspace-canvas" aria-label={zhCN.app.canvasAria}>
        <div
          ref={workspaceTopbarRef}
          className="workspace-topbar workspace-overlay"
          role="toolbar"
          aria-label={zhCN.app.toolbarAria}
        >
          <div className="workspace-toolbar-leading" title={session.projectPath}>
            <h1>{session.projectName}</h1>
            <GraphBreadcrumbs
              pendingNavigation={pendingGraphId !== null}
              trail={session.graphTrail}
              onActivateGraph={(graphId) => void handleActivateGraph(graphId)}
            />
          </div>

          <div className="workspace-toolbar-actions">
            <div className="workspace-toolbar-command-group">
              <div className="workspace-toolbar-zoom" aria-label={zhCN.workspace.zoomAria(compactZoomSummary)}>
                <strong>{compactZoomSummary}</strong>
              </div>
              <button
                aria-label={zhCN.workspace.refreshMedia}
                className="secondary-button workspace-toolbar-action"
                type="button"
                onClick={() => void handleRefreshMediaIndex('manual')}
                disabled={mediaIndexState.status === 'loading' || mediaIndexState.status === 'refreshing'}
              >
                {mediaIndexState.status === 'refreshing'
                  ? zhCN.workspace.refreshingMedia
                  : zhCN.workspace.refreshMedia}
              </button>
            </div>
            {toolbarNotice ? (
              <div
                className={`workspace-toolbar-notice ${
                  toolbarNotice.tone === 'error' ? 'workspace-toolbar-notice-error' : ''
                }`}
                role="status"
              >
                <strong>{toolbarNotice.value}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <CanvasViewport
          key={graphCameraKey}
          graph={session.activeGraph}
          camera={camera}
          edges={visibleEdges}
          edgesStatus={graphEdgesState.status}
          leftOcclusionInset={selectableSelectedNode ? drawerWidth : 0}
          topOcclusionInset={canvasOcclusionInsets.top}
          rightOcclusionInset={canvasOcclusionInsets.right}
          bottomOcclusionInset={canvasOcclusionInsets.bottom}
          nodes={projectedNodes}
          nodesError={graphNodesState.error}
          nodesStatus={graphNodesState.status}
          selectedEdgeId={selectedEdgeId}
          selectedNodeIds={selectedNodeIds}
          onCameraChange={handleCameraChange}
          onEdgeConnect={handleEdgeConnect}
          onEnterNode={handleOpenNodeChildGraph}
          onNodePositionCommit={handleNodePositionCommit}
          onNodePositionPreview={handleNodePositionPreview}
          onQuickAddRequest={handleQuickAddRequest}
          onSelectedEdgeChange={handleSelectedEdgeChange}
          onSelectedNodesChange={handleSelectedNodesChange}
        />

        {quickAddState && quickAddState.graphKey === graphCameraKey ? (
          <QuickAddOverlay
            anchor={quickAddState.anchor}
            createError={quickAddState.createError}
            isCreating={quickAddState.pendingNodeType !== null}
            optionsState={filteredNodeTypeOptionsState}
            onClose={handleQuickAddClose}
            onCreate={handleQuickAddCreate}
          />
        ) : null}

        {selectableSelectedNode ? (
          <GraphNodeDrawer
            autoFocusFieldKey={
              newlyCreatedNodeIdByGraphKey[graphCameraKey] === selectableSelectedNode.id
                ? selectableSelectedNode.nodeType === 'brief'
                  ? 'description'
                  : 'title'
                : null
            }
            detailError={selectedNodeLoadState.error}
            detailStatus={
              selectedNodeDraft ? 'ready' : selectedNodeLoadState.status === 'error' ? 'error' : 'loading'
            }
            draft={selectedNodeDraft}
            graph={session.activeGraph}
            node={selectableSelectedNode}
            onClose={() => handleSelectedNodesChange([])}
            onDraftChange={handleSelectedNodeDraftChange}
            saveStatus={selectedNodeSaveState.status}
            assetBindings={selectedNodeDetailAssetBindings}
            assetRoleOptions={selectedNodeAssetRoleOptions}
            attachmentSearchQuery={assetSearchState.query}
            attachmentSearchResults={assetSearchState.assets}
            attachmentSearchStatus={assetSearchState.status}
            attachmentSearchError={assetSearchState.error}
            attachmentSelectedRole={assetSearchState.selectedRole}
            relationDeleteError={relationComposerState.deleteError}
            relationDeletePendingEdgeId={relationComposerState.pendingDeleteEdgeId}
            relationIncoming={selectedNodeRelations.incoming}
            relationOutgoing={selectedNodeRelations.outgoing}
            relationTargetOptions={relationTargetOptions}
            relationTypeOptions={relationTypeOptionsState.options}
            relationCreateError={relationComposerState.createError}
            relationCreatePending={relationComposerState.pendingSubmit}
            relationSelectedTargetNodeId={relationComposerState.selectedTargetNodeId}
            relationSelectedType={relationComposerState.selectedType}
            selectedAssetPreview={selectedNodePrimaryAsset}
            onAttachmentSearchQueryChange={handleAssetSearchQueryChange}
            onAttachmentRoleChange={handleSelectedAssetRoleChange}
            onBindAsset={handleBindNodeAsset}
            onUnbindAsset={handleUnbindNodeAsset}
            onCreateRelation={handleCreateRelation}
            onDeleteRelation={handleDeleteRelation}
            onRelationTargetChange={handleRelationTargetChange}
            onRelationTypeChange={handleRelationTypeChange}
            width={drawerWidth}
          />
        ) : null}

        <div className="workspace-bottom-controls">
          {shouldRenderAutoLayoutButton ? (
            <button
              aria-busy={isAutoLayouting}
              aria-label={autoLayoutScopeLabel}
              className="secondary-button workspace-auto-layout-button"
              disabled={autoLayoutDisabled}
              tabIndex={-1}
              title={autoLayoutButtonTitle}
              type="button"
              onClick={() => void handleAutoLayout()}
            >
              <span className="workspace-auto-layout-icon" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
            </button>
          ) : null}

          <section className="workspace-bottom-rail" aria-label={zhCN.app.statusHudAria}>
            <div
              className="workspace-hud-item"
              aria-label={zhCN.workspace.selectionAria(selectionSummary)}
            >
              <strong>{selectionSummary}</strong>
            </div>
            <span className="workspace-hud-divider" aria-hidden="true">
              ·
            </span>
            <div className="workspace-hud-item" aria-label={zhCN.workspace.zoomAria(compactZoomSummary)}>
              <strong>{compactZoomSummary}</strong>
            </div>
            <span className="workspace-hud-divider" aria-hidden="true">
              ·
            </span>
            <div className="workspace-hud-item" aria-label={zhCN.workspace.mediaAria(mediaHudSummary)}>
              <strong className={mediaIndexState.status === 'error' ? 'message-error' : undefined}>
                {mediaHudSummary}
              </strong>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export function App({ bridge = tauriBridge }: AppProps) {
  const [launchState, setLaunchState] = useState<LaunchState>({
    screen: 'loading',
  });
  const [launchVersion, setLaunchVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setLaunchState({ screen: 'loading' });
    });

    void (async () => {
      try {
        const [templates, session] = await Promise.all([
          bridge.list_available_templates(),
          bridge.get_project_session(),
        ]);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLaunchState(session ? { screen: 'workspace', session } : toStartupState(templates));
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLaunchState({
          screen: 'error',
          message: normalizeError(error, '无法加载可用模板。'),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bridge, launchVersion]);

  async function handleCreateProject() {
    if (launchState.screen !== 'startup' || !launchState.selectedTemplateId) {
      return;
    }

    const { selectedTemplateId, templates } = launchState;

    setLaunchState(toStartupState(templates, selectedTemplateId, undefined, 'create'));

    try {
      const handle = await bridge.create_project({ templateId: selectedTemplateId });
      const session = await resolveSession(bridge, handle.sessionId);

      startTransition(() => {
        setLaunchState({
          screen: 'workspace',
          session,
        });
      });
    } catch (error) {
      setLaunchState(
        toStartupState(templates, selectedTemplateId, normalizeError(error, '无法创建项目。')),
      );
    }
  }

  async function handleOpenProject() {
    if (launchState.screen !== 'startup') {
      return;
    }

    const { selectedTemplateId, templates } = launchState;

    setLaunchState(toStartupState(templates, selectedTemplateId, undefined, 'open'));

    try {
      const handle = await bridge.open_project();
      const session = await resolveSession(bridge, handle.sessionId);

      startTransition(() => {
        setLaunchState({
          screen: 'workspace',
          session,
        });
      });
    } catch (error) {
      setLaunchState(
        toStartupState(templates, selectedTemplateId, normalizeError(error, '无法打开项目。')),
      );
    }
  }

  if (launchState.screen === 'workspace') {
    return (
      <WorkspaceScreen
        bridge={bridge}
        session={launchState.session}
        onSessionChange={(session) => {
          setLaunchState({
            screen: 'workspace',
            session,
          });
        }}
      />
    );
  }

  if (launchState.screen === 'loading') {
    return (
      <main className="startup-shell">
        <section className="startup-panel startup-panel-loading">
          <p className="eyebrow">{zhCN.startup.loadingEyebrow}</p>
          <h1>{zhCN.startup.loadingTitle}</h1>
          <p>{zhCN.startup.loadingBody}</p>
        </section>
      </main>
    );
  }

  if (launchState.screen === 'error') {
    return (
      <main className="startup-shell">
        <section className="startup-panel">
          <p className="eyebrow">{zhCN.startup.errorEyebrow}</p>
          <h1>{zhCN.startup.errorTitle}</h1>
          <p className="message-error">{launchState.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setLaunchVersion((current) => current + 1)}
          >
            {zhCN.startup.retryStartup}
          </button>
        </section>
      </main>
    );
  }

  const isBusy = launchState.pendingAction !== null;

  return (
    <main className="startup-shell">
      <section className="startup-panel startup-panel-grid">
        <div className="startup-copy">
          <p className="eyebrow">{zhCN.startup.phaseLabel}</p>
          <h1>{zhCN.startup.title}</h1>
          <p>{zhCN.startup.body}</p>

          <div className="template-list" role="list" aria-label={zhCN.startup.templateListAria}>
            {launchState.templates.map((template) => {
              const isSelected = template.id === launchState.selectedTemplateId;

              return (
                <button
                  key={template.id}
                  className={`template-card${isSelected ? ' template-card-selected' : ''}`}
                  type="button"
                  onClick={() =>
                    setLaunchState((current) =>
                      current.screen === 'startup'
                        ? toStartupState(current.templates, template.id, current.message, current.pendingAction)
                        : current,
                    )
                  }
                  disabled={isBusy}
                >
                  <span className="template-name">{formatTemplateNameZh(template)}</span>
                  {formatTemplateDescriptionZh(template) ? (
                    <span className="template-description">{formatTemplateDescriptionZh(template)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="startup-actions">
          <div className="action-card">
            <span className="overlay-label">{zhCN.startup.launchActions}</span>
            <button
              className="primary-button"
              type="button"
              onClick={handleCreateProject}
              disabled={isBusy || !launchState.selectedTemplateId}
            >
              {zhCN.startup.createProject}
            </button>
            <button className="secondary-button" type="button" onClick={handleOpenProject} disabled={isBusy}>
              {zhCN.startup.openProject}
            </button>
            {launchState.message ? <p className="message-error">{launchState.message}</p> : null}
            {launchState.pendingAction === 'create' ? (
              <p className="message-info">{zhCN.startup.creatingProject}</p>
            ) : null}
            {launchState.pendingAction === 'open' ? (
              <p className="message-info">{zhCN.startup.openingProject}</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
