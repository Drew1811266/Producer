import { cn } from '../lib/utils';

type NodeAppendixProps = {
  children: string;
  className?: string;
};

export function NodeAppendix({ children, className }: NodeAppendixProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]',
        className,
      )}
      data-testid="producer-node-appendix"
    >
      {children}
    </span>
  );
}
