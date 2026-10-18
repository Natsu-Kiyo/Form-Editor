import { describe, expect, it } from 'vitest';

import { firstParam } from '../search-params';

/**
 * 这个函数存在的唯一理由是 `?q=a&q=b` 这种地址（审查 #6）：
 * 它会让 `.trim()` 抛错、也会把数组塞进 Prisma。
 */
describe('firstParam', () => {
  it('普通字符串原样返回', () => {
    expect(firstParam('abc')).toBe('abc');
  });

  it('数组取第一个 —— 重复参数不再把页面打挂', () => {
    expect(firstParam(['a', 'b'])).toBe('a');
  });

  it('空串与空数组都当作「没传」', () => {
    expect(firstParam('')).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam(null)).toBeUndefined();
  });
});
