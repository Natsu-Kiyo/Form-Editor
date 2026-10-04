'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

import { cn } from '@/utils/cn';

import { DialogCloseButton, DialogOverlay } from './dialog-parts';

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;

const MODAL_WIDTH = {
  sm: 'max-w-[400px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[560px]',
} as const;

export type ModalContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** 必填：Radix 要求弹层有可读标题，否则读屏用户进不来 */
  title: string;
  description?: string;
  width?: keyof typeof MODAL_WIDTH;
  /** 需要完全自定义头部（例如预览弹层）时隐藏标题栏；标题仍会提供给读屏 */
  hideTitle?: boolean;
  footer?: React.ReactNode;
};

/**
 * 居中弹窗。用于新建问卷、导出、二次确认、新建渠道这类短交互。
 * 圆角 16、`shadow-pop`，是设计系统的 L4 浮层。
 */
export function ModalContent({
  className,
  children,
  title,
  description,
  width = 'md',
  hideTitle = false,
  footer,
  ...props
}: ModalContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-modal border-ink-200 shadow-pop border bg-white',
          'data-[state=open]:animate-pop-in',
          MODAL_WIDTH[width],
          className,
        )}
        {...props}
      >
        {hideTitle ? (
          <VisuallyHidden>
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          </VisuallyHidden>
        ) : (
          <>
            <div className="border-ink-200 flex items-start justify-between gap-3 border-b px-6 py-4">
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
            <div className="px-6 py-5">{children}</div>
          </>
        )}

        {hideTitle ? children : null}

        {footer ? (
          <div className="border-ink-200 flex items-center justify-end gap-2 border-t px-6 py-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
