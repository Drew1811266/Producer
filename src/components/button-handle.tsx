import { Position, type HandleProps } from '@xyflow/react';

import { BaseHandle } from './base-handle';
import { cn } from '../lib/utils';

type ButtonHandleProps = Omit<HandleProps, 'position'> & {
  label: string;
  onClick(): void;
  position: Position;
};

export function ButtonHandle({
  className,
  label,
  onClick,
  position,
  type = 'source',
  ...props
}: ButtonHandleProps) {
  return (
    <div className={cn('absolute flex items-center gap-2', className)}>
      <button
        className="nodrag inline-flex h-7 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel-strong)] px-3 text-[11px] font-medium text-[var(--text-primary)]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {label}
      </button>
      <BaseHandle position={position} type={type} {...props} />
    </div>
  );
}
