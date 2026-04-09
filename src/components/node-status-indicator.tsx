import { cn } from '../lib/utils';

export type NodeStatusIndicatorTone = 'success' | 'loading' | 'error' | 'initial';

type NodeStatusIndicatorProps = {
  className?: string;
  mode?: 'border' | 'overlay';
  tone: NodeStatusIndicatorTone;
};

const STATUS_STYLES: Record<NodeStatusIndicatorTone, { dot: string; ring: string }> = {
  success: {
    dot: 'bg-[var(--status-success)]',
    ring: 'border-[color:color-mix(in_srgb,var(--status-success)_58%,transparent)]',
  },
  loading: {
    dot: 'bg-[var(--accent)]',
    ring: 'border-[color:color-mix(in_srgb,var(--accent)_58%,transparent)]',
  },
  error: {
    dot: 'bg-[var(--status-danger)]',
    ring: 'border-[color:color-mix(in_srgb,var(--status-danger)_58%,transparent)]',
  },
  initial: {
    dot: 'bg-[var(--text-quaternary)]',
    ring: 'border-[var(--border-subtle)]',
  },
};

export function NodeStatusIndicator({
  className,
  mode = 'overlay',
  tone,
}: NodeStatusIndicatorProps) {
  const styles = STATUS_STYLES[tone];

  if (mode === 'border') {
    return (
      <span
        aria-hidden="true"
        className={cn('absolute inset-0 rounded-[inherit] border pointer-events-none', styles.ring, className)}
        data-status-tone={tone}
        data-testid="producer-node-status"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[color:color-mix(in_srgb,var(--surface-panel-strong)_88%,transparent)]',
        styles.dot,
        className,
      )}
      data-status-tone={tone}
      data-testid="producer-node-status"
    />
  );
}
