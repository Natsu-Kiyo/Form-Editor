'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/utils/cn';

import { DialogCloseButton, DialogOverlay } from './dialog-parts';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  /** 底部固定操作区 */
  footer?: React.ReactNode;
};

/**
 * 底部弹层。窄屏（<768px）专用 —— 移动端编辑器把桌面端的左栏「题型」、
 * 右栏「题目属性」、以及发布设置各自改造成一个 Sheet。
 *
 * 这是本项目「不发明新交互，只做形态转换」的核心手法：
 * 同一套字段、同一个顺序，只换容器。**所以这里的字段必须与桌面端面板逐个对等**。
 *
 * 刻意不做拖拽把手：没有真的拖拽手势时，把手就是个假可供性。
 */
export function SheetContent({
  className,
  children,
  title,
  description,
  footer,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] flex-col',
          'rounded-t-modal border-ink-200 shadow-pop border-t bg-white',
          'data-[state=open]:animate-slide-in-up',
          className,
        )}
        {...props}
      >
        <div className="border-ink-200 flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="border-ink-200 flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
