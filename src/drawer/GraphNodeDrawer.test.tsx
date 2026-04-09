import { fireEvent, render, screen, within } from '@testing-library/react';

import type { GraphNodeSummary, ProjectGraphSummary } from '../bridge/contracts';
import { GraphNodeDrawer } from './GraphNodeDrawer';
import type { GraphNodeDraft } from './nodeDraft';

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-root',
    name: 'Story Graph',
    layerType: 'story',
    isRoot: true,
    ...overrides,
  };
}

function buildNode(overrides: Partial<GraphNodeSummary> = {}): GraphNodeSummary {
  return {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Opening Brief',
    nodeType: 'brief',
    storedAssetCount: 0,
    status: 'Ready',
    layout: {
      x: -180,
      y: -110,
      width: 360,
      height: 180,
    },
    ...overrides,
  };
}

function buildDraft(overrides: GraphNodeDraft = {}): GraphNodeDraft {
  return {
    title: 'Opening Brief',
    description: 'Launch a social teaser for the new trail shoe.',
    ...overrides,
  };
}

test('renders brief nodes as a dedicated description and media drawer', () => {
  const onDraftChange = vi.fn();
  const onAssetRoleChange = vi.fn();
  const onAssetSearchQueryChange = vi.fn();
  const onBindAsset = vi.fn();
  const onUnbindAsset = vi.fn();

  render(
    <GraphNodeDrawer
      autoFocusFieldKey={null}
      detailStatus="ready"
      draft={buildDraft()}
      graph={buildGraph()}
      node={buildNode()}
      onClose={() => undefined}
      onDraftChange={onDraftChange}
      saveStatus="idle"
      width={360}
      {...{
        assetBindings: [
          {
            id: 'binding-image',
            role: 'product_image',
            assetId: 'asset-image',
            assetTitle: 'Hero shoe still',
            assetMediaType: 'image',
            assetStatus: 'ready',
            assetDetail: '1280 x 720 PNG',
          },
          {
            id: 'binding-video',
            role: 'example_video',
            assetId: 'asset-video',
            assetTitle: 'Launch teaser',
            assetMediaType: 'video',
            assetStatus: 'ready',
            assetDetail: '12s MP4',
          },
        ],
        assetRoleOptions: [
          {
            role: 'product_image',
            label: '产品图',
          },
          {
            role: 'example_video',
            label: '示例视频',
          },
        ],
        assetSearchQuery: 'hero',
        assetSearchResults: [
          {
            id: 'asset-image',
            title: 'Hero shoe still',
            mediaType: 'image',
            status: 'ready',
            detail: '1280 x 720 PNG',
          },
          {
            id: 'asset-video',
            title: 'Launch teaser',
            mediaType: 'video',
            status: 'ready',
            detail: '12s MP4',
          },
        ],
        assetSearchStatus: 'ready',
        selectedAssetRole: 'product_image',
        onAssetRoleChange,
        onAssetSearchQueryChange,
        onBindAsset,
        onUnbindAsset,
      }}
    />,
  );

  expect(screen.queryByRole('heading', { name: '内容详情' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '附件' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '关系' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/标题/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/附件角色/)).not.toBeInTheDocument();
  expect(screen.queryByText(/已保存到本地/)).not.toBeInTheDocument();

  const descriptionInput = screen.getByLabelText(/需求描述/);
  fireEvent.change(descriptionInput, {
    target: {
      value: '  Hero launch concept  \nsecond line',
    },
  });
  expect(onDraftChange).toHaveBeenCalledWith(
    expect.objectContaining({
      description: '  Hero launch concept  \nsecond line',
      title: 'Hero launch concept',
    }),
  );

  const productSection = screen.getByRole('heading', { name: '产品图' }).closest('section');
  expect(productSection).not.toBeNull();
  expect(within(productSection!).getAllByText('Hero shoe still').length).toBeGreaterThan(0);
  expect(within(productSection!).queryByText('Launch teaser')).not.toBeInTheDocument();
  fireEvent.change(within(productSection!).getByLabelText(/搜索产品图素材/), {
    target: { value: 'hero still' },
  });
  expect(onAssetRoleChange).toHaveBeenCalledWith('product_image');
  expect(onAssetSearchQueryChange).toHaveBeenCalledWith('hero still');
  fireEvent.click(within(productSection!).getByRole('button', { name: /绑定 hero shoe still/i }));
  fireEvent.click(within(productSection!).getByRole('button', { name: /解绑 产品图/i }));

  const videoSection = screen.getByRole('heading', { name: '示例视频' }).closest('section');
  expect(videoSection).not.toBeNull();
  expect(within(videoSection!).getAllByText('Launch teaser').length).toBeGreaterThan(0);
  fireEvent.change(within(videoSection!).getByLabelText(/搜索示例视频素材/), {
    target: { value: 'launch' },
  });
  expect(onAssetRoleChange).toHaveBeenCalledWith('example_video');
  expect(onAssetSearchQueryChange).toHaveBeenCalledWith('launch');
  fireEvent.click(within(videoSection!).getByRole('button', { name: /解绑 示例视频/i }));

  expect(onBindAsset).toHaveBeenCalledWith('asset-image');
  expect(onUnbindAsset).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'binding-image',
      role: 'product_image',
    }),
  );
  expect(onUnbindAsset).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'binding-video',
      role: 'example_video',
    }),
  );
});

