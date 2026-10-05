'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/utils/cn';

import { DialogCloseButton, DialogOverlay } from './dialog-parts';

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export type DrawerContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  /** 抽屉宽度。历史版本列表 / 答卷详情都用默认 420 */
  widthClassName?: string;
  /** 从哪一侧滑入。导航抽屉用 left，内容类抽屉用默认的 right */
  side?: 'right' | 'left';
  footer?: React.ReactNode;
};

/**
 * 侧向抽屉。用于「历史版本」「单份答卷详情」这类需要保留背后上下文的场景，
 * 窄屏下也用它承载导航。从侧边滑入 250ms ease-out（设计系统 §09「面板展开 / 抽屉」）。
 */
export function DrawerContent({
  className,
  children,
  title,
  description,
  widthClassName = 'max-w-[420px]',
  side = 'right',
  footer,
  ...props
}: DrawerContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-full flex-col',
          'border-ink-200 shadow-pop bg-white',
          side === 'right'
            ? 'data-[state=open]:animate-slide-in-right right-0 border-l'
            : 'data-[state=open]:animate-slide-in-left left-0 border-r',
          widthClassName,
          className,
        )}
        {...props}
      >
        <div className="border-ink-200 flex shrink-0 items-start justify-between gap-3 border-b px-6 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-title-m text-ink-900 font-semibold">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-body-s text-ink-500 mt-1">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogCloseButton />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="border-ink-200 flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
