import { MarkerType } from '@xyflow/react';

import {
  createProducerBezierMarkerEnd,
  createProducerDefaultEdgeOptions,
  PRODUCER_BEZIER_CURVATURE,
  PRODUCER_BEZIER_DEFAULT_INTERACTION_WIDTH,
  PRODUCER_BEZIER_EDGE_TYPE,
  PRODUCER_BEZIER_SHOT_LAB_INTERACTION_WIDTH,
  resolveProducerBezierInteractionWidth,
} from './defaultEdgeOptions';

test('builds producer-bezier edge defaults with the shared curvature and muted interaction width', () => {
  const edgeOptions = createProducerDefaultEdgeOptions('brief');

  expect(edgeOptions).toMatchObject({
    animated: false,
    interactionWidth: PRODUCER_BEZIER_DEFAULT_INTERACTION_WIDTH,
    type: PRODUCER_BEZIER_EDGE_TYPE,
  });
  expect(edgeOptions.markerStart).toBeUndefined();
  expect(edgeOptions.markerEnd).toBeUndefined();
  expect(PRODUCER_BEZIER_CURVATURE).toBe(0.2);
});

test('widens shot-lab edge hit areas and reserves arrows for explicit final-output relations', () => {
  expect(resolveProducerBezierInteractionWidth('shot_lab')).toBe(
    PRODUCER_BEZIER_SHOT_LAB_INTERACTION_WIDTH,
  );
  expect(resolveProducerBezierInteractionWidth('shot')).toBe(
    PRODUCER_BEZIER_SHOT_LAB_INTERACTION_WIDTH,
  );
  expect(resolveProducerBezierInteractionWidth('storyboard')).toBe(
    PRODUCER_BEZIER_DEFAULT_INTERACTION_WIDTH,
  );

  expect(createProducerBezierMarkerEnd('references')).toBeUndefined();
  expect(createProducerBezierMarkerEnd('approved_from')).toMatchObject({
    color: '#5B84FF',
    type: MarkerType.ArrowClosed,
  });
});
