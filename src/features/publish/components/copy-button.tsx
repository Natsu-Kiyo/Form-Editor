'use client';

import { useEffect, useState } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';

/**
 * 复制到剪贴板。
 *
 * `navigator.clipboard` 只在安全上下文（https / localhost）可用，失败时**必须说出来**：
 * 静默无反应的按钮和假入口没有区别。所以失败时按钮会变成「复制失败」并给出提示，
 * 而不是什么都不发生。
 *
 * 定时器在卸载时要清掉 —— 用户点完就切页面，setState 会打在已卸载的组件上。
 */
export function CopyButton({
  value,
  label,
  size = 'md',
  variant = 'outline',
  className,
}: {
  value: string;
  label: string;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'outline' | 'ghost';
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;

    const timer = setTimeout(() => setState('idle'), state === 'copied' ? 2000 : 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={copy}
      className={className}
      title={state === 'failed' ? '浏览器拒绝了剪贴板访问，请手动选中复制' : undefined}
    >
      {state === 'copied' ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {state === 'copied' ? '已复制' : state === 'failed' ? '复制失败' : label}
    </Button>
  );
}
