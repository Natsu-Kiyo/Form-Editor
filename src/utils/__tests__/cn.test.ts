import { describe, expect, it } from 'vitest';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('拼接真值类名并丢弃空值', () => {
    expect(cn('p-2', null, undefined, 'text-ink-700')).toBe('p-2 text-ink-700');
  });

  it('支持条件对象写法', () => {
    expect(cn('p-2', { hidden: false, 'text-ink-900': true })).toBe('p-2 text-ink-900');
  });

  it('同类 Tailwind 类冲突时保留后写的', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('自定义字号不被当作文字色', () => {
  /**
   * 回归测试：tailwind-merge 默认不认识 `text-body` 这类自定义值，
   * 会把它归到 text-color 组，从而把前面的 `text-white` 删掉。
   * 症状是所有按钮的文字色失效（深蓝底 + 深灰字）。
   */
  it('字号与文字色共存，互不吞噬', () => {
    expect(cn('text-white', 'text-body')).toBe('text-white text-body');
    expect(cn('text-brand-600', 'text-body-s')).toBe('text-brand-600 text-body-s');
    expect(cn('text-rose-600', 'text-label')).toBe('text-rose-600 text-label');
  });

  it('按钮的主色文字在三个尺寸下都保留', () => {
    (['sm', 'md', 'lg'] as const).forEach((size) => {
      const merged = cn(buttonVariants({ variant: 'primary', size }));

      expect(merged).toContain('text-white');
      expect(merged).toContain('bg-brand-500');
    });
  });

  it('外部传入的 className 仍能覆盖按钮的尺寸类', () => {
    const merged = cn(buttonVariants({ variant: 'primary', size: 'md' }), 'h-11');

    expect(merged).toContain('h-11');
    expect(merged).not.toContain('h-10');
    expect(merged).toContain('text-white');
  });
});
