import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';

import { cn } from '../lib/utils';

export type ProducerEdgeData = {
  emphasis: 'muted' | 'selected';
  label?: string | null;
};

export type ProducerEdgeRecord = Edge<ProducerEdgeData, 'producer-edge'>;

export function ProducerEdge({
  data,
  label,
  markerEnd,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<ProducerEdgeRecord>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
    offset: 24,
  });
  const emphasis = data?.emphasis ?? (selected ? 'selected' : 'muted');
  const resolvedLabel = data?.label ?? (typeof label === 'string' ? label : null);

  return (
    <>
      <BaseEdge
        markerEnd={markerEnd}
        path={path}
        style={{
          stroke: emphasis === 'selected' ? 'rgba(91, 132, 255, 0.88)' : 'rgba(102, 115, 132, 0.24)',
          strokeWidth: emphasis === 'selected' ? 2.1 : 1.35,
        }}
      />
      {resolvedLabel ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.06em]',
              emphasis === 'selected'
                ? 'border-[rgba(91,132,255,0.24)] bg-[rgba(91,132,255,0.12)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-panel-strong)_88%,transparent)] text-[var(--text-tertiary)]',
            )}
            style={{
              left: `${labelX}px`,
              top: `${labelY}px`,
            }}
          >
            {resolvedLabel}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
