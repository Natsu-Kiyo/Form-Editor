import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../next-path';

/**
 * 这个函数是开放重定向的最后一道闸：它的返回值会被交给 `redirect()`。
 * 下面每一条都是一种真实见过的绕过写法。
 */
describe('safeNextPath', () => {
  it('站内相对路径原样返回（含查询串与邀请链接）', () => {
    expect(safeNextPath('/app/q/abc/edit')).toBe('/app/q/abc/edit');
    expect(safeNextPath('/invite/token-123')).toBe('/invite/token-123');
    expect(safeNextPath('/app/logs?actor=x&days=7')).toBe('/app/logs?actor=x&days=7');
  });

  it('绝对地址与外站一律回落到 /app', () => {
    expect(safeNextPath('https://evil.com')).toBe('/app');
    expect(safeNextPath('//evil.com')).toBe('/app');
    expect(safeNextPath('javascript:alert(1)')).toBe('/app');
  });

  it('反斜杠写法回落（浏览器会把 /\\ 归一成 //）', () => {
    expect(safeNextPath('/\\evil.com')).toBe('/app');
    expect(safeNextPath('/app\\..\\evil')).toBe('/app');
  });

  it('换行注入回落（响应头拼接）', () => {
    expect(safeNextPath('/app\nLocation: https://evil.com')).toBe('/app');
  });

  it('非字符串与空值回落到 /app', () => {
    expect(safeNextPath(null)).toBe('/app');
    expect(safeNextPath(undefined)).toBe('/app');
    expect(safeNextPath('')).toBe('/app');
  });
});
