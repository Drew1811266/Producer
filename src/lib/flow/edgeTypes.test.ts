import { ProducerBezierEdge } from '../../components/edges/ProducerBezierEdge';

import { PRODUCER_BEZIER_EDGE_TYPE } from './defaultEdgeOptions';
import { producerEdgeTypes } from './edgeTypes';

test('registers producer-bezier as the shared Producer edge type', () => {
  expect(Object.keys(producerEdgeTypes)).toEqual([PRODUCER_BEZIER_EDGE_TYPE]);
  expect(producerEdgeTypes[PRODUCER_BEZIER_EDGE_TYPE]).toBe(ProducerBezierEdge);
});
