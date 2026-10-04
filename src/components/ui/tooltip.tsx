'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * 提示气泡。用于给图标按钮补可读名称，或解释一个词的意思。
 *
 * **不要用它承载必读信息** —— 触屏上它出不来。必读信息一律写在页面上。
 */
export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'bg-ink-900 text-caption shadow-pop z-50 max-w-[240px] rounded-lg px-2.5 py-1.5 text-white',
          'data-[state=delayed-open]:animate-fade-in',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