test('renders a controlled attachments section and forwards bind actions for non-brief nodes', () => {
  const onAssetSearchQueryChange = vi.fn();
  const onAssetRoleChange = vi.fn();
  const onBindAsset = vi.fn();
  const onUnbindAsset = vi.fn();

  render(
    <GraphNodeDrawer
      autoFocusFieldKey={null}
      detailStatus="ready"
      draft={{
        title: 'Hero Still',
        status: 'Candidate',
        selection_reason: 'Most usable composition',
      }}
      graph={buildGraph()}
      node={buildNode({
        id: 'node-still',
        title: 'Hero Still',
        nodeType: 'still',
        status: 'Candidate',
      })}
      onClose={() => undefined}
      onDraftChange={() => undefined}
      saveStatus="idle"
      width={360}
      {...{
        assetBindings: [
          {
            id: 'binding-1',
            role: 'preview',
            assetId: 'asset-1',
            assetTitle: 'Hero still',
            assetMediaType: 'image',
            assetStatus: 'ready',
            assetDetail: '1280 x 720 PNG',
          },
        ],
        assetRoleOptions: [
          {
            role: 'reference',
            label: '参考',
          },
          {
            role: 'preview',
            label: '预览',
          },
        ],
        assetSearchQuery: 'hero',
        assetSearchResults: [
          {
            id: 'asset-1',
            title: 'Hero still',
            mediaType: 'image',
            status: 'ready',
            detail: '1280 x 720 PNG',
          },
          {
            id: 'asset-2',
            title: 'Mood board PDF',
            mediaType: 'document',
            status: 'ready',
            detail: '12 pages',
          },
        ],
        assetSearchStatus: 'ready',
        selectedAssetRole: 'preview',
        onAssetSearchQueryChange,
        onAssetRoleChange,
        onBindAsset,
        onUnbindAsset,
      }}
    />,
  );

  const attachmentsSection = screen.getByRole('heading', { name: '附件' }).closest('section');

  expect(attachmentsSection).not.toBeNull();
  expect(screen.queryByText(/节点抽屉/)).not.toBeInTheDocument();
  expect(within(attachmentsSection!).getByRole('heading', { name: '预览' })).toBeInTheDocument();
  expect(within(attachmentsSection!).getByText('已绑定')).toBeInTheDocument();
  expect(within(attachmentsSection!).getByText('绑定素材')).toBeInTheDocument();
  expect(
    within(attachmentsSection!).getByRole('img', { name: /hero still附件预览/i }),
  ).toBeInTheDocument();
  expect(within(attachmentsSection!).getAllByText('Hero still').length).toBeGreaterThan(0);
  expect(within(attachmentsSection!).getAllByText('1280 x 720 PNG').length).toBeGreaterThan(0);
  expect(within(attachmentsSection!).getAllByText('预览').length).toBeGreaterThan(0);
  expect(within(attachmentsSection!).getByText('Mood board PDF')).toBeInTheDocument();

  fireEvent.change(within(attachmentsSection!).getByLabelText(/搜索素材/), {
    target: { value: 'hero still' },
  });
  fireEvent.change(within(attachmentsSection!).getByLabelText(/附件角色/), {
    target: { value: 'reference' },
  });
  fireEvent.click(within(attachmentsSection!).getByRole('button', { name: /绑定 hero still/i }));
  fireEvent.click(within(attachmentsSection!).getByRole('button', { name: /解绑 预览/i }));

  expect(onAssetSearchQueryChange).toHaveBeenCalledWith('hero still');
  expect(onAssetRoleChange).toHaveBeenCalledWith('reference');
  expect(onBindAsset).toHaveBeenCalledWith('asset-1');
  expect(onUnbindAsset).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'binding-1',
      role: 'preview',
    }),
  );
});

