import { Handle, Position, type HandleProps } from '@xyflow/react';

import { cn } from '../lib/utils';

type BaseHandleProps = Omit<HandleProps, 'position'> & {
  position: Position;
};

export function BaseHandle({ className, position, type = 'source', ...props }: BaseHandleProps) {
  return (
    <Handle
      className={cn(
        '!z-10 !h-3 !w-12 !pointer-events-auto !rounded-full !border !border-[rgba(90,105,122,0.22)] !bg-[var(--surface-panel-strong)] !shadow-none',
        className,
      )}
      position={position}
      type={type}
      {...props}
    />
  );
}
