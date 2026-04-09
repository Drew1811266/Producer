import type { GraphNodeSummary, GraphNodeTypeOption } from '../bridge/contracts';
import {
  filterProducerNodeTypeOptionsForLayer,
  formatProducerNodeTypeLabelZh,
  resolveProducerNodeVisual,
} from './producerNodeSystem';

function buildNode(overrides: Partial<GraphNodeSummary> = {}): GraphNodeSummary {
  return {
    id: 'node-1',
    graphId: 'graph-1',
    title: 'Node',
    nodeType: 'brief',
    storedAssetCount: 0,
    status: undefined,
    isSystem: false,
    canEnterChildGraph: false,
    layout: {
      x: 0,
      y: 0,
      width: 220,
      height: 140,
    },
    ...overrides,
  };
}

function buildOption(nodeType: string): GraphNodeTypeOption {
  return {
    nodeType,
    label: nodeType,
    defaultTitle: `New ${nodeType}`,
    defaultSize: {
      width: 220,
      height: 140,
    },
  };
}

test('maps producer business nodes to the required BaseNode families and handle rules', () => {
  expect(resolveProducerNodeVisual(buildNode({ nodeType: 'brief' }))).toMatchObject({
    appendixLabel: null,
    chroma: 'simple',
    handleMode: 'default',
    producerType: 'demand',
    showStatusIndicator: false,
    targetHandle: 'top',
    sourceHandle: 'bottom',
  });

  expect(resolveProducerNodeVisual(buildNode({ nodeType: 'storyboard_shot' }))).toMatchObject({
    chroma: 'simple',
    producerType: 'shot',
    targetHandle: 'top',
    sourceHandle: 'bottom',
  });

  expect(resolveProducerNodeVisual(buildNode({ nodeType: 'prompt' }))).toMatchObject({
    chroma: 'action-bar',
    producerType: 'prompt',
    showStatusIndicator: false,
    targetHandle: 'top',
    sourceHandle: 'bottom',
  });

  expect(
    resolveProducerNodeVisual(
      buildNode({
        nodeType: 'still',
        status: 'rendering',
      }),
    ),
  ).toMatchObject({
    chroma: 'action-bar',
    producerType: 'frame',
    showStatusIndicator: true,
    statusTone: 'loading',
  });

  expect(
    resolveProducerNodeVisual(
      buildNode({
        nodeType: 'video',
        status: 'failed',
      }),
    ),
  ).toMatchObject({
    chroma: 'action-bar',
    producerType: 'video',
    showStatusIndicator: true,
    statusTone: 'error',
  });

  expect(resolveProducerNodeVisual(buildNode({ nodeType: 'reference' }))).toMatchObject({
    chroma: 'action-bar',
    producerType: 'reference',
  });

  expect(resolveProducerNodeVisual(buildNode({ nodeType: 'review' }))).toMatchObject({
    chroma: 'annotation',
    producerType: 'review',
    showStatusIndicator: false,
  });

  expect(
    resolveProducerNodeVisual(
      buildNode({
        nodeType: 'result',
        status: 'approved',
      }),
    ),
  ).toMatchObject({
    appendixLabel: 'Selected',
    chroma: 'simple',
    producerType: 'selected_result',
    showStatusIndicator: true,
    statusTone: 'success',
  });
});

test('maps system anchors to weakened producer anchor nodes with only downstream output handles', () => {
  expect(
    resolveProducerNodeVisual(
      buildNode({
        nodeType: 'system_anchor',
        isSystem: true,
        sourceNodeType: 'brief',
      }),
    ),
  ).toMatchObject({
    chroma: 'simple',
    producerType: 'demand_anchor',
    showStatusIndicator: false,
    targetHandle: null,
    sourceHandle: 'bottom',
    weak: true,
  });

  expect(
    resolveProducerNodeVisual(
      buildNode({
        nodeType: 'system_anchor',
        isSystem: true,
        sourceNodeType: 'storyboard_shot',
      }),
    ),
  ).toMatchObject({
    producerType: 'shot_anchor',
    targetHandle: null,
    sourceHandle: 'bottom',
    weak: true,
  });

  expect(
    formatProducerNodeTypeLabelZh(
      buildNode({
        nodeType: 'system_anchor',
        isSystem: true,
        sourceNodeType: 'brief',
      }),
    ),
  ).toBe('需求锚点');

  expect(
    formatProducerNodeTypeLabelZh(
      buildNode({
        nodeType: 'system_anchor',
        isSystem: true,
        sourceNodeType: 'storyboard_shot',
      }),
    ),
  ).toBe('分镜锚点');
});

test('enforces the layer whitelist expected by the producer canvases', () => {
  const options = [
    buildOption('brief'),
    buildOption('storyboard_shot'),
    buildOption('prompt'),
    buildOption('still'),
    buildOption('video'),
    buildOption('reference'),
    buildOption('review'),
    buildOption('result'),
    buildOption('system_anchor'),
  ];

  expect(filterProducerNodeTypeOptionsForLayer('brief', options).map((option) => option.nodeType)).toEqual([
    'brief',
  ]);

  expect(filterProducerNodeTypeOptionsForLayer('storyboard', options).map((option) => option.nodeType)).toEqual([
    'storyboard_shot',
  ]);

  expect(filterProducerNodeTypeOptionsForLayer('story', options).map((option) => option.nodeType)).toEqual([
    'storyboard_shot',
  ]);

  expect(filterProducerNodeTypeOptionsForLayer('shot_lab', options).map((option) => option.nodeType)).toEqual([
    'prompt',
    'still',
    'video',
    'reference',
    'review',
    'result',
  ]);

  expect(filterProducerNodeTypeOptionsForLayer('shot', options).map((option) => option.nodeType)).toEqual([
    'prompt',
    'still',
    'video',
    'reference',
    'review',
    'result',
  ]);
});
