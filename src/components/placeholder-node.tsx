import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/utils';

type PlaceholderNodeProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  description?: string;
  label: string;
};

export function PlaceholderNode({
  className,
  description,
  label,
  type = 'button',
  ...props
}: PlaceholderNodeProps) {
  return (
    <button
      className={cn(
        'group flex w-[240px] flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-[var(--border-accent)] bg-[color:color-mix(in_srgb,var(--surface-panel-strong)_92%,transparent)] px-6 py-8 text-center shadow-[0_18px_42px_rgba(18,25,38,0.06)] transition hover:border-[var(--accent)] hover:bg-[color:color-mix(in_srgb,var(--accent-soft)_65%,var(--surface-panel-strong))]',
        className,
      )}
      data-testid="producer-placeholder-node"
      type={type}
      {...props}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xl font-medium text-[var(--accent)] transition group-hover:scale-105">
        +
      </span>
      <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{label}</span>
      {description ? <span className="text-xs text-[var(--text-secondary)]">{description}</span> : null}
    </button>
  );
}
