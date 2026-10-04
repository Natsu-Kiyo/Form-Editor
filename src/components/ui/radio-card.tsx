'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@/utils/cn';

export const RadioGroup = RadioGroupPrimitive.Root;

export type RadioCardProps = React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 右上角角标，例如「推荐」 */
  badge?: React.ReactNode;
};

/**
 * 单选卡。用于「作答身份三选一」（匿名 / 需登录 / 口令访问）这类
 * **发布时的必选项** —— 两端都不能省，字段与顺序必须逐项一致。
 *
 * 选中态：描边转 2px 品牌色 + brand-50 淡底，圆点填充品牌色。
 */
export function RadioCard({
  className,
  title,
  description,
  badge,
  children,
  ...props
}: RadioCardProps) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'group rounded-card border-ink-200 w-full border bg-white p-4 text-left',
        'hover:border-brand-300 transition-colors duration-150',
        'data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-50/40 data-[state=checked]:border-2',
        'disabled:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
            'border-ink-300 border-[1.5px] transition-colors duration-150',
            'group-data-[state=checked]:border-brand-500',
          )}
        >
          <RadioGroupPrimitive.Indicator className="bg-brand-500 size-2 rounded-full" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-s text-ink-900 font-medium">{title}</span>
            {badge}
          </div>
          {description ? <p className="text-label text-ink-500 mt-1">{description}</p> : null}
          {children}
        </div>
      </div>
    </RadioGroupPrimitive.Item>
  );
}

/** 单选卡右上角的角标样式，例如「推荐」 */
export function RadioCardBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-brand-50 text-brand-600 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium">
      {children}
    </span>
  );
}
