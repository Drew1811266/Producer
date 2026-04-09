import type { ProjectedGraphNode } from './nodeProjection';
import { buildCanvasEdgePolyline } from './canvasEdges';
import { buildNodePresentation } from './nodePresentation';

function buildProjectedNode(overrides: Partial<ProjectedGraphNode> = {}): ProjectedGraphNode {
  return {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Node',
    nodeType: 'prompt',
    storedAssetCount: 0,
    layout: {
      x: 0,
      y: 0,
      width: 220,
      height: 200,
    },
    screenX: 200,
    screenY: 120,
    screenWidth: 220,
    screenHeight: 200,
    projectedArea: 44_000,
    projectedMinEdge: 200,
    scaleFactor: 1,
    masterWidth: 220,
    masterHeight: 200,
    lod: 'detail',
    ...overrides,
  };
}

test('routes edges from the source output port to the target input port for layered user nodes', () => {
  const sourceNode = buildProjectedNode({
    id: 'source',
    nodeType: 'storyboard_shot',
    layout: {
      x: 0,
      y: 0,
      width: 220,
      height: 200,
    },
    screenX: 120,
    screenY: 80,
    screenWidth: 220,
    screenHeight: 200,
    masterWidth: 220,
    masterHeight: 200,
  });
  const targetNode = buildProjectedNode({
    id: 'target',
    nodeType: 'prompt',
    screenX: 420,
    screenY: 320,
  });
  const sourcePresentation = buildNodePresentation(sourceNode, false);
  const targetPresentation = buildNodePresentation(targetNode, false);

  const polyline = buildCanvasEdgePolyline(sourceNode, targetNode, 'screen');

  expect(polyline[0]).toEqual({
    x: sourceNode.screenX + sourceNode.screenWidth / 2,
    y:
      sourceNode.screenY +
      sourceNode.screenHeight +
      sourcePresentation.outputPortOffsetY -
      sourcePresentation.outputPortHeight / 2,
  });
  expect(polyline[polyline.length - 1]).toEqual({
    x: targetNode.screenX + targetNode.screenWidth / 2,
    y:
      targetNode.screenY -
      targetPresentation.inputPortOffsetY +
      targetPresentation.inputPortHeight / 2,
  });
});
