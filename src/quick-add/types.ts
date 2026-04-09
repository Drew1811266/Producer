import type { GraphNodeTypeOption } from '../bridge/contracts';

export type CanvasQuickAddAnchor = {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
};

export type CanvasQuickAddPendingConnection = {
  sourceHandleId: string | null;
  sourceHandleType: 'source' | 'target';
  sourceNodeId: string;
};

export type CanvasQuickAddRequest = {
  anchor: CanvasQuickAddAnchor;
  pendingConnection?: CanvasQuickAddPendingConnection | null;
};

export type CachedNodeTypeOptions = {
  status: 'loading' | 'ready' | 'error';
  options: GraphNodeTypeOption[];
  error: string | null;
};
