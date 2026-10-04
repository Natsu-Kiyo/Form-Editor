'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@/utils/cn';

export type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root>;

/**
 * 开关。设计稿规格：轨道 40×22，滑块 18，间距 2。
 *
 * 滑块上的 `shadow-sm` 是设计系统明确允许的例外之一 ——
 * 「控件真的浮在另一层之上」时才有阴影，普通按钮一律没有。
 */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'bg-ink-200 relative h-[22px] w-10 shrink-0 rounded-full',
        'transition-colors duration-150',
        'data-[state=checked]:bg-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-[18px] translate-x-0.5 rounded-full bg-white shadow-sm',
          'transition-transform duration-150',
          'data-[state=checked]:translate-x-[20px]',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
