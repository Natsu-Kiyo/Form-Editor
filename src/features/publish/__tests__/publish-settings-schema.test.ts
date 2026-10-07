import { describe, expect, it } from 'vitest';

import { publishSettingsSchema } from '../schemas';

/**
 * 「口令访问必须有口令」这条规则**只写在 schema 里**（界面与服务端都读它）。
 *
 * 它在 R38~R39 时散落在 action 里，于是出现过「发布前检查说没问题、点下去才报错」
 * 以及「口令为空仍能点保存」两种不一致。这个用例把这条规则钉在它唯一该在的地方。
 */
const base = {
  startsAt: '',
  endsAt: '',
  responseLimit: '',
};

describe('publishSettingsSchema 的口令规则', () => {
  it('口令访问 + 空口令 → 报错，且错误落在 password 字段上', () => {
    const result = publishSettingsSchema.safeParse({
      ...base,
      identityMode: 'PASSWORD',
      password: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'password')).toBe(true);
    }
  });

  it('口令访问 + 有口令 → 通过', () => {
    const result = publishSettingsSchema.safeParse({
      ...base,
      identityMode: 'PASSWORD',
      password: 'demo1234',
    });

    expect(result.success).toBe(true);
  });

  it('匿名 / 登录作答 + 空口令 → 通过（换回来时口令本来就该被清掉）', () => {
    for (const identityMode of ['ANONYMOUS', 'LOGIN_REQUIRED'] as const) {
      const result = publishSettingsSchema.safeParse({ ...base, identityMode, password: '' });
      expect(result.success).toBe(true);
    }
  });

  it('口令长度不足 4 位 → 报错（与空口令是两条不同的提示）', () => {
    const result = publishSettingsSchema.safeParse({
      ...base,
      identityMode: 'PASSWORD',
      password: 'abc',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('至少 4 位');
  });
});
