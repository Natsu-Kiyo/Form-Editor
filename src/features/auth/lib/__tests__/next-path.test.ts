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

  /*
   * 用户复测（R106）：以前只挡了 `\n` 与 `\r`，**没挡制表符**。
   * URL 解析器会在解析前把 \t 删掉，于是 `/\t/evil.com` 变成 `//evil.com` → 外站。
   * 现在控制字符整段拒绝，兜底还有「解析后 origin 必须是我们」这一道。
   */
  it('制表符与控制字符一律回落', () => {
    expect(safeNextPath('/\t/evil.com')).toBe('/app');
    expect(safeNextPath('/\u0000/evil.com')).toBe('/app');
    expect(safeNextPath('/app\t')).toBe('/app');
    expect(safeNextPath('/\r\n/evil.com')).toBe('/app');
  });

  it('返回的是解析后的地址（怪写法被归一）', () => {
    expect(safeNextPath('/app/./logs')).toBe('/app/logs');
  });

  it('非字符串与空值回落到 /app', () => {
    expect(safeNextPath(null)).toBe('/app');
    expect(safeNextPath(undefined)).toBe('/app');
    expect(safeNextPath('')).toBe('/app');
  });
});
