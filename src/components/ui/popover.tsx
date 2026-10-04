'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/utils/cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'border-ink-200 shadow-pop z-50 w-72 rounded-xl border bg-white p-4 outline-none',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export function PopoverArrow({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Arrow>) {
  return <PopoverPrimitive.Arrow className={cn('fill-white', className)} {...props} />;
}
