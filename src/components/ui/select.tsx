'use client';

import * as SelectPrimitive from '@radix-ui/react-select';

import { CheckIcon, ChevronDownIcon } from '@/components/icons/ui-icons';
import { cn } from '@/utils/cn';

import { fieldBase, fieldBorder, fieldErrorBorder, fieldHeight } from './field';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export type SelectTriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  invalid?: boolean;
  size?: keyof typeof fieldHeight;
};

/** 触发器外观与 Input 完全一致，只是右侧多一个 chevron */
export function SelectTrigger({
  className,
  children,
  invalid = false,
  size = 'md',
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        fieldHeight[size],
        invalid ? fieldErrorBorder : fieldBorder,
        'flex items-center justify-between gap-2 text-left',
        'data-[placeholder]:text-ink-400',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="text-ink-400 size-3.5 shrink-0" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={6}
        className={cn(
          'border-ink-200 shadow-pop z-50 max-h-72 overflow-hidden rounded-xl border bg-white p-1',
          'data-[state=open]:animate-pop-in',
          position === 'popper' && 'min-w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="max-h-64 overflow-y-auto">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex h-9 cursor-default items-center justify-between gap-2 rounded-lg px-2.5',
        'text-body-s text-ink-700 outline-none select-none',
        'data-[highlighted]:bg-ink-50',
        'data-[state=checked]:text-brand-600 data-[state=checked]:font-medium',
        'data-[disabled]:text-ink-400 data-[disabled]:pointer-events-none',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="text-brand-500 size-3.5" strokeWidth={2.4} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('text-caption text-ink-400 px-2.5 py-1.5 font-semibold', className)}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn('bg-ink-100 my-1 h-px', className)} {...props} />;
}
