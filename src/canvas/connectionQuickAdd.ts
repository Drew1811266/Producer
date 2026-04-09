import type { OnConnectStartParams } from '@xyflow/react';

import type { CameraState, ViewportSize } from './camera';
import { viewportPointToWorldPoint } from './camera';
import type { CanvasQuickAddRequest } from '../quick-add/types';

type ConnectEndState = {
  isValid: boolean | null;
  toHandle: unknown;
  toNode: unknown;
};

type ViewportBounds = {
  left: number;
  top: number;
};

function extractClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0];

    if (!touch) {
      return null;
    }

    return {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
    return null;
  }

  return {
    x: event.clientX,
    y: event.clientY,
  };
}

export function resolveQuickAddRequestFromConnectEnd({
  camera,
  connectionStart,
  connectionState,
  event,
  viewportBounds,
  viewportSize,
}: {
  camera: CameraState;
  connectionStart: OnConnectStartParams | null;
  connectionState: ConnectEndState;
  event: MouseEvent | TouchEvent;
  viewportBounds: ViewportBounds;
  viewportSize: ViewportSize;
}): CanvasQuickAddRequest | null {
  if (
    !connectionStart?.nodeId ||
    !connectionStart.handleType ||
    connectionState.isValid === true ||
    connectionState.toHandle !== null ||
    connectionState.toNode !== null
  ) {
    return null;
  }

  const clientPoint = extractClientPoint(event);

  if (!clientPoint) {
    return null;
  }

  const anchor = {
    screenX: clientPoint.x - viewportBounds.left,
    screenY: clientPoint.y - viewportBounds.top,
  };
  const worldPoint = viewportPointToWorldPoint(
    camera,
    {
      x: anchor.screenX,
      y: anchor.screenY,
    },
    viewportSize,
  );

  return {
    anchor: {
      ...anchor,
      worldX: worldPoint.x,
      worldY: worldPoint.y,
    },
    pendingConnection: {
      sourceHandleId: connectionStart.handleId,
      sourceHandleType: connectionStart.handleType,
      sourceNodeId: connectionStart.nodeId,
    },
  };
}
