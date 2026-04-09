import type { GraphNodeSummary } from '../bridge/contracts';
import { buildNodePresentation } from './nodePresentation';
import type { NodeLodLevel } from './lod';
import type { ProjectedGraphNode } from './nodeProjection';
import { resolveNodeMasterSize, resolveNodeScaleFactor } from './nodeTemplate';

function buildProjectedNode(overrides: Partial<ProjectedGraphNode> = {}): ProjectedGraphNode {
  const baseNode: GraphNodeSummary = {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Opening Brief',
    nodeType: 'brief',
    storedAssetCount: 0,
    status: 'Ready',
    isSystem: false,
    canEnterChildGraph: false,
    layout: {
      x: 0,
      y: 0,
      width: 208,
      height: 128,
    },
  };

  const node: Omit<ProjectedGraphNode, 'masterWidth' | 'masterHeight' | 'scaleFactor'> = {
    ...baseNode,
    screenX: 100,
    screenY: 120,
    screenWidth: 208,
    screenHeight: 128,
    projectedArea: 26_624,
    projectedMinEdge: 128,
    lod: 'detail' as NodeLodLevel,
    ...overrides,
  };

  const masterSize = resolveNodeMasterSize(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });

  return {
    ...node,
    masterWidth: overrides.masterWidth ?? masterSize.width,
    masterHeight: overrides.masterHeight ?? masterSize.height,
    scaleFactor:
      overrides.scaleFactor ??
      resolveNodeScaleFactor(
        overrides.screenWidth ?? node.screenWidth,
        overrides.screenHeight ?? node.screenHeight,
        {
          width: overrides.masterWidth ?? masterSize.width,
          height: overrides.masterHeight ?? masterSize.height,
        },
      ),
  };
}

function presentationTokens(presentation: ReturnType<typeof buildNodePresentation>) {
  return presentation as unknown as Record<string, unknown>;
}

test('detail nodes stay in one flat card family and expose stable card tokens', () => {
  const presentation = buildNodePresentation(buildProjectedNode(), true);
  const tokens = presentationTokens(presentation);

  expect(presentation.interactive).toBe(true);
  expect(presentation.selected).toBe(true);
  expect(presentation.enterable).toBe(false);
  expect(presentation.chrome).toBe('card');
  expect(presentation.shape).toBe('card');
  expect(presentation.cornerRadius).toBe(14);
  expect(presentation.borderWidth).toBe(1);
  expect(presentation.showTypeLabel).toBe(true);
  expect(presentation.showTitle).toBe(true);
  expect(presentation.showStatus).toBe(true);
  expect(tokens.scaleFactor).toBe(1);
  expect(tokens.typeFontSize).toBe(11);
  expect(tokens.titleFontSize).toBe(16);
  expect(tokens.statusFontSize).toBe(12);
  expect(tokens.headerHeight).toBe(26);
  expect(tokens.bodyPaddingX).toBe(14);
  expect(tokens.bodyPaddingTop).toBe(14);
  expect(tokens.keylineHeight).toBe(0);
  expect(tokens.selectionRingWidth).toBe(2);
  expect(tokens.selectionRingGap).toBe(3);
  expect(tokens.contentMode).toBe('text');
  expect(tokens.ornamentStyle).toBe('panel');
  expect(tokens.headerPanelWidth).toBe(124);
  expect(tokens.headerPanelHeight).toBe(34);
  expect(tokens.hasActionDot).toBe(true);
  expect(tokens.actionDotDiameter).toBe(20);
  expect(tokens.hasConnector).toBe(true);
  expect(tokens.connectorWidth).toBe(28);
  expect(tokens.connectorHeight).toBe(12);
});

test('different node types shift accent and content mode without changing the card family', () => {
  const briefPresentation = buildNodePresentation(buildProjectedNode(), false);
  const shotPresentation = buildNodePresentation(
    buildProjectedNode({
      id: 'node-shot',
      nodeType: 'storyboard_shot',
      title: 'Storyboard Shot',
      layout: {
        x: 0,
        y: 0,
        width: 220,
        height: 200,
      },
      screenWidth: 220,
      screenHeight: 200,
    }),
    false,
  );
  const mediaPresentation = buildNodePresentation(
    buildProjectedNode({
      id: 'node-still',
      nodeType: 'still',
      title: 'Frame Candidate',
    }),
    false,
  );
  const reviewPresentation = buildNodePresentation(
    buildProjectedNode({
      id: 'node-review',
      nodeType: 'review',
      title: 'Review Summary',
    }),
    false,
  );

  expect(briefPresentation.palette.surface).toBe('#fcfdfe');
  expect(mediaPresentation.palette.surface).toBe('#ffffff');
  expect(mediaPresentation.palette.title).toBe('#9aa7bb');
  expect(briefPresentation.palette.accent).toBe('#5b84ff');
  expect(shotPresentation.palette.border).toBe('#a9b7c9');
  expect(mediaPresentation.palette.border).toBe('#a9b7c9');
  expect(presentationTokens(briefPresentation).contentMode).toBe('text');
  expect(presentationTokens(briefPresentation).ornamentStyle).toBe('panel');
  expect(presentationTokens(shotPresentation).contentMode).toBe('text');
  expect(presentationTokens(shotPresentation).ornamentStyle).toBe('port-grid');
  expect(presentationTokens(mediaPresentation).ornamentStyle).toBe('port-grid');
  expect(presentationTokens(mediaPresentation).contentMode).toBe('asset-grid');
  expect(presentationTokens(reviewPresentation).contentMode).toBe('status');
});

