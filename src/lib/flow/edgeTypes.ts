import type { EdgeTypes } from '@xyflow/react';

import { ProducerBezierEdge } from '../../components/edges/ProducerBezierEdge';

import { PRODUCER_BEZIER_EDGE_TYPE } from './defaultEdgeOptions';

export const producerEdgeTypes = {
  [PRODUCER_BEZIER_EDGE_TYPE]: ProducerBezierEdge,
} satisfies EdgeTypes;
