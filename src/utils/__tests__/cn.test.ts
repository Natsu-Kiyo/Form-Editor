import { describe, expect, it } from 'vitest';

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
