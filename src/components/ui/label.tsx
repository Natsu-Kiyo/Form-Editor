'use client';

import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/utils/cn';

export type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root> & {
  /** 展示必填星号。星号对读屏隐藏，必填语义交给控件的 required 属性 */
  required?: boolean;
  /** 控件禁用时用 ink-400（本身不承载必读信息） */
  disabled?: boolean;
};

export function Label({
  className,
  children,
  required = false,
  disabled = false,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-label mb-2 block font-medium',
        disabled ? 'text-ink-400' : 'text-ink-600',
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-rose-500">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
}
