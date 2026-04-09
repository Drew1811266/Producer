import { Position, type HandleProps } from '@xyflow/react';

import { BaseHandle } from './base-handle';
import { cn } from '../lib/utils';

type LabeledHandleProps = Omit<HandleProps, 'position'> & {
  label: string;
  position: Position;
};

export function LabeledHandle({ className, label, position, type = 'source', ...props }: LabeledHandleProps) {
  return (
    <div className={cn('absolute flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]', className)}>
      <span>{label}</span>
      <BaseHandle position={position} type={type} {...props} />
    </div>
  );
}
