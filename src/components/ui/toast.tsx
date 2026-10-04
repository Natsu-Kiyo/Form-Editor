'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoIcon } from '@/components/icons/ui-icons';
import { cn } from '@/utils/cn';

export type ToastVariant = 'info' | 'success' | 'error';

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = { toast: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT: Record<ToastVariant, { icon: React.ReactNode; tone: string }> = {
  info: { icon: <InfoIcon className="size-4" />, tone: 'text-brand-500' },
  success: { icon: <CheckCircleIcon className="size-4" />, tone: 'text-emerald-500' },
  error: { icon: <AlertCircleIcon className="size-4" />, tone: 'text-rose-500' },
};

/** 组件内触发一条通知。必须在 `<ToastProvider>` 内使用（根布局已挂载） */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须在 <ToastProvider> 内使用');
  }
  return context;
}

/**
 * 全局通知中心。
 *
 * 状态刻意只放这一处、且只服务于「瞬时反馈」——
 * 服务端数据一律不进这里（见 AGENTS.md 状态分层）。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current;
    nextId.current += 1;
    setItems((previous) => [...previous, { ...input, id }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {items.map((item) => {
          const variant = VARIANT[item.variant || 'info'];

          return (
            <ToastPrimitive.Root
              key={item.id}
              duration={4000}
              onOpenChange={(open) => {
                if (!open) remove(item.id);
              }}
              className={cn(
                'rounded-card border-ink-200 shadow-pop flex items-start gap-3 border bg-white p-4',
                'data-[state=open]:animate-pop-in',
              )}
            >
              <span className={cn('mt-0.5 shrink-0', variant.tone)}>{variant.icon}</span>

              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-body-s text-ink-900 font-medium">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="text-label text-ink-500 mt-0.5">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>

              <ToastPrimitive.Close
                aria-label="关闭通知"
                className="text-ink-400 hover:text-ink-600 shrink-0 transition-colors duration-150"
              >
                <CloseIcon className="size-3.5" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}

        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-100 flex w-[380px] max-w-[100vw] flex-col gap-2 p-6 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
