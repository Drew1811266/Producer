import { MarkerType, type DefaultEdgeOptions, type EdgeMarker } from '@xyflow/react';

export const PRODUCER_BEZIER_EDGE_TYPE = 'producer-bezier';
export const PRODUCER_BEZIER_CURVATURE = 0.2;
export const PRODUCER_BEZIER_MIN_CURVATURE = 0.18;
export const PRODUCER_BEZIER_MAX_CURVATURE = 0.22;
export const PRODUCER_BEZIER_DEFAULT_INTERACTION_WIDTH = 16;
export const PRODUCER_BEZIER_SHOT_LAB_INTERACTION_WIDTH = 20;

function normalizeProducerLayerType(layerType?: string | null): string {
  switch (layerType) {
    case 'shot':
      return 'shot_lab';
    case 'story':
      return 'storyboard';
    default:
      return layerType?.trim().toLowerCase() ?? '';
  }
}

export function resolveProducerBezierInteractionWidth(layerType?: string | null): number {
  return normalizeProducerLayerType(layerType) === 'shot_lab'
    ? PRODUCER_BEZIER_SHOT_LAB_INTERACTION_WIDTH
    : PRODUCER_BEZIER_DEFAULT_INTERACTION_WIDTH;
}

export function shouldUseProducerBezierMarkerEnd(relationType?: string | null): boolean {
  const normalizedRelation = relationType?.trim().toLowerCase() ?? '';

  if (!normalizedRelation) {
    return false;
  }

  return ['approved', 'final', 'output', 'result', 'selected'].some((token) =>
    normalizedRelation.includes(token),
  );
}

export function createProducerBezierMarkerEnd(relationType?: string | null): EdgeMarker | undefined {
  if (!shouldUseProducerBezierMarkerEnd(relationType)) {
    return undefined;
  }

  return {
    color: '#5B84FF',
    height: 18,
    type: MarkerType.ArrowClosed,
    width: 18,
  };
}

export function createProducerDefaultEdgeOptions(layerType?: string | null): DefaultEdgeOptions {
  return {
    animated: false,
    interactionWidth: resolveProducerBezierInteractionWidth(layerType),
    type: PRODUCER_BEZIER_EDGE_TYPE,
  };
}
