import { invoke } from '@tauri-apps/api/core';

import { normalizeErrorMessageZh, zhCN } from '../copy/zh-CN';
import type {
  ActivateGraphRequest,
  BindNodeAssetRequest,
  CreateGraphNodeRequest,
  CreateGraphEdgeRequest,
  CreateProjectRequest,
  DeleteGraphNodeRequest,
  DeleteGraphNodeResult,
  DeleteGraphEdgeRequest,
  GetGraphNodeDetailRequest,
  GraphContextTrailItem,
  GraphNodeDetail,
  GraphEdgeSummary,
  GraphRelationTypeOption,
  GraphNodeSummary,
  GraphNodeTypeOption,
  ListGraphEdgesRequest,
  ListGraphNodesRequest,
  ListGraphNodeTypeOptionsRequest,
  ListGraphRelationTypeOptionsRequest,
  ListProjectAssetsRequest,
  OpenNodeChildGraphRequest,
  ProducerBridge,
  ProjectAssetSummary,
  ProjectGraphSummary,
  ProjectMediaIndexSummary,
  ProjectSession,
  ProjectSessionHandle,
  ProjectSessionLookup,
  ProjectTemplate,
  RefreshProjectMediaIndexRequest,
  UnbindNodeAssetRequest,
  UpdateGraphNodePayloadRequest,
  UpdateGraphNodePositionRequest,
} from './contracts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type BackendTemplateSummary = {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
  version?: number;
  layerTypes?: string[];
};

type BackendGraphSummary = {
  id: string;
  layerType: string;
  name: string;
  isRoot: boolean;
};

type BackendGraphNodeSummary = GraphNodeSummary;
type BackendGraphNodeDetail = GraphNodeDetail;
type BackendGraphNodeTypeOption = GraphNodeTypeOption;
type BackendDeleteGraphNodeResult = DeleteGraphNodeResult;
type BackendGraphEdgeSummary = GraphEdgeSummary;
type BackendGraphRelationTypeOption = GraphRelationTypeOption;
type BackendProjectMediaIndexSummary = ProjectMediaIndexSummary;
type BackendProjectAssetSummary = ProjectAssetSummary;

type BackendProjectSession = Omit<ProjectSession, 'activeGraph' | 'availableGraphs'> & {
  activeGraph?: BackendGraphSummary;
  availableGraphs?: BackendGraphSummary[];
  graphTrail?: GraphContextTrailItem[];
  rootGraph?: BackendGraphSummary;
};

const sessionCache = new Map<string, ProjectSession>();
let activeSessionId: string | null = null;

function normalizeGraph(graph: BackendGraphSummary): ProjectGraphSummary {
  return {
    id: graph.id,
    layerType: graph.layerType,
    name: graph.name,
    isRoot: graph.isRoot,
  };
}

function normalizeProjectSession(session: BackendProjectSession): ProjectSession {
  const activeGraph = session.activeGraph
    ? normalizeGraph(session.activeGraph)
    : session.rootGraph
      ? normalizeGraph(session.rootGraph)
      : session.availableGraphs?.[0]
        ? normalizeGraph(session.availableGraphs[0])
        : null;

  if (!activeGraph) {
    throw new Error(zhCN.app.sessionMissingGraph);
  }

  const normalizedAvailableGraphs = session.availableGraphs?.map(normalizeGraph) ?? [];
  const availableGraphs =
    normalizedAvailableGraphs.length > 0
      ? normalizedAvailableGraphs
      : session.rootGraph
        ? [normalizeGraph(session.rootGraph)]
        : [activeGraph];
  const graphTrail =
    session.graphTrail && session.graphTrail.length > 0
      ? session.graphTrail
      : [
          {
            graphId: activeGraph.id,
            graphName: activeGraph.name,
            layerType: activeGraph.layerType,
          },
        ];

  return {
    sessionId: session.sessionId,
    projectId: session.projectId,
    projectName: session.projectName,
    projectPath: session.projectPath,
    templateId: session.templateId,
    templateVersion: session.templateVersion,
    graphCount: session.graphCount,
    assetCount: session.assetCount,
    activeGraph,
    availableGraphs,
    graphTrail,
  };
}

function cacheSession(session: BackendProjectSession | ProjectSession): ProjectSessionHandle {
  const normalizedSession = normalizeProjectSession(session);

  sessionCache.set(normalizedSession.sessionId, normalizedSession);
  activeSessionId = normalizedSession.sessionId;

  return { sessionId: normalizedSession.sessionId };
}

function pruneDeletedGraphsFromSession(
  session: ProjectSession,
  deletedGraphIds: readonly string[],
): ProjectSession | null {
  if (deletedGraphIds.length === 0) {
    return session;
  }

  const deletedGraphIdSet = new Set(deletedGraphIds);

  if (deletedGraphIdSet.has(session.activeGraph.id)) {
    return null;
  }

  const availableGraphs = session.availableGraphs.filter(
    (graph) => !deletedGraphIdSet.has(graph.id),
  );
  const graphTrail = session.graphTrail.filter(
    (item) => !deletedGraphIdSet.has(item.graphId),
  );

  return {
    ...session,
    availableGraphs:
      availableGraphs.length > 0 ? availableGraphs : [session.activeGraph],
    graphTrail:
      graphTrail.length > 0
        ? graphTrail
        : [
            {
              graphId: session.activeGraph.id,
              graphName: session.activeGraph.name,
              layerType: session.activeGraph.layerType,
            },
          ],
  };
}

