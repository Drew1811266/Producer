import {
  ReactFlow,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnectStartParams,
  type ReactFlowInstance,
  type Viewport,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type {
  GraphNodePosition,
  GraphNodeSummary,
  ProjectGraphSummary,
} from '../bridge/contracts';
import type { ProducerBezierEdgeData } from '../components/edges/ProducerBezierEdge';
import { PlaceholderNode } from '../components/placeholder-node';
import { zhCN } from '../copy/zh-CN';
import {
  createProducerBezierMarkerEnd,
  createProducerDefaultEdgeOptions,
  PRODUCER_BEZIER_EDGE_TYPE,
} from '../lib/flow/defaultEdgeOptions';
import { producerEdgeTypes } from '../lib/flow/edgeTypes';
import { producerNodeTypes } from '../lib/flow/nodeTypes';
import type { CanvasQuickAddRequest } from '../quick-add/types';
import type { ProducerCanvasNodeData } from './ProducerCanvasNode';
import type { CameraState, ViewportPoint, ViewportSize } from './camera';
import {
  DEFAULT_VIEWPORT_SIZE,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  measureViewport,
  sanitizeCamera,
  viewportCenterPoint,
  viewportPointToWorldPoint,
} from './camera';
import type { CanvasEdge } from './canvasEdges';
import { resolveQuickAddRequestFromConnectEnd } from './connectionQuickAdd';
import {
  createOptimisticProducerFlowEdge,
  PRODUCER_CONNECTION_LINE_TYPE,
  PRODUCER_CONNECTION_MODE,
  PRODUCER_CONNECTION_RADIUS,
  PRODUCER_PAN_ON_SCROLL,
  PRODUCER_ZOOM_ON_DOUBLE_CLICK,
  PRODUCER_ZOOM_ON_SCROLL,
} from './flowConnection';
import { panCameraToRevealNode } from './nodeProjection';
import { filterProducerNodeTypeOptionsForLayer } from './producerNodeSystem';
import { buildFlowNodes, reconcileFlowNodesWithMetadata } from './flowNodes';

type ProducerFlowNode = Node<ProducerCanvasNodeData>;
type ProducerFlowEdge = Edge<ProducerBezierEdgeData>;

type CanvasViewportProps = {
  bottomOcclusionInset?: number;
  graph: ProjectGraphSummary;
  camera: CameraState;
  edges?: CanvasEdge[];
  edgesStatus?: 'loading' | 'ready' | 'error';
  leftOcclusionInset?: number;
  nodes?: GraphNodeSummary[];
  nodesError?: string | null;
  nodesStatus?: 'loading' | 'ready' | 'error';
  rightOcclusionInset?: number;
  selectedEdgeId?: string | null;
  selectedNodeIds?: string[];
  topOcclusionInset?: number;
  onCameraChange(camera: CameraState): void;
  onEdgeConnect?(connection: Connection): Promise<void> | void;
  onEnterNode?(nodeId: string): void;
  onNodePositionCommit?(nodeId: string, position: GraphNodePosition): void;
  onNodePositionPreview?(nodeId: string, position: GraphNodePosition): void;
  onQuickAddRequest?(request: CanvasQuickAddRequest): void;
  onSelectedEdgeChange?(edgeId: string | null): void;
  onSelectedNodesChange?(nodeIds: string[]): void;
};

const MIN_VISIBLE_VIEWPORT_EDGE = 160;

function producerConnectionDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (window as Window & { __PRODUCER_FLOW_DEBUG__?: boolean }).__PRODUCER_FLOW_DEBUG__ === true;
}

function debugProducerConnection(event: string, payload: Record<string, unknown>) {
  if (!producerConnectionDebugEnabled()) {
    return;
  }

  console.info(`[producer-flow] ${event}`, payload);
}

function shouldDisableNodeDragInCurrentEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const isJsdomEnvironment = /jsdom/i.test(navigator.userAgent);
  const dragFlagWindow = window as Window & {
    __PRODUCER_ENABLE_NODE_DRAG__?: boolean;
  };

  return isJsdomEnvironment && dragFlagWindow.__PRODUCER_ENABLE_NODE_DRAG__ !== true;
}

function formatCamera(camera: CameraState): string {
  const safeCamera = sanitizeCamera(camera);

  return `横向 ${Math.round(safeCamera.x)} 纵向 ${Math.round(safeCamera.y)} 缩放 ${Math.round(safeCamera.zoom * 100)}%`;
}

function matchesCameraState(a: CameraState, b: CameraState): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.zoom - b.zoom) < 0.001
  );
}

