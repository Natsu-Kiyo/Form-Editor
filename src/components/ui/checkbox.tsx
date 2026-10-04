'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { CheckIcon } from '@/components/icons/ui-icons';
import { cn } from '@/utils/cn';

export type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root>;

/** 多选/勾选。4×4，选中为品牌色填充 + 白色对勾 */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[5px]',
        'border-ink-300 border-[1.5px] bg-white',
        'transition-colors duration-150',
        'data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500',
        'disabled:border-ink-200 disabled:bg-ink-100 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <CheckIcon className="size-3 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
