import { describe, expect, it } from 'vitest';

import { withVerifiedTls } from '@/lib/database-url';

/** 假凭据，仅用于验证字符串处理，与真实环境无关 */
const NEON =
  'postgresql://neondb_owner:secret@ep-demo-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb';

describe('withVerifiedTls', () => {
  it('把 require 升级成 verify-full', () => {
    expect(withVerifiedTls(`${NEON}?sslmode=require&channel_binding=require`)).toBe(
      `${NEON}?sslmode=verify-full&channel_binding=require`,
    );
  });

  it('原本没有 query 时补上 sslmode', () => {
    expect(withVerifiedTls(NEON)).toBe(`${NEON}?sslmode=verify-full`);
  });

  it('收敛重复的 sslmode，只留一个 verify-full', () => {
    expect(withVerifiedTls(`${NEON}?sslmode=require&sslmode=prefer`)).toBe(
      `${NEON}?sslmode=verify-full`,
    );
  });

  it('去掉会改写 sslmode 语义的 uselibpqcompat 与 ssl', () => {
    expect(withVerifiedTls(`${NEON}?uselibpqcompat=true&sslmode=require&ssl=true`)).toBe(
      `${NEON}?sslmode=verify-full`,
    );
  });

  it('本地回环地址不动它（本地 Postgres 一般没有证书）', () => {
    const local = 'postgresql://postgres:postgres@localhost:5432/formmaker?sslmode=disable';

    expect(withVerifiedTls(local)).toBe(local);
    expect(withVerifiedTls('postgresql://postgres:postgres@127.0.0.1:5432/db')).toBe(
      'postgresql://postgres:postgres@127.0.0.1:5432/db',
    );
    expect(withVerifiedTls('postgresql://postgres:postgres@[::1]:5432/db')).toBe(
      'postgresql://postgres:postgres@[::1]:5432/db',
    );
  });

  it('显式 disable 是操作者的决定，尊重它', () => {
    const disabled = `${NEON}?sslmode=disable`;

    expect(withVerifiedTls(disabled)).toBe(disabled);
  });

  it('完全不动 userinfo 与路径（密码里的特殊字符原样保留）', () => {
    const tricky = 'postgresql://user:p%40ss%2Fword:@host.example.com:5432/my-db?sslmode=require';
    const result = withVerifiedTls(tricky);

    expect(result.startsWith('postgresql://user:p%40ss%2Fword:@host.example.com:5432/my-db?')).toBe(
      true,
    );
    expect(result).toContain('sslmode=verify-full');
  });

  it('解析不了的连接串原样放行，让下游报明确的错', () => {
    expect(withVerifiedTls('not-a-url?sslmode=require')).toBe('not-a-url?sslmode=require');
  });
});
