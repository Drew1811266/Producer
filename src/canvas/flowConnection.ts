import {
  ConnectionLineType,
  ConnectionMode,
  type Connection,
  type Edge,
} from '@xyflow/react';

import type { ProducerBezierEdgeData } from '../components/edges/ProducerBezierEdge';
import { PRODUCER_BEZIER_EDGE_TYPE } from '../lib/flow/defaultEdgeOptions';

export const PRODUCER_CONNECTION_MODE = ConnectionMode.Strict;
export const PRODUCER_CONNECTION_LINE_TYPE = ConnectionLineType.Bezier;
export const PRODUCER_CONNECTION_RADIUS = 24;
export const PRODUCER_PAN_ON_SCROLL = true;
export const PRODUCER_ZOOM_ON_SCROLL = false;
export const PRODUCER_ZOOM_ON_DOUBLE_CLICK = false;

export function createOptimisticProducerFlowEdge(
  connection: Connection,
): Edge<ProducerBezierEdgeData> | null {
  if (!connection.source || !connection.target) {
    return null;
  }

  return {
    id: `producer-edge-${connection.source}-${connection.sourceHandle ?? 'out'}-${connection.target}-${connection.targetHandle ?? 'in'}`,
    source: connection.source,
    sourceHandle: connection.sourceHandle ?? 'out',
    target: connection.target,
    targetHandle: connection.targetHandle ?? 'in',
    type: PRODUCER_BEZIER_EDGE_TYPE,
    animated: false,
    data: {
      label: null,
      relationType: null,
      showLabel: false,
    },
  };
}
