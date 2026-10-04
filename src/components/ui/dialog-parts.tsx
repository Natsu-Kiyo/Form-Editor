'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { CloseIcon } from '@/components/icons/ui-icons';
import { cn } from '@/utils/cn';

/** 弹层遮罩。用 ink-900 半透明而不是品牌色 —— 品牌蓝只做「点」，不铺「面」 */
export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'bg-ink-900/40 data-[state=open]:animate-fade-in fixed inset-0 z-50',
        className,
      )}
      {...props}
    />
  );
}

/** 弹层右上角关闭按钮 */
export function DialogCloseButton({
  label = '关闭',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <DialogPrimitive.Close
      aria-label={label}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        'text-ink-400 transition-colors duration-150',
        'hover:bg-ink-100 hover:text-ink-600',
        className,
      )}
    >
      <CloseIcon className="size-4" />
    </DialogPrimitive.Close>
  );
}
