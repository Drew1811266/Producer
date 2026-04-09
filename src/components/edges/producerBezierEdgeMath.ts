import {
  PRODUCER_BEZIER_CURVATURE,
  PRODUCER_BEZIER_MAX_CURVATURE,
  PRODUCER_BEZIER_MIN_CURVATURE,
} from '../../lib/flow/defaultEdgeOptions';

export function clampProducerBezierCurvature(curvature?: number | null): number {
  if (!Number.isFinite(curvature)) {
    return PRODUCER_BEZIER_CURVATURE;
  }

  return Math.min(
    PRODUCER_BEZIER_MAX_CURVATURE,
    Math.max(PRODUCER_BEZIER_MIN_CURVATURE, curvature ?? PRODUCER_BEZIER_CURVATURE),
  );
}