function clampOcclusionInsets(
  insets: { left: number; right: number; top: number; bottom: number },
  viewportSize: ViewportSize,
) {
  let left = Math.max(0, Math.min(insets.left, viewportSize.width));
  let right = Math.max(0, Math.min(insets.right, viewportSize.width));
  let top = Math.max(0, Math.min(insets.top, viewportSize.height));
  let bottom = Math.max(0, Math.min(insets.bottom, viewportSize.height));
  const maxHorizontalOcclusion = Math.max(0, viewportSize.width - MIN_VISIBLE_VIEWPORT_EDGE);
  const maxVerticalOcclusion = Math.max(0, viewportSize.height - MIN_VISIBLE_VIEWPORT_EDGE);

  if (left + right > maxHorizontalOcclusion) {
    const overflow = left + right - maxHorizontalOcclusion;
    const total = left + right || 1;
    left = Math.max(0, left - overflow * (left / total));
    right = Math.max(0, right - overflow * (right / total));
  }

  if (top + bottom > maxVerticalOcclusion) {
    const overflow = top + bottom - maxVerticalOcclusion;
    const total = top + bottom || 1;
    top = Math.max(0, top - overflow * (top / total));
    bottom = Math.max(0, bottom - overflow * (bottom / total));
  }

  return {
    left,
    right,
    top,
    bottom,
  };
}

function resolvePlaceholderCopy(layerType: string): {
  description: string;
  label: string;
} {
  const filteredOptions = filterProducerNodeTypeOptionsForLayer(layerType, [
    {
      nodeType: 'brief',
      label: 'Brief',
      defaultTitle: 'New Brief',
      defaultSize: { width: 220, height: 136 },
    },
    {
      nodeType: 'storyboard_shot',
      label: 'Storyboard Shot',
      defaultTitle: 'New Storyboard Shot',
      defaultSize: { width: 240, height: 152 },
    },
    {
      nodeType: 'prompt',
      label: 'Prompt',
      defaultTitle: 'New Prompt',
      defaultSize: { width: 240, height: 168 },
    },
  ]);

  const primaryNodeType = filteredOptions[0]?.nodeType ?? 'brief';

  switch (primaryNodeType) {
    case 'storyboard_shot':
      return {
        description: '在分镜层创建新的主镜头节点。',
        label: '新建分镜头',
      };
    case 'prompt':
      return {
        description: '在镜头工作台添加 Prompt、静帧、视频或参考节点。',
        label: '新建镜头节点',
      };
    default:
      return {
        description: '在 Brief Canvas 创建新的需求节点。',
        label: '新建需求',
      };
  }
}

function buildViewport(camera: CameraState, viewportSize: ViewportSize): Viewport {
  const safeCamera = sanitizeCamera(camera);

  return {
    x: viewportSize.width / 2 + safeCamera.x,
    y: viewportSize.height / 2 + safeCamera.y,
    zoom: safeCamera.zoom,
  };
}

function toCameraState(viewport: Viewport, viewportSize: ViewportSize): CameraState {
  return sanitizeCamera({
    x: viewport.x - viewportSize.width / 2,
    y: viewport.y - viewportSize.height / 2,
    zoom: viewport.zoom,
  });
}

function matchesViewport(a: Viewport, b: Viewport): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.zoom - b.zoom) < 0.001
  );
}

function buildFlowEdges({
  edges,
  selectedEdgeId,
}: {
  edges: CanvasEdge[];
  selectedEdgeId: string | null;
}): Array<Edge<ProducerBezierEdgeData>> {
  return edges.map((edge) => {
    const relationType = (edge.relationType ?? edge.edgeType ?? '').trim() || null;

    return {
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: 'out',
      target: edge.targetNodeId,
      targetHandle: 'in',
      type: PRODUCER_BEZIER_EDGE_TYPE,
      data: {
        label: null,
        relationType,
        showLabel: false,
      },
      markerEnd: createProducerBezierMarkerEnd(relationType),
      animated: false,
      selectable: false,
      selected: edge.id === selectedEdgeId,
    } satisfies Edge<ProducerBezierEdgeData, typeof PRODUCER_BEZIER_EDGE_TYPE>;
  });
}

function areEdgeMarkersEquivalent(
  current: ProducerFlowEdge['markerEnd'],
  next: ProducerFlowEdge['markerEnd'],
): boolean {
  return (
    current?.color === next?.color &&
    current?.height === next?.height &&
    current?.type === next?.type &&
    current?.width === next?.width
  );
}

