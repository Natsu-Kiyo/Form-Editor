import { describe, expect, it } from 'vitest';

import { verifyAccessCode } from '../access-code';

describe('verifyAccessCode', () => {
  it('相同的口令通过', () => {
    expect(verifyAccessCode('demo1234', 'demo1234')).toBe(true);
  });

  it('不同的口令不通过，且**不会因为长度不同而抛异常**', () => {
    // timingSafeEqual 对长度不等会抛错，这里必须被挡在它前面
    expect(() => verifyAccessCode('demo1234', 'demo')).not.toThrow();
    expect(verifyAccessCode('demo1234', 'demo')).toBe(false);
    expect(verifyAccessCode('demo1234', 'demo1235')).toBe(false);
  });

  it('大小写与前后空格都算不同（口令是精确比对，trim 由表单层负责）', () => {
    expect(verifyAccessCode('demo1234', 'Demo1234')).toBe(false);
    expect(verifyAccessCode('demo1234', ' demo1234')).toBe(false);
  });

  it('中文口令按 utf8 字节比较，不会因为多字节而错判', () => {
    expect(verifyAccessCode('内部口令', '内部口令')).toBe(true);
    expect(verifyAccessCode('内部口令', '内部口')).toBe(false);
  });
});
