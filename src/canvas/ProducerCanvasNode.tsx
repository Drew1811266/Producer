import type { Node, NodeProps } from '@xyflow/react';

import {
  BaseNode,
  BaseNodeContent,
  BaseNodeFooter,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from '../components/base-node';
import { ProducerNodeHandles } from '../components/nodes/ProducerNodeHandles';
import { NodeAppendix } from '../components/node-appendix';
import { NodeStatusIndicator } from '../components/node-status-indicator';
import { PlaceholderNode } from '../components/placeholder-node';
import { cn } from '../lib/utils';
import type { GraphNodeSummary } from '../bridge/contracts';
import {
  formatProducerNodeTypeLabelZh,
  type ProducerNodeVisual,
} from './producerNodeSystem';

type ProducerCanvasNodeActions = {
  onEnterNode(nodeId: string): void;
  onInspectNode(nodeId: string): void;
};

export type ProducerCanvasNodeData = {
  actions: ProducerCanvasNodeActions;
  graphLayerType: string;
  node: GraphNodeSummary;
  visual: ProducerNodeVisual;
};

export type ProducerCanvasNodeRecord = Node<ProducerCanvasNodeData, 'producer-node'>;

export type ProducerPlaceholderNodeData = {
  description?: string;
  label: string;
  onAdd(): void;
};

export type ProducerPlaceholderNodeRecord = Node<ProducerPlaceholderNodeData, 'producer-placeholder'>;

function resolveNodeFrameClassName(visual: ProducerNodeVisual, selected: boolean): string {
  return cn(
    'border-[var(--border-subtle)] bg-[var(--surface-panel-strong)] text-[var(--text-primary)]',
    selected && 'border-[var(--accent)] shadow-[0_0_0_3px_var(--focus-ring),0_18px_48px_rgba(19,27,39,0.12)]',
    visual.chroma === 'action-bar' &&
      'border-[color:color-mix(in_srgb,var(--accent)_16%,var(--border-subtle))] bg-[color:color-mix(in_srgb,var(--surface-panel-strong)_94%,var(--accent-soft))]',
    visual.chroma === 'annotation' &&
      'border-[rgba(160,141,116,0.28)] bg-[linear-gradient(180deg,rgba(255,252,245,0.98),rgba(248,242,230,0.96))]',
    visual.weak &&
      'border-dashed border-[color:color-mix(in_srgb,var(--text-quaternary)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-panel-muted)_92%,var(--surface-panel-strong))] opacity-85 shadow-none',
  );
}

function resolveEyebrowClassName(visual: ProducerNodeVisual): string {
  return cn(
    'text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]',
    visual.chroma === 'annotation' && 'text-[rgba(124,101,74,0.72)]',
    visual.weak && 'text-[var(--text-quaternary)]',
  );
}

function resolveBodyCopy(data: ProducerCanvasNodeData): string {
  const { node, visual } = data;

  switch (visual.producerType) {
    case 'demand':
      return '聚焦目标、卖点、受众与约束，保持为 Brief Canvas 的上层结构节点。';
    case 'shot':
      return '承载镜头目标、动作与构图，保持 Storyboard Canvas 的垂直树状连接。';
    case 'prompt':
      return '用于提示词草案、参数思路和快速版本切换。';
    case 'frame':
      return node.status?.trim() ? `静帧生成状态：${node.status}` : '静帧候选与缩略图结果。';
    case 'video':
      return node.status?.trim() ? `视频生成状态：${node.status}` : '视频候选、导出入口与版本筛选。';
    case 'reference':
      return node.storedAssetCount > 0
        ? `已绑定 ${node.storedAssetCount} 个参考素材。`
        : '参考图、片段或风格样本。';
    case 'review':
      return node.status?.trim() ? node.status : '导演备注、客户反馈与筛选结论。';
    case 'selected_result':
      return '当前镜头已采用的结果节点。';
    case 'demand_anchor':
      return '继承上层需求上下文。';
    case 'shot_anchor':
      return '继承当前分镜上下文。';
    default:
      return '';
  }
}

function renderNodeActions(data: ProducerCanvasNodeData) {
  const { actions, node, visual } = data;

  if (visual.chroma !== 'action-bar') {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
      <button
        className="nodrag inline-flex h-7 items-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-panel-strong)_92%,transparent)] px-3 text-[11px] font-medium text-[var(--text-primary)]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          actions.onInspectNode(node.id);
        }}
      >
        详情
      </button>
      {node.canEnterChildGraph ? (
        <button
          className="nodrag inline-flex h-7 items-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--accent-soft)_72%,var(--surface-panel-strong))] px-3 text-[11px] font-medium text-[var(--accent)]"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.onEnterNode(node.id);
          }}
        >
          进入
        </button>
      ) : null}
    </div>
  );
}

