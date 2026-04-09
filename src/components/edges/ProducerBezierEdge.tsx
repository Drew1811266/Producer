import { useMemo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';

import { formatRelationTypeLabelZh } from '../../copy/zh-CN';
import {
  PRODUCER_BEZIER_CURVATURE,
  PRODUCER_BEZIER_EDGE_TYPE,
} from '../../lib/flow/defaultEdgeOptions';
import { cn } from '../../lib/utils';
import { clampProducerBezierCurvature } from './producerBezierEdgeMath';

export type ProducerBezierEdgeData = {
  label?: string | null;
  relationType?: string | null;
  showLabel?: boolean;
};

export type ProducerBezierEdgeRecord = Edge<ProducerBezierEdgeData, typeof PRODUCER_BEZIER_EDGE_TYPE>;

type ProducerBezierVisualState = 'default' | 'hover' | 'selected';

function resolveProducerBezierVisualState(
  selected: boolean,
  hovered: boolean,
): ProducerBezierVisualState {
  if (selected) {
    return 'selected';
  }

  if (hovered) {
    return 'hover';
  }

  return 'default';
}

function resolveProducerBezierStroke(visualState: ProducerBezierVisualState): {
  stroke: string;
  strokeWidth: number;
} {
  switch (visualState) {
    case 'selected':
      return {
        stroke: '#5B84FF',
        strokeWidth: 2,
      };
    case 'hover':
      return {
        stroke: 'rgba(17, 19, 24, 0.34)',
        strokeWidth: 1.75,
      };
    default:
      return {
        stroke: 'rgba(17, 19, 24, 0.22)',
        strokeWidth: 1.5,
      };
  }
}

function resolveProducerBezierCurvature(pathOptions: unknown): number {
  if (!pathOptions || typeof pathOptions !== 'object' || Array.isArray(pathOptions)) {
    return PRODUCER_BEZIER_CURVATURE;
  }

  return clampProducerBezierCurvature(
    'curvature' in pathOptions && typeof pathOptions.curvature === 'number'
      ? pathOptions.curvature
      : PRODUCER_BEZIER_CURVATURE,
  );
}

function resolveProducerBezierLabelText(
  data: ProducerBezierEdgeData | undefined,
  label: EdgeProps<ProducerBezierEdgeRecord>['label'],
): string | null {
  const explicitLabel = data?.label?.trim();

  if (explicitLabel) {
    return explicitLabel;
  }

  const relationType = data?.relationType?.trim();

  if (relationType) {
    return formatRelationTypeLabelZh(relationType);
  }

  return typeof label === 'string' && label.trim() ? label : null;
}

export function ProducerBezierEdge({
  data,
  id,
  interactionWidth,
  label,
  markerEnd,
  pathOptions,
  selected = false,
  sourcePosition = Position.Bottom,
  sourceX,
  sourceY,
  style,
  targetPosition = Position.Top,
  targetX,
  targetY,
}: EdgeProps<ProducerBezierEdgeRecord>) {
  const [hovered, setHovered] = useState(false);
  const visualState = resolveProducerBezierVisualState(selected, hovered);
  const strokeStyle = resolveProducerBezierStroke(visualState);
  const labelText = useMemo(() => resolveProducerBezierLabelText(data, label), [data, label]);
  const showInteractiveLabel = Boolean(data?.showLabel && labelText && (hovered || selected));
  const [path, labelX, labelY] = getBezierPath({
    curvature: resolveProducerBezierCurvature(pathOptions),
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });

  return (
    <>
      <g
        className="producer-bezier-edge"
        data-edge-state={visualState}
        data-edge-type={PRODUCER_BEZIER_EDGE_TYPE}
        data-testid={`producer-bezier-edge-${id}`}
        onMouseEnter={() => {
          setHovered(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
        }}
      >
        <BaseEdge
          className="producer-bezier-edge__path"
          interactionWidth={interactionWidth}
          markerEnd={markerEnd}
          path={path}
          style={{
            ...style,
            ...strokeStyle,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        />
      </g>
      {showInteractiveLabel ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'pointer-events-none absolute rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.06em]',
              selected
                ? 'border-[rgba(91,132,255,0.2)] bg-[rgba(91,132,255,0.12)] text-[var(--accent)]'
                : 'border-[rgba(17,19,24,0.08)] bg-[rgba(255,255,255,0.92)] text-[rgba(17,19,24,0.72)]',
            )}
            style={{
              left: `${labelX}px`,
              top: `${labelY}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
