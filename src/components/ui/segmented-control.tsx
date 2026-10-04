'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@/utils/cn';

export type SegmentedOption<TValue extends string> = {
  value: TValue;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SegmentedControlProps<TValue extends string> = {
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: SegmentedOption<TValue>[];
  /** 三段及以上的视图切换建议给，读屏会念出来 */
  'aria-label'?: string;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * 分段控件（统计页「日 / 周 / 月」、预览弹层「手机 / 桌面」这类视图切换）。
 *
 * 选中块用 `shadow-sm` 交代它被「抬起来」—— 这是设计系统允许的第二类阴影例外：
 * 白块压在 `bg-ink-100` 灰色轨道上，靠一层极淡的阴影分层，而不是靠颜色。
 *
 * 语义用 radiogroup：Radix 的 RadioGroup 自带方向键导航与 roving tabindex，
 * 比手写 tablist 键盘逻辑更稳。
 */
export function SegmentedControl<TValue extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<TValue>) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(next) => onValueChange(next as TValue)}
      orientation="horizontal"
      aria-label={ariaLabel}
      className={cn('bg-ink-100 inline-flex items-center gap-0.5 rounded-[10px] p-0.5', className)}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            'inline-flex items-center justify-center rounded-lg px-3 font-medium',
            'text-ink-500 hover:text-ink-800 transition-colors duration-150',
            size === 'sm' ? 'text-caption h-6' : 'text-label h-7',
            'data-[state=checked]:text-ink-900 data-[state=checked]:bg-white data-[state=checked]:shadow-sm',
            'disabled:text-ink-400 disabled:hover:text-ink-400 disabled:cursor-not-allowed',
          )}
        >
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