function renderFooter(data: ProducerCanvasNodeData) {
  const { node, visual } = data;

  if (visual.chroma === 'annotation') {
    return (
      <BaseNodeFooter className="border-t-0 pt-0">
        <div className="rounded-2xl bg-[rgba(160,141,116,0.12)] px-3 py-2 text-xs leading-5 text-[rgba(103,81,57,0.82)]">
          {resolveBodyCopy(data)}
        </div>
      </BaseNodeFooter>
    );
  }

  if (visual.producerType === 'selected_result') {
    return (
      <BaseNodeFooter className="justify-between">
        <div className="text-xs text-[var(--text-secondary)]">{resolveBodyCopy(data)}</div>
        {visual.appendixLabel ? <NodeAppendix>{visual.appendixLabel}</NodeAppendix> : null}
      </BaseNodeFooter>
    );
  }

  if (visual.chroma === 'action-bar') {
    return (
      <BaseNodeFooter className="justify-between">
        <div className="text-xs text-[var(--text-secondary)]">
          {node.storedAssetCount > 0 ? `素材 ${node.storedAssetCount}` : resolveBodyCopy(data)}
        </div>
      </BaseNodeFooter>
    );
  }

  return null;
}

export function ProducerCanvasNode({ data, id, selected }: NodeProps<ProducerCanvasNodeRecord>) {
  const { node, visual } = data;
  const typeLabel = formatProducerNodeTypeLabelZh(node);
  const statusTone = visual.statusTone;
  const showInlineStatus =
    visual.showStatusIndicator &&
    (visual.producerType === 'selected_result' || statusTone === 'success' || statusTone === 'error');
  const showBorderStatus =
    visual.showStatusIndicator &&
    (visual.producerType === 'frame' || visual.producerType === 'video') &&
    statusTone === 'loading';

  return (
    <div className="group relative" data-node-id={id}>
      <ProducerNodeHandles nodeId={node.id} visual={visual} />
      <div
        aria-label={node.title}
        className="block h-full w-full cursor-pointer bg-transparent text-left"
        data-node-id={node.id}
        data-node-source-handle={visual.sourceHandle ?? 'none'}
        data-node-target-handle={visual.targetHandle ?? 'none'}
        data-node-world-x={Math.round(node.layout.x)}
        data-node-world-y={Math.round(node.layout.y)}
        data-producer-node-chroma={visual.chroma}
        data-producer-node-type={visual.producerType}
        data-testid={`producer-node-${id}`}
        role="button"
        tabIndex={node.isSystem ? -1 : 0}
      >
        <BaseNode className={resolveNodeFrameClassName(visual, selected)}>
          {showBorderStatus ? <NodeStatusIndicator mode="border" tone={statusTone} /> : null}
          <BaseNodeHeader
            className={cn(
              'producer-node-drag-handle items-start justify-between pb-2',
              visual.weak && 'pb-1.5',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={resolveEyebrowClassName(visual)}>{typeLabel}</span>
              <BaseNodeHeaderTitle className={cn(visual.weak && 'text-[var(--text-secondary)]')}>
                {node.title}
              </BaseNodeHeaderTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showInlineStatus ? <NodeStatusIndicator tone={statusTone} /> : null}
              {renderNodeActions(data)}
            </div>
          </BaseNodeHeader>

          <BaseNodeContent className={cn(visual.chroma === 'annotation' && 'pt-0')}>
            {visual.chroma !== 'annotation' ? (
              <p className={cn('text-xs leading-5 text-[var(--text-secondary)]', visual.weak && 'text-[var(--text-tertiary)]')}>
                {resolveBodyCopy(data)}
              </p>
            ) : null}

            {node.status?.trim() && visual.producerType !== 'frame' && visual.producerType !== 'video' ? (
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {node.status}
              </span>
            ) : null}

            {(visual.producerType === 'frame' || visual.producerType === 'video' || visual.producerType === 'reference') &&
            node.storedAssetCount > 0 ? (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {Array.from({ length: Math.min(node.storedAssetCount, 4) }).map((_, index) => (
                  <span
                    key={`${node.id}-asset-${index}`}
                    className="aspect-[1.1] rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-panel-muted)_82%,var(--surface-panel-strong))]"
                  />
                ))}
              </div>
            ) : null}
          </BaseNodeContent>

          {renderFooter(data)}
        </BaseNode>
      </div>
    </div>
  );
}

export function ProducerPlaceholderCanvasNode({
  data,
}: NodeProps<ProducerPlaceholderNodeRecord>) {
  return (
    <PlaceholderNode
      description={data.description}
      label={data.label}
      onClick={(event) => {
        event.stopPropagation();
        data.onAdd();
      }}
    />
  );
}