test('storyboard and shot-lab user nodes expose port-grid tokens with a 30-cell file grid', () => {
  const presentation = buildNodePresentation(
    buildProjectedNode({
      id: 'node-prompt',
      nodeType: 'prompt',
      title: 'Prompt Variant',
      status: undefined,
      storedAssetCount: 7,
      layout: {
        x: 0,
        y: 0,
        width: 220,
        height: 200,
      },
      screenWidth: 220,
      screenHeight: 200,
    }),
    true,
  );
  const tokens = presentationTokens(presentation);

  expect(tokens.ornamentStyle).toBe('port-grid');
  expect(tokens.hasInputPort).toBe(true);
  expect(tokens.hasOutputPort).toBe(true);
  expect(tokens.titleFontSize).toBe(14);
  expect(tokens.bodyPaddingX).toBe(10);
  expect(tokens.bodyPaddingTop).toBe(9);
  expect(tokens.inputPortWidth).toBe(42);
  expect(tokens.inputPortHeight).toBe(14);
  expect(tokens.inputPortOffsetY).toBe(28);
  expect(tokens.fileGridRows).toBe(3);
  expect(tokens.fileGridColumns).toBe(10);
  expect(tokens.fileGridCapacity).toBe(30);
  expect(tokens.fileGridActiveCount).toBe(7);
  expect(tokens.showAccessoryBlocks).toBe(true);
  expect(tokens.accessoryBlockWidth).toBe(30);
  expect(tokens.accessoryBlockGap).toBe(5);
  expect(tokens.hasActionDot).toBe(false);
  expect(tokens.hasConnector).toBe(false);
});

test('summary nodes keep the full template above the 40 percent scale threshold', () => {
  const presentation = buildNodePresentation(
    buildProjectedNode({
      lod: 'summary',
      projectedArea: 6_656,
      projectedMinEdge: 64,
      screenWidth: 104,
      screenHeight: 64,
    }),
    false,
  );
  const tokens = presentationTokens(presentation);

  expect(presentation.chrome).toBe('card');
  expect(presentation.shape).toBe('card');
  expect(presentation.showTypeLabel).toBe(true);
  expect(presentation.showTitle).toBe(true);
  expect(presentation.showStatus).toBe(true);
  expect(tokens.scaleFactor).toBe(0.5);
  expect(tokens.cornerRadius).toBe(7);
  expect(tokens.typeFontSize).toBe(5.5);
  expect(tokens.titleFontSize).toBe(8);
  expect(tokens.statusFontSize).toBe(6);
  expect(tokens.bodyPaddingX).toBe(7);
  expect(tokens.bodyPaddingTop).toBe(7);
  expect(tokens.headerPanelWidth).toBe(62);
  expect(tokens.headerPanelHeight).toBe(17);
  expect(tokens.actionDotDiameter).toBe(10);
  expect(tokens.connectorWidth).toBe(14);
  expect(tokens.connectorHeight).toBe(6);
});

test('compact lod nodes stay in the same rounded card family', () => {
  const presentation = buildNodePresentation(
    buildProjectedNode({
      lod: 'chip',
      projectedArea: 864,
      projectedMinEdge: 24,
      screenWidth: 36,
      screenHeight: 24,
      canEnterChildGraph: true,
    }),
    false,
  );

  expect(presentation.chrome).toBe('card');
  expect(presentation.shape).toBe('card');
  expect(presentation.cornerRadius).toBeGreaterThan(0);
  expect(presentation.enterable).toBe(true);
  expect(presentation.showTypeLabel).toBe(false);
  expect(presentation.showTitle).toBe(true);
  expect(presentation.showStatus).toBe(false);
  expect(presentationTokens(presentation).hasActionDot).toBe(false);
  expect(presentationTokens(presentation).hasConnector).toBe(false);
});

test('lowest lod nodes keep hit targets as textless mini cards instead of silhouettes', () => {
  const presentation = buildNodePresentation(
    buildProjectedNode({
      lod: 'silhouette',
      projectedArea: 160,
      projectedMinEdge: 10,
      screenWidth: 16,
      screenHeight: 10,
    }),
    false,
  );

  expect(presentation.chrome).toBe('card');
  expect(presentation.shape).toBe('card');
  expect(presentation.borderWidth).toBeGreaterThan(0);
  expect(presentation.cornerRadius).toBeGreaterThan(0);
  expect(presentation.interactive).toBe(true);
  expect(presentation.showTypeLabel).toBe(false);
  expect(presentation.showTitle).toBe(false);
  expect(presentation.showStatus).toBe(false);
});

test('system anchors stay non-interactive while sharing the same card family', () => {
  const presentation = buildNodePresentation(
    buildProjectedNode({
      id: 'anchor-1',
      nodeType: 'system_anchor',
      isSystem: true,
      sourceNodeType: 'brief',
      title: 'Campaign Brief',
      status: undefined,
      lod: 'summary',
      projectedArea: 5_184,
      projectedMinEdge: 54,
      screenWidth: 96,
      screenHeight: 54,
      canEnterChildGraph: false,
    }),
    false,
  );

  expect(presentation.variant).toBe('anchor');
  expect(presentation.chrome).toBe('card');
  expect(presentation.shape).toBe('card');
  expect(presentation.cornerRadius).toBeGreaterThan(0);
  expect(presentation.interactive).toBe(false);
  expect(presentation.showTypeLabel).toBe(true);
  expect(presentation.typeText).toBe('上下文锚点');
  expect(presentation.showStatus).toBe(false);
  expect(presentationTokens(presentation).contentMode).toBe('text');
  expect(presentationTokens(presentation).ornamentStyle).not.toBe('port-grid');
});
