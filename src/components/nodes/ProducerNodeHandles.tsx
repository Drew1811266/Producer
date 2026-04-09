import { Position } from '@xyflow/react';

import type { ProducerNodeVisual } from '../../canvas/producerNodeSystem';
import { BaseHandle } from '../base-handle';

export const PRODUCER_TARGET_HANDLE_ID = 'in';
export const PRODUCER_SOURCE_HANDLE_ID = 'out';

type ProducerNodeHandlesProps = {
  nodeId: string;
  visual: Pick<ProducerNodeVisual, 'sourceHandle' | 'targetHandle'>;
};

function resolveHandlePosition(handlePosition: 'top' | 'bottom'): Position {
  return handlePosition === 'top' ? Position.Top : Position.Bottom;
}

function resolveHandleOffsetClassName(handlePosition: 'top' | 'bottom'): string {
  return handlePosition === 'top' ? '!-top-1.5' : '!-bottom-1.5';
}

export function ProducerNodeHandles({ nodeId, visual }: ProducerNodeHandlesProps) {
  return (
    <>
      {visual.targetHandle ? (
        <BaseHandle
          className={resolveHandleOffsetClassName(visual.targetHandle)}
          data-producer-handle-id={PRODUCER_TARGET_HANDLE_ID}
          data-testid={`producer-handle-${nodeId}-${PRODUCER_TARGET_HANDLE_ID}`}
          id={PRODUCER_TARGET_HANDLE_ID}
          position={resolveHandlePosition(visual.targetHandle)}
          type="target"
        />
      ) : null}
      {visual.sourceHandle ? (
        <BaseHandle
          className={resolveHandleOffsetClassName(visual.sourceHandle)}
          data-producer-handle-id={PRODUCER_SOURCE_HANDLE_ID}
          data-testid={`producer-handle-${nodeId}-${PRODUCER_SOURCE_HANDLE_ID}`}
          id={PRODUCER_SOURCE_HANDLE_ID}
          position={resolveHandlePosition(visual.sourceHandle)}
          type="source"
        />
      ) : null}
    </>
  );
}