function areFlowEdgesEquivalent(current: ProducerFlowEdge, next: ProducerFlowEdge): boolean {
  return (
    current.id === next.id &&
    current.animated === next.animated &&
    current.selectable === next.selectable &&
    current.selected === next.selected &&
    current.source === next.source &&
    current.sourceHandle === next.sourceHandle &&
    current.target === next.target &&
    current.targetHandle === next.targetHandle &&
    current.type === next.type &&
    current.data?.label === next.data?.label &&
    current.data?.relationType === next.data?.relationType &&
    current.data?.showLabel === next.data?.showLabel &&
    areEdgeMarkersEquivalent(current.markerEnd, next.markerEnd)
  );
}

function reconcileFlowEdges(
  current: ProducerFlowEdge[],
  next: ProducerFlowEdge[],
): ProducerFlowEdge[] {
  const currentById = new Map(current.map((edge) => [edge.id, edge]));
  let changed = current.length !== next.length;

  const reconciledEdges = next.map((nextEdge) => {
    const currentEdge = currentById.get(nextEdge.id);

    if (!currentEdge) {
      changed = true;
      return nextEdge;
    }

    if (areFlowEdgesEquivalent(currentEdge, nextEdge)) {
      return currentEdge;
    }

    changed = true;
    return nextEdge;
  });

  return changed ? reconciledEdges : current;
}

function areStringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function orderSelectedFlowNodeIds(
  orderedFlowNodes: ProducerFlowNode[],
  selectedFlowNodes: ProducerFlowNode[],
): string[] {
  if (selectedFlowNodes.length === 0) {
    return [];
  }

  const selectedNodeIdSet = new Set(
    selectedFlowNodes
      .map((selectedFlowNode) => {
        const graphNode = 'node' in selectedFlowNode.data ? selectedFlowNode.data.node : null;

        return graphNode && !graphNode.isSystem ? selectedFlowNode.id : null;
      })
      .filter((nodeId): nodeId is string => nodeId !== null),
  );

  if (selectedNodeIdSet.size === 0) {
    return [];
  }

  return orderedFlowNodes
    .map((orderedFlowNode) => {
      const graphNode = 'node' in orderedFlowNode.data ? orderedFlowNode.data.node : null;

      return graphNode && !graphNode.isSystem && selectedNodeIdSet.has(orderedFlowNode.id)
        ? orderedFlowNode.id
        : null;
    })
    .filter((nodeId): nodeId is string => nodeId !== null);
}

function FlowNodeInternalsRefresher({
  graphId,
  nodeIds,
  nodeIdsNeedingInternalsRefresh,
}: {
  graphId: string;
  nodeIds: string[];
  nodeIdsNeedingInternalsRefresh: string[];
}) {
  const refreshedGraphIdRef = useRef<string | null>(null);
  const lastRefreshedNodeIdsRef = useRef<string[]>([]);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    lastRefreshedNodeIdsRef.current = [];
  }, [graphId]);

  useEffect(() => {
    if (nodeIdsNeedingInternalsRefresh.length === 0) {
      lastRefreshedNodeIdsRef.current = [];
      return;
    }

    const previouslyRefreshedNodeIds = lastRefreshedNodeIdsRef.current;
    const isDuplicateRefresh =
      previouslyRefreshedNodeIds.length === nodeIdsNeedingInternalsRefresh.length &&
      previouslyRefreshedNodeIds.every(
        (nodeId, index) => nodeId === nodeIdsNeedingInternalsRefresh[index],
      );

    if (isDuplicateRefresh) {
      return;
    }

    lastRefreshedNodeIdsRef.current = [...nodeIdsNeedingInternalsRefresh];
    updateNodeInternals(nodeIdsNeedingInternalsRefresh);
  }, [nodeIdsNeedingInternalsRefresh, updateNodeInternals]);

  useEffect(() => {
    if (refreshedGraphIdRef.current === graphId || nodeIds.length === 0) {
      return;
    }

    refreshedGraphIdRef.current = graphId;
    updateNodeInternals(nodeIds);
  }, [graphId, nodeIds, updateNodeInternals]);

  return null;
}

