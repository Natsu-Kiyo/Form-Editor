'use client';

import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/utils/cn';

export type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root> & {
  /** 展示必填星号 */
  required?: boolean;
  /** 控件禁用时用 ink-400（本身不承载必读信息） */
  disabled?: boolean;
};

/**
 * 表单标签。
 *
 * 必填星号用 CSS `::after` 而不是真实节点 —— 若用 `<span>*</span>`，
 * 标签的**文本内容**会变成「密码 *」，于是：
 * - 读屏会把星号读出来；
 * - `getByLabel('密码', { exact: true })` 之类的精确匹配会失配。
 * 用伪元素渲染，视觉一致而文本干净。
 */
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
        required && "after:ml-0.5 after:text-rose-500 after:content-['*']",
        className,
      )}
      {...props}
    >
      {children}
    </LabelPrimitive.Root>
  );
}
