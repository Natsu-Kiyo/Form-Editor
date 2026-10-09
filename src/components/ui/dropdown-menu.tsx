'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '@/utils/cn';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'border-ink-200 shadow-pop z-50 min-w-[184px] overflow-hidden rounded-xl border bg-white p-1',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export type DropdownMenuItemProps = React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  icon?: React.ReactNode;
  /** 右侧角标，用于 1.1 / 2.0 规划功能的灰显（配 `disabled` 使用） */
  badge?: string;
  tone?: 'default' | 'danger';
};

/**
 * 菜单项。
 *
 * 灰显用法（无假入口规则）：`<DropdownMenuItem disabled badge="2.0">…</DropdownMenuItem>` ——
 * disabled 之后 Radix 不会给高亮底色，也就没有「看起来能点」的假反馈。
 */
export function DropdownMenuItem({
  className,
  children,
  icon,
  badge,
  tone = 'default',
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5',
        'text-body-s outline-none select-none',
        tone === 'danger'
          ? 'text-rose-600 data-[highlighted]:bg-rose-50'
          : 'text-ink-700 data-[highlighted]:bg-ink-50',
        'data-[disabled]:text-ink-400 data-[disabled]:pointer-events-none',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
      {badge ? (
        <span className="bg-ink-100 text-ink-400 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
          {badge}
        </span>
      ) : null}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('text-caption text-ink-400 px-2.5 py-1.5 font-semibold', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator className={cn('bg-ink-100 my-1 h-px', className)} {...props} />
  );
}
