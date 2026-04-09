import type { HTMLAttributes } from 'react';

import { cn } from '../lib/utils';

type LabeledGroupNodeProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

export function LabeledGroupNode({ children, className, label, ...props }: LabeledGroupNodeProps) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-dashed border-[var(--border-accent)] bg-[color:color-mix(in_srgb,var(--surface-panel-strong)_70%,transparent)] p-4',
        className,
      )}
      {...props}
    >
      {label ? (
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}
