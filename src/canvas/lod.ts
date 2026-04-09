export type NodeLodLevel = 'detail' | 'summary' | 'chip' | 'silhouette';

export type NodeLodMetrics = {
  projectedWidth: number;
  projectedHeight: number;
  projectedArea: number;
  projectedMinEdge: number;
  scaleFactor: number;
};

const DETAIL_MIN_SCALE = 1;
const FULL_TEMPLATE_MIN_SCALE = 0.4;
const CHIP_MIN_SCALE = 0.2;

export function createNodeLodMetrics(
  projectedWidth: number,
  projectedHeight: number,
  masterWidth = projectedWidth,
  masterHeight = projectedHeight,
): NodeLodMetrics {
  const safeWidth = Number.isFinite(projectedWidth) && projectedWidth > 0 ? projectedWidth : 0;
  const safeHeight = Number.isFinite(projectedHeight) && projectedHeight > 0 ? projectedHeight : 0;
  const safeMasterWidth = Number.isFinite(masterWidth) && masterWidth > 0 ? masterWidth : safeWidth || 1;
  const safeMasterHeight = Number.isFinite(masterHeight) && masterHeight > 0 ? masterHeight : safeHeight || 1;

  return {
    projectedWidth: safeWidth,
    projectedHeight: safeHeight,
    projectedArea: safeWidth * safeHeight,
    projectedMinEdge: Math.min(safeWidth, safeHeight),
    scaleFactor: safeWidth === 0 || safeHeight === 0
      ? 0
      : Math.min(safeWidth / safeMasterWidth, safeHeight / safeMasterHeight),
  };
}

export function resolveNodeLod(metrics: NodeLodMetrics): NodeLodLevel {
  if (metrics.scaleFactor >= DETAIL_MIN_SCALE) {
    return 'detail';
  }

  if (metrics.scaleFactor >= FULL_TEMPLATE_MIN_SCALE) {
    return 'summary';
  }

  if (metrics.scaleFactor >= CHIP_MIN_SCALE) {
    return 'chip';
  }

  return 'silhouette';
}