function pruneDeletedGraphsFromSessionCache(deletedGraphIds: readonly string[]) {
  if (deletedGraphIds.length === 0) {
    return;
  }

  for (const [sessionId, session] of sessionCache.entries()) {
    const nextSession = pruneDeletedGraphsFromSession(session, deletedGraphIds);

    if (!nextSession) {
      sessionCache.delete(sessionId);

      if (activeSessionId === sessionId) {
        activeSessionId = null;
      }

      continue;
    }

    sessionCache.set(sessionId, nextSession);
  }
}

export function createTauriProducerBridge(command: TauriInvoke = invoke): ProducerBridge {
  return {
    async list_available_templates() {
      const templates = await command<BackendTemplateSummary[]>('list_available_templates');

      return templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        recommended: template.recommended,
        version: template.version,
        layerTypes: template.layerTypes,
      })) satisfies ProjectTemplate[];
    },
    async create_project(payload: CreateProjectRequest) {
      const session = await command<BackendProjectSession>('create_project', {
        request: payload,
      });

      return cacheSession(session);
    },
    async open_project() {
      const session = await command<BackendProjectSession>('open_project', {
        request: {},
      });

      return cacheSession(session);
    },
    async get_project_session(payload: ProjectSessionLookup = {}) {
      if (payload.sessionId && sessionCache.has(payload.sessionId)) {
        return sessionCache.get(payload.sessionId) ?? null;
      }

      if (!payload.sessionId && activeSessionId && sessionCache.has(activeSessionId)) {
        return sessionCache.get(activeSessionId) ?? null;
      }

      const session = await command<BackendProjectSession | null>('get_project_session', {
        request: payload,
      });

      if (session) {
        const normalizedSession = normalizeProjectSession(session);
        cacheSession(normalizedSession);

        return normalizedSession;
      }

      return session;
    },
    async activate_graph(payload: ActivateGraphRequest) {
      const session = await command<BackendProjectSession>('activate_graph', {
        request: payload,
      });

      cacheSession(session);

      return normalizeProjectSession(session);
    },
    async open_node_child_graph(payload: OpenNodeChildGraphRequest) {
      const session = await command<BackendProjectSession>('open_node_child_graph', {
        request: payload,
      });

      cacheSession(session);

      return normalizeProjectSession(session);
    },
    async list_graph_nodes(payload: ListGraphNodesRequest) {
      return command<BackendGraphNodeSummary[]>('list_graph_nodes', {
        request: payload,
      });
    },
    async list_graph_node_type_options(payload: ListGraphNodeTypeOptionsRequest) {
      return command<BackendGraphNodeTypeOption[]>('list_graph_node_type_options', {
        request: payload,
      });
    },
    async get_graph_node_detail(payload: GetGraphNodeDetailRequest) {
      return command<BackendGraphNodeDetail>('get_graph_node_detail', {
        request: payload,
      });
    },
    async create_graph_node(payload: CreateGraphNodeRequest) {
      return command<BackendGraphNodeDetail>('create_graph_node', {
        request: payload,
      });
    },
    async update_graph_node_payload(payload: UpdateGraphNodePayloadRequest) {
      return command<BackendGraphNodeDetail>('update_graph_node_payload', {
        request: payload,
      });
    },
    async update_graph_node_position(payload: UpdateGraphNodePositionRequest) {
      return command<BackendGraphNodeSummary>('update_graph_node_position', {
        request: payload,
      });
    },
    async delete_graph_node(payload: DeleteGraphNodeRequest) {
      const result = await command<BackendDeleteGraphNodeResult>('delete_graph_node', {
        request: payload,
      });

      pruneDeletedGraphsFromSessionCache(result.deletedGraphIds);

      return result;
    },
    async bind_node_asset(payload: BindNodeAssetRequest) {
      return command<BackendGraphNodeDetail>('bind_node_asset', {
        request: payload,
      });
    },
    async unbind_node_asset(payload: UnbindNodeAssetRequest) {
      return command<BackendGraphNodeDetail>('unbind_node_asset', {
        request: payload,
      });
    },
    async list_graph_edges(payload: ListGraphEdgesRequest) {
      return command<BackendGraphEdgeSummary[]>('list_graph_edges', {
        request: payload,
      });
    },
    async list_graph_relation_type_options(payload: ListGraphRelationTypeOptionsRequest) {
      return command<BackendGraphRelationTypeOption[]>('list_graph_relation_type_options', {
        request: payload,
      });
    },
    async create_graph_edge(payload: CreateGraphEdgeRequest) {
      return command<BackendGraphEdgeSummary>('create_graph_edge', {
        request: payload,
      });
    },
    async delete_graph_edge(payload: DeleteGraphEdgeRequest) {
      return command<void>('delete_graph_edge', {
        request: payload,
      });
    },
    async get_project_media_index_summary(payload: ProjectSessionLookup = {}) {
      return command<BackendProjectMediaIndexSummary>('get_project_media_index_summary', {
        request: payload,
      });
    },
    async refresh_project_media_index(payload: RefreshProjectMediaIndexRequest = {}) {
      return command<BackendProjectMediaIndexSummary>('refresh_project_media_index', {
        request: payload,
      });
    },
    async list_project_assets(payload: ListProjectAssetsRequest = {}) {
      return command<BackendProjectAssetSummary[]>('list_project_assets', {
        request: payload,
      });
    },
  };
}

export const tauriBridge = createTauriProducerBridge();

export function normalizeBridgeErrorMessage(message: string): string {
  return normalizeErrorMessageZh(message);
}