export function CanvasViewport({
  bottomOcclusionInset = 0,
  graph,
  camera,
  edges = [],
  leftOcclusionInset = 0,
  nodes = [],
  nodesError = null,
  nodesStatus = 'ready',
  rightOcclusionInset = 0,
  selectedEdgeId = null,
  selectedNodeIds = [],
  topOcclusionInset = 0,
  onCameraChange,
  onEdgeConnect,
  onEnterNode = () => undefined,
  onNodePositionCommit,
  onNodePositionPreview,
  onQuickAddRequest = () => undefined,
  onSelectedEdgeChange = () => undefined,
  onSelectedNodesChange = () => undefined,
}: CanvasViewportProps) {
  const disableNodeDrag = shouldDisableNodeDragInCurrentEnvironment();
  const marqueeSelectionEnabled = !disableNodeDrag;
  const viewportGutter = 24;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<ProducerFlowNode, ProducerFlowEdge> | null>(null);
  const viewportStateRef = useRef<Viewport>(buildViewport(camera, DEFAULT_VIEWPORT_SIZE));
  const pendingProgrammaticViewportRef = useRef<Viewport | null>(null);
  const cameraRef = useRef(camera);
  const flowEdgesRef = useRef<ProducerFlowEdge[]>([]);
  const flowNodesRef = useRef<ProducerFlowNode[]>([]);
  const hasMeasuredViewportRef = useRef(false);
  const connectionStartRef = useRef<OnConnectStartParams | null>(null);
  const lastPointerRef = useRef<ViewportPoint | null>(null);
  const onCameraChangeRef = useRef(onCameraChange);
  const onEdgeConnectRef = useRef(onEdgeConnect);
  const onEnterNodeRef = useRef(onEnterNode);
  const onNodePositionCommitRef = useRef(onNodePositionCommit);
  const onNodePositionPreviewRef = useRef(onNodePositionPreview);
  const onQuickAddRequestRef = useRef(onQuickAddRequest);
  const onSelectedEdgeChangeRef = useRef(onSelectedEdgeChange);
  const onSelectedNodesChangeRef = useRef(onSelectedNodesChange);
  const selectedNodeIdsRef = useRef<string[]>(selectedNodeIds);
  const selectedNodeIdSetRef = useRef<Set<string>>(new Set(selectedNodeIds));
  const viewportSizeRef = useRef<ViewportSize>(DEFAULT_VIEWPORT_SIZE);
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null);
  const [optimisticFlowEdges, setOptimisticFlowEdges] = useState<ProducerFlowEdge[]>([]);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(DEFAULT_VIEWPORT_SIZE);
  const [hasMeasuredViewport, setHasMeasuredViewport] = useState(false);
  const shouldShowPlaceholder = nodesStatus === 'ready' && nodes.length === 0 && !nodesError;
  const handleInspectNode = useCallback(
    (nodeId: string) => {
      onSelectedNodesChangeRef.current([nodeId]);
    },
    [],
  );
  const handleFlowEnterNode = useCallback(
    (nodeId: string) => {
      onEnterNodeRef.current(nodeId);
    },
    [],
  );
  const safeInsets = {
    left: leftOcclusionInset + viewportGutter,
    right: rightOcclusionInset + viewportGutter,
    top: topOcclusionInset + viewportGutter,
    bottom: bottomOcclusionInset + viewportGutter,
  };
  const clampedInsets = clampOcclusionInsets(safeInsets, viewportSize);
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] ?? null : null;
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const syncSelectedNodeOcclusion = useEffectEvent(() => {
    if (!hasMeasuredViewport) {
      return;
    }

    if (!selectedNodeId || activeDragNodeId === selectedNodeId) {
      return;
    }

    const selectedNode = nodes.find((node) => node.id === selectedNodeId);

    if (!selectedNode) {
      return;
    }

    const nextCamera = panCameraToRevealNode(selectedNode, camera, viewportSize, {
      left: clampedInsets.left,
      right: clampedInsets.right,
      top: clampedInsets.top,
      bottom: clampedInsets.bottom,
    });

    if (!matchesCameraState(nextCamera, camera)) {
      onCameraChangeRef.current(nextCamera);
    }
  });

  useLayoutEffect(() => {
    const nextViewport = measureViewport(viewportRef.current, DEFAULT_VIEWPORT_SIZE);

    setViewportSize((current) =>
      current.width === nextViewport.width && current.height === nextViewport.height ? current : nextViewport,
    );
    setHasMeasuredViewport(true);
  }, []);

  const emitQuickAddRequest = useCallback(
    (mode: 'pointer' | 'center' = 'pointer') => {
      const screenPoint =
        mode === 'center'
          ? viewportCenterPoint(viewportSize)
          : lastPointerRef.current ?? viewportCenterPoint(viewportSize);
      const worldPoint = viewportPointToWorldPoint(camera, screenPoint, viewportSize);

      onQuickAddRequestRef.current({
        anchor: {
          screenX: screenPoint.x,
          screenY: screenPoint.y,
          worldX: worldPoint.x,
          worldY: worldPoint.y,
        },
      });
    },
    [camera, viewportSize],
  );

  useEffect(() => {
    const syncViewport = () => {
      setViewportSize((current) => {
        const nextViewport = measureViewport(viewportRef.current, current);

        return current.width === nextViewport.width && current.height === nextViewport.height
          ? current
          : nextViewport;
      });
    };

    syncViewport();

    const resizeObserver =
      viewportRef.current && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncViewport)
        : null;

    if (resizeObserver && viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    window.addEventListener('resize', syncViewport);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useLayoutEffect(() => {
    syncSelectedNodeOcclusion();
  }, [
    activeDragNodeId,
    bottomOcclusionInset,
    hasMeasuredViewport,
    leftOcclusionInset,
    nodes,
    rightOcclusionInset,
    selectedNodeId,
    topOcclusionInset,
    viewportSize,
  ]);

  useLayoutEffect(() => {
    const instance = reactFlowRef.current;
    const nextViewport = buildViewport(camera, viewportSize);

    if (!hasMeasuredViewport || !instance || matchesViewport(viewportStateRef.current, nextViewport)) {
      return;
    }

    viewportStateRef.current = nextViewport;
    pendingProgrammaticViewportRef.current = nextViewport;
    void instance.setViewport(nextViewport, {
      duration: 0,
    });
  }, [camera, hasMeasuredViewport, viewportSize]);

  const builtFlowNodes = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      buildFlowNodes({
        disableNodeDrag,
        graph,
        nodes,
        onEnterNode: handleFlowEnterNode,
        onInspectNode: handleInspectNode,
        selectedNodeIds,
      }),
    [disableNodeDrag, graph, handleFlowEnterNode, handleInspectNode, nodes, selectedNodeIds],
  );
  const [flowNodesVersion, setFlowNodesVersion] = useState(0);
  const builtFlowEdges = useMemo(
    () =>
      shouldShowPlaceholder
        ? []
        : buildFlowEdges({
            edges,
            selectedEdgeId,
          }),
    [edges, selectedEdgeId, shouldShowPlaceholder],
  );
  // The last committed flow node snapshot is the stable reconciliation base for
  // external node creation and rebuilds between React Flow store updates.
  const flowNodeReconciliation = useMemo(
    () => {
      void flowNodesVersion;

      // eslint-disable-next-line react-hooks/refs
      return reconcileFlowNodesWithMetadata(flowNodesRef.current, builtFlowNodes);
    },
    [builtFlowNodes, flowNodesVersion],
  );
  const flowNodes = flowNodeReconciliation.nodes;
  const nextFlowEdges = useMemo(
    () => [
      ...builtFlowEdges,
      ...optimisticFlowEdges.filter(
        (optimisticEdge) =>
          !builtFlowEdges.some(
            (edge) =>
              edge.source === optimisticEdge.source &&
              edge.target === optimisticEdge.target &&
              edge.sourceHandle === optimisticEdge.sourceHandle &&
              edge.targetHandle === optimisticEdge.targetHandle,
          ),
      ),
    ],
    [builtFlowEdges, optimisticFlowEdges],
  );
  const flowEdges = useMemo(
    () => {
      // eslint-disable-next-line react-hooks/refs
      return reconcileFlowEdges(flowEdgesRef.current, nextFlowEdges);
    },
    [nextFlowEdges],
  );
  const flowNodeIds = useMemo(() => flowNodes.map((node) => node.id), [flowNodes]);
  const defaultViewport = useMemo(() => buildViewport(camera, viewportSize), [camera, viewportSize]);
  const defaultEdgeOptions = useMemo(
    () => createProducerDefaultEdgeOptions(graph.layerType),
    [graph.layerType],
  );
  useLayoutEffect(() => {
    flowNodesRef.current = flowNodes;
  }, [flowNodes]);
  useLayoutEffect(() => {
    flowEdgesRef.current = flowEdges;
  }, [flowEdges]);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);
  useEffect(() => {
    onEdgeConnectRef.current = onEdgeConnect;
  }, [onEdgeConnect]);
  useEffect(() => {
    onEnterNodeRef.current = onEnterNode;
  }, [onEnterNode]);
  useEffect(() => {
    hasMeasuredViewportRef.current = hasMeasuredViewport;
  }, [hasMeasuredViewport]);
  useEffect(() => {
    onNodePositionCommitRef.current = onNodePositionCommit;
  }, [onNodePositionCommit]);
  useEffect(() => {
    onNodePositionPreviewRef.current = onNodePositionPreview;
  }, [onNodePositionPreview]);
  useEffect(() => {
    onQuickAddRequestRef.current = onQuickAddRequest;
  }, [onQuickAddRequest]);
  useEffect(() => {
    onSelectedEdgeChangeRef.current = onSelectedEdgeChange;
  }, [onSelectedEdgeChange]);
  useEffect(() => {
    onSelectedNodesChangeRef.current = onSelectedNodesChange;
  }, [onSelectedNodesChange]);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);
  useEffect(() => {
    selectedNodeIdSetRef.current = selectedNodeIdSet;
  }, [selectedNodeIdSet]);
  useEffect(() => {
    viewportSizeRef.current = viewportSize;
  }, [viewportSize]);
  const handleNodesChange = useCallback((changes: NodeChange<ProducerFlowNode>[]) => {
    const metadataChanges = changes.filter((change) => change.type === 'dimensions');

    if (metadataChanges.length === 0) {
      return;
    }

    const currentNodes = flowNodesRef.current;
    const nextNodes = applyNodeChanges(metadataChanges, currentNodes);
    const reconciledNodes = reconcileFlowNodesWithMetadata(currentNodes, nextNodes).nodes;

    if (reconciledNodes === currentNodes) {
      return;
    }

    flowNodesRef.current = reconciledNodes;
    setFlowNodesVersion((current) => current + 1);
  }, []);
  const handleNodeClick = useCallback(
    (event: React.MouseEvent<Element>, node: ProducerFlowNode) => {
      if ((event.target as HTMLElement | null)?.closest('.react-flow__handle')) {
        return;
      }

      const graphNode = 'node' in node.data ? node.data.node : null;

      if (!graphNode || graphNode.isSystem) {
        return;
      }

      onSelectedEdgeChangeRef.current(null);
      onSelectedNodesChangeRef.current([node.id]);
    },
    [],
  );
  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent<Element>, node: ProducerFlowNode) => {
      if ((event.target as HTMLElement | null)?.closest('.react-flow__handle')) {
        return;
      }

      const graphNode = 'node' in node.data ? node.data.node : null;

      if (!graphNode || graphNode.isSystem || !graphNode.canEnterChildGraph) {
        return;
      }

      onEnterNodeRef.current(node.id);
    },
    [],
  );
  const handleNodeDragStart = useCallback(
    (_: unknown, node: ProducerFlowNode, draggedNodes: ProducerFlowNode[]) => {
      const graphNode = 'node' in node.data ? node.data.node : null;

      if (!graphNode || graphNode.isSystem) {
        return;
      }

      setActiveDragNodeId(node.id);
      onSelectedEdgeChangeRef.current(null);
      if (selectedNodeIdSetRef.current.has(node.id)) {
        return;
      }

      const nextSelectedNodeIds = orderSelectedFlowNodeIds(
        flowNodesRef.current,
        draggedNodes.length > 0 ? draggedNodes : [node],
      );

      onSelectedNodesChangeRef.current(nextSelectedNodeIds.length > 0 ? nextSelectedNodeIds : [node.id]);
    },
    [],
  );
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent<SVGGElement>, edge: ProducerFlowEdge) => {
      event.stopPropagation();
      onSelectedNodesChangeRef.current([]);
      onSelectedEdgeChangeRef.current(edge.id);
    },
    [],
  );
  const handleNodeDrag = useCallback(
    (_: unknown, node: ProducerFlowNode, draggedNodes: ProducerFlowNode[]) => {
      (draggedNodes.length > 0 ? draggedNodes : [node])
        .filter((draggedNode) => {
          const draggedGraphNode = 'node' in draggedNode.data ? draggedNode.data.node : null;

          return Boolean(draggedGraphNode && !draggedGraphNode.isSystem);
        })
        .forEach((draggedNode) => {
          onNodePositionPreviewRef.current?.(draggedNode.id, {
            x: draggedNode.position.x,
            y: draggedNode.position.y,
          });
        });
    },
    [],
  );
  const handleNodeDragStop = useCallback(
    (_: unknown, node: ProducerFlowNode, draggedNodes: ProducerFlowNode[]) => {
      setActiveDragNodeId(null);

      (draggedNodes.length > 0 ? draggedNodes : [node])
        .filter((draggedNode) => {
          const draggedGraphNode = 'node' in draggedNode.data ? draggedNode.data.node : null;

          return Boolean(draggedGraphNode && !draggedGraphNode.isSystem);
        })
        .forEach((draggedNode) => {
          onNodePositionCommitRef.current?.(draggedNode.id, {
            x: draggedNode.position.x,
            y: draggedNode.position.y,
          });
        });
    },
    [],
  );
  const handlePaneClick = useCallback(() => {
    onSelectedEdgeChangeRef.current(null);
    onSelectedNodesChangeRef.current([]);
  }, []);
  const handleSelectionChange = useCallback(
    ({ nodes: selectedFlowNodes }: { nodes: ProducerFlowNode[] }) => {
      const nextSelectedNodeIds = orderSelectedFlowNodeIds(flowNodesRef.current, selectedFlowNodes);

      onSelectedEdgeChangeRef.current(null);
      if (areStringArraysEqual(selectedNodeIdsRef.current, nextSelectedNodeIds)) {
        return;
      }

      onSelectedNodesChangeRef.current(nextSelectedNodeIds);
    },
    [],
  );
  const handleFlowInit = useCallback(
    (instance: ReactFlowInstance<ProducerFlowNode, ProducerFlowEdge>) => {
      reactFlowRef.current = instance;
      viewportStateRef.current = defaultViewport;
    },
    [defaultViewport],
  );
  const handleMove = useCallback(
    (_: unknown, nextViewport: Viewport) => {
      viewportStateRef.current = nextViewport;

      if (!hasMeasuredViewportRef.current) {
        return;
      }

      const pendingProgrammaticViewport = pendingProgrammaticViewportRef.current;

      if (pendingProgrammaticViewport) {
        if (matchesViewport(pendingProgrammaticViewport, nextViewport)) {
          pendingProgrammaticViewportRef.current = null;
        }

        return;
      }

      const nextCamera = toCameraState(nextViewport, viewportSizeRef.current);

      if (!matchesCameraState(nextCamera, cameraRef.current)) {
        onCameraChangeRef.current(nextCamera);
      }
    },
    [],
  );
  const handleEdgesChange = useCallback((changes: EdgeChange<ProducerFlowEdge>[]) => {
    setOptimisticFlowEdges((current) => applyEdgeChanges(changes, current));
  }, []);
  const handleConnectStart = useCallback((_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    connectionStartRef.current = params;
    debugProducerConnection('connect-start', {
      handleId: params.handleId,
      handleType: params.handleType,
      sourceNodeId: params.nodeId,
    });
  }, []);
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) {
        debugProducerConnection('connect-rejected', {
          reason: 'missing-endpoints',
          ...connection,
        });
        return;
      }

      const normalizedConnection: Connection = {
        ...connection,
        sourceHandle: connection.sourceHandle ?? 'out',
        targetHandle: connection.targetHandle ?? 'in',
      };
      const optimisticEdge = createOptimisticProducerFlowEdge(normalizedConnection);

      if (!optimisticEdge) {
        return;
      }

      setOptimisticFlowEdges((current) => addEdge(optimisticEdge, current));
      debugProducerConnection('connect-success', normalizedConnection as Record<string, unknown>);

      try {
        await onEdgeConnectRef.current?.(normalizedConnection);
        setOptimisticFlowEdges((current) => current.filter((edge) => edge.id !== optimisticEdge.id));
      } catch (error) {
        setOptimisticFlowEdges((current) => current.filter((edge) => edge.id !== optimisticEdge.id));
        debugProducerConnection('connect-persist-failed', {
          error: error instanceof Error ? error.message : String(error),
          ...normalizedConnection,
        });
      }
    },
    [],
  );
  const handleConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        isValid: boolean | null;
        toHandle: unknown;
        toNode: unknown;
      },
    ) => {
      const quickAddRequest =
        viewportRef.current == null
          ? null
          : resolveQuickAddRequestFromConnectEnd({
              camera: cameraRef.current,
              connectionStart: connectionStartRef.current,
              connectionState,
              event,
              viewportBounds: viewportRef.current.getBoundingClientRect(),
              viewportSize: viewportSizeRef.current,
            });
      const failedReason = !connectionState.toHandle
        ? 'no-target-handle'
        : connectionState.isValid === false
          ? 'invalid-target-handle'
          : null;

      debugProducerConnection('connect-end', {
        isValid: connectionState.isValid,
        reason: failedReason,
        sourceHandleId: connectionStartRef.current?.handleId ?? null,
        sourceHandleType: connectionStartRef.current?.handleType ?? null,
        sourceNodeId: connectionStartRef.current?.nodeId ?? null,
        targetHandle: connectionState.toHandle,
        targetNode: connectionState.toNode,
        quickAddRequest,
      });
      connectionStartRef.current = null;

      if (quickAddRequest) {
        onQuickAddRequestRef.current(quickAddRequest);
      }
    },
    [],
  );
  return (
    <div ref={viewportRef} className="canvas-viewport">
      <div
        className="canvas-stage producer-react-flow-shell"
        data-graph-id={graph.id}
        data-testid="canvas-stage-host"
        tabIndex={0}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onSelectedEdgeChange(null);
            onSelectedNodesChange([]);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            emitQuickAddRequest();
          }
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          lastPointerRef.current = {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          };
        }}
      >
        <div
          aria-hidden="true"
          className="producer-canvas-grid producer-canvas-grid--minor"
          data-testid="producer-canvas-grid-minor"
        />
        <div
          aria-hidden="true"
          className="producer-canvas-grid producer-canvas-grid--major"
          data-testid="producer-canvas-grid-major"
        />
        <div
          aria-hidden="true"
          className="producer-canvas-atmosphere"
          data-testid="producer-canvas-atmosphere"
        />
        <ReactFlow<ProducerFlowNode, ProducerFlowEdge>
          className="producer-react-flow"
          connectionLineType={PRODUCER_CONNECTION_LINE_TYPE}
          connectionMode={PRODUCER_CONNECTION_MODE}
          connectionRadius={PRODUCER_CONNECTION_RADIUS}
          defaultEdgeOptions={defaultEdgeOptions}
          deleteKeyCode={null}
          edges={flowEdges}
          edgeTypes={producerEdgeTypes}
          elementsSelectable
          maxZoom={MAX_CAMERA_ZOOM}
          minZoom={MIN_CAMERA_ZOOM}
          nodeDragThreshold={4}
          nodeTypes={producerNodeTypes}
          nodes={flowNodes}
          nodesConnectable
          nodesDraggable={!disableNodeDrag}
          onConnect={handleConnect}
          onConnectEnd={handleConnectEnd}
          onConnectStart={handleConnectStart}
          onEdgesChange={handleEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodesChange={disableNodeDrag ? undefined : handleNodesChange}
          onNodeDragStart={handleNodeDragStart}
          onEdgeClick={handleEdgeClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onSelectionChange={handleSelectionChange}
          onInit={handleFlowInit}
          onMove={handleMove}
          panActivationKeyCode="Space"
          panOnDrag={false}
          panOnScroll={PRODUCER_PAN_ON_SCROLL}
          selectionKeyCode={marqueeSelectionEnabled ? null : undefined}
          selectionMode={marqueeSelectionEnabled ? SelectionMode.Partial : undefined}
          selectionOnDrag={marqueeSelectionEnabled}
          defaultViewport={defaultViewport}
          zoomOnDoubleClick={PRODUCER_ZOOM_ON_DOUBLE_CLICK}
          zoomOnScroll={PRODUCER_ZOOM_ON_SCROLL}
        >
          <FlowNodeInternalsRefresher
            graphId={graph.id}
            nodeIds={flowNodeIds}
            nodeIdsNeedingInternalsRefresh={flowNodeReconciliation.nodesNeedingInternalsRefresh}
          />
        </ReactFlow>
      </div>
      <output className="sr-only" data-testid="camera-readout" aria-hidden="true">
        {formatCamera(camera)}
      </output>

      {shouldShowPlaceholder ? (
        <div className="canvas-stage-empty-state" role="status">
          <div className="canvas-stage-empty-state-copy">
            <p className="canvas-stage-empty-state-eyebrow">{zhCN.canvas.emptyEyebrow}</p>
            <strong>{zhCN.canvas.emptyTitle}</strong>
            <span>{zhCN.canvas.emptyBody}</span>
          </div>
          <div className="canvas-stage-empty-state-actions">
            <PlaceholderNode
              aria-label={zhCN.canvas.createNode}
              description={resolvePlaceholderCopy(graph.layerType).description}
              label={resolvePlaceholderCopy(graph.layerType).label}
              onClick={() => {
                emitQuickAddRequest('center');
              }}
            />
          </div>
        </div>
      ) : null}

      {nodesStatus === 'error' ? (
        <div className="canvas-stage-empty-state" role="status">
          <div className="canvas-stage-empty-state-copy">
            <p className="canvas-stage-empty-state-eyebrow">{zhCN.canvas.emptyEyebrow}</p>
            <strong>{nodesError ?? zhCN.canvas.emptyTitle}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
