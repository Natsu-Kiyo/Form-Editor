'use client';

import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/utils/cn';

export type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
};

/** 线性进度条。用于作答页完成度、回收进度等场景 */
export function Progress({ className, indicatorClassName, value, ...props }: ProgressProps) {
  // Radix 的 value 类型是 `number | null`（null 表示不确定进度）。
  // 本项目不用不确定态，统一按 0 处理。
  const percent = typeof value === 'number' ? value : 0;

  return (
    <ProgressPrimitive.Root
      value={percent}
      className={cn('bg-ink-200 h-1.5 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'bg-brand-500 h-full rounded-full transition-transform duration-200 ease-out',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
