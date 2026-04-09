import { describe, expect, test } from 'vitest';

import type { GraphNodeSummary } from '../bridge/contracts';
import { DEFAULT_CAMERA, type CameraState, type ViewportSize } from './camera';
import { panCameraToRevealNode } from './nodeProjection';

function buildNode(
  overrides: Partial<GraphNodeSummary> & Pick<GraphNodeSummary, 'id' | 'graphId'>,
): GraphNodeSummary {
  return {
    id: overrides.id,
    graphId: overrides.graphId,
    title: overrides.title ?? 'Node',
    nodeType: overrides.nodeType ?? 'brief',
    sourceNodeType: overrides.sourceNodeType ?? null,
    storedAssetCount: overrides.storedAssetCount ?? 0,
    status: overrides.status ?? 'idle',
    isSystem: overrides.isSystem ?? false,
    canEnterChildGraph: overrides.canEnterChildGraph ?? false,
    layout: overrides.layout ?? {
      x: -300,
      y: -120,
      width: 900,
      height: 240,
    },
  };
}

describe('panCameraToRevealNode', () => {
  test('returns a stable camera when the node is wider than the remaining visible viewport', () => {
    const viewport: ViewportSize = {
      width: 1280,
      height: 720,
    };
    const camera: CameraState = DEFAULT_CAMERA;
    const node = buildNode({
      graphId: 'graph-1',
      id: 'node-1',
    });
    const insets = {
      left: 420,
      right: 80,
      top: 24,
      bottom: 24,
    };

    const nextCamera = panCameraToRevealNode(node, camera, viewport, insets);
    const stabilizedCamera = panCameraToRevealNode(node, nextCamera, viewport, insets);

    expect(nextCamera).toEqual({
      x: 20,
      y: 0,
      zoom: 1,
    });
    expect(stabilizedCamera).toEqual(nextCamera);
  });

  test('returns a stable camera when the node is taller than the remaining visible viewport', () => {
    const viewport: ViewportSize = {
      width: 1280,
      height: 720,
    };
    const camera: CameraState = DEFAULT_CAMERA;
    const node = buildNode({
      graphId: 'graph-1',
      id: 'node-1',
      layout: {
        x: -140,
        y: -220,
        width: 280,
        height: 760,
      },
    });
    const insets = {
      left: 24,
      right: 24,
      top: 180,
      bottom: 120,
    };

    const nextCamera = panCameraToRevealNode(node, camera, viewport, insets);
    const stabilizedCamera = panCameraToRevealNode(node, nextCamera, viewport, insets);

    expect(nextCamera).toEqual({
      x: 0,
      y: -130,
      zoom: 1,
    });
    expect(stabilizedCamera).toEqual(nextCamera);
  });
});