test('renders controlled incoming and outgoing relations plus create and delete actions', () => {
  const onRelationTypeChange = vi.fn();
  const onRelationTargetChange = vi.fn();
  const onCreateRelation = vi.fn();
  const onDeleteRelation = vi.fn();

  render(
    <GraphNodeDrawer
      autoFocusFieldKey={null}
      detailStatus="ready"
      draft={{
        title: 'Prompt A',
        prompt_text: 'Hero shoe on reflective floor',
        negative_prompt: 'Blurry frame',
      }}
      graph={buildGraph()}
      node={buildNode({
        id: 'node-prompt',
        title: 'Prompt A',
        nodeType: 'prompt',
      })}
      onClose={() => undefined}
      onDraftChange={() => undefined}
      saveStatus="idle"
      width={360}
      {...{
        relations: {
          outgoing: [
            {
              id: 'relation-1',
              direction: 'outgoing',
              relationType: 'references',
              nodeId: 'node-2',
              nodeTitle: 'Mood Board',
            },
          ],
          incoming: [
            {
              id: 'relation-2',
              direction: 'incoming',
              relationType: 'variant_of',
              nodeId: 'node-3',
              nodeTitle: 'Alt Brief',
            },
          ],
        },
        relationTypeOptions: [
          {
            value: 'references',
            label: '参考',
          },
          {
            value: 'variant_of',
            label: '变体自',
          },
        ],
        relationCreateState: {
          relationType: 'references',
          targetNodeId: 'node-2',
          targetOptions: [
            {
              id: 'node-2',
              title: 'Mood Board',
            },
            {
              id: 'node-3',
              title: 'Alt Brief',
            },
          ],
        },
        relationDeleteState: {
          pendingRelationId: null,
        },
        onRelationTypeChange,
        onRelationTargetChange,
        onCreateRelation,
        onDeleteRelation,
      }}
    />,
  );

  const relationsSection = screen.getByRole('heading', { name: '关系' }).closest('section');

  expect(relationsSection).not.toBeNull();
  expect(within(relationsSection!).getByText('发出关系')).toBeInTheDocument();
  expect(within(relationsSection!).getByText('进入关系')).toBeInTheDocument();
  expect(within(relationsSection!).getByRole('heading', { name: '添加关系' })).toBeInTheDocument();
  expect(within(relationsSection!).getAllByText(/参考/).length).toBeGreaterThan(0);
  expect(within(relationsSection!).getAllByText(/变体自/).length).toBeGreaterThan(0);
  expect(within(relationsSection!).getAllByText('Mood Board').length).toBeGreaterThan(0);
  expect(within(relationsSection!).getAllByText('Alt Brief').length).toBeGreaterThan(0);
  expect(within(relationsSection!).getByLabelText(/关系类型/)).toBeInTheDocument();
  expect(within(relationsSection!).getByLabelText(/目标节点/)).toBeInTheDocument();
  expect(within(relationsSection!).getByRole('button', { name: /添加关系/ })).toBeInTheDocument();

  fireEvent.change(within(relationsSection!).getByLabelText(/关系类型/), {
    target: { value: 'variant_of' },
  });
  fireEvent.change(within(relationsSection!).getByLabelText(/目标节点/), {
    target: { value: 'node-3' },
  });
  fireEvent.click(within(relationsSection!).getByRole('button', { name: /添加关系/ }));
  fireEvent.click(within(relationsSection!).getByRole('button', { name: /删除关系 relation-1/i }));

  expect(onRelationTypeChange).toHaveBeenCalledWith('variant_of');
  expect(onRelationTargetChange).toHaveBeenCalledWith('node-3');
  expect(onCreateRelation).toHaveBeenCalledTimes(1);
  expect(onDeleteRelation).toHaveBeenCalledWith('relation-1');
});
