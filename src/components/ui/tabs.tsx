'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/utils/cn';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

/**
 * 页内一级 Tab（问卷内导航：编辑 / 发布设置 / 分享 / 数据 / 答卷）。
 *
 * 关键约束（设计系统 §06）：这行导航在五个页面里必须**逐字一致、位置一致**，
 * 缺任何一个用户就会以为那个功能不存在。容器左右内边距与顶栏保持一致（px-6），
 * 否则换页时 Tab 会横向跳动。
 */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('border-ink-200 flex items-center gap-1 border-b px-6', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'text-body-s -mb-px h-11 border-b-2 border-transparent px-4 font-medium whitespace-nowrap',
        'text-ink-500 hover:text-ink-800 transition-colors duration-150',
        'data-[state=active]:border-brand-500 data-[state=active]:text-brand-500',
        'disabled:text-ink-400 disabled:hover:text-ink-400 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  );
}
