import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/utils';

type BaseNodeProps = HTMLAttributes<HTMLDivElement>;

export const BaseNode = forwardRef<HTMLDivElement, BaseNodeProps>(function BaseNode(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border bg-[var(--surface-panel-strong)] shadow-[0_18px_48px_rgba(19,27,39,0.08)] transition-[border-color,box-shadow,transform] duration-200',
        className,
      )}
      {...props}
    />
  );
});

export function BaseNodeHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex items-center gap-2 px-4 py-3', className)} {...props} />;
}

export function BaseNodeHeaderTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('min-w-0 flex-1 text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]', className)}
      {...props}
    />
  );
}

export function BaseNodeContent({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex min-h-0 flex-col gap-3 px-4 pb-4', className)} {...props} />;
}

export function BaseNodeFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3', className)}
      {...props}
    />
  );
}
