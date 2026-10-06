import { describe, expect, it } from 'vitest';

import { describeStaleClientHint, isTransientConnectionError } from '../db-retry';

/**
 * 这些判定直接决定「偶发的连接抖动」会不会冒到页面上变成 Runtime Error，
 * 以及「唯一的邮箱」这类业务错误会不会被无谓地重试三次。
 */
describe('isTransientConnectionError', () => {
  it('认出 pg 的连接超时（就是线上那次报错的原话）', () => {
    expect(
      isTransientConnectionError(new Error('Connection terminated due to connection timeout')),
    ).toBe(true);
  });

  it('认出连接被中途掐断', () => {
    expect(isTransientConnectionError(new Error('Connection terminated unexpectedly'))).toBe(true);
    expect(isTransientConnectionError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('认出 Prisma 的连接类错误码', () => {
    expect(isTransientConnectionError({ code: 'P1001' })).toBe(true);
    expect(isTransientConnectionError({ code: 'P1017' })).toBe(true);
  });

  it('认出我们自己设的查询级超时（多半意味着这条连接已经废了）', () => {
    expect(
      isTransientConnectionError({ message: 'canceling statement due to statement timeout' }),
    ).toBe(true);
    expect(isTransientConnectionError(new Error('Query read timeout'))).toBe(true);
  });

  it('业务错误不重试 —— 重试三次只会让用户多等一秒，还是同样的错', () => {
    expect(isTransientConnectionError({ code: 'P2002' })).toBe(false);
    expect(
      isTransientConnectionError(new Error('Unique constraint failed on the fields: (`email`)')),
    ).toBe(false);
  });

  it('题型不认识的值不重试（那是代码问题，不是连接问题）', () => {
    expect(isTransientConnectionError(new Error('Invalid value for argument `type`'))).toBe(false);
  });

  it('空值不会把它当成可重试的错误', () => {
    expect(isTransientConnectionError(null)).toBe(false);
    expect(isTransientConnectionError(undefined)).toBe(false);
    expect(isTransientConnectionError('')).toBe(false);
  });
});

describe('describeStaleClientHint', () => {
  it('认出「客户端比 schema 旧」的原话（线上那次 500 的报错）', () => {
    const hint = describeStaleClientHint(
      new Error('Unknown field `viewCount` for select statement on model `Questionnaire`.'),
    );

    expect(hint).toContain('重启');
  });

  it('`Unknown argument` 也算 —— 两种原因都要说出来，不能只报一种', () => {
    const hint = describeStaleClientHint(new Error('Unknown argument `channelId`.'));
    expect(hint).toContain('写错了字段名');
  });

  it('别的查询错误不掺和：提示只给这一类错，否则它就成了噪音', () => {
    expect(describeStaleClientHint(new Error('Unique constraint failed on `email`'))).toBeNull();
    expect(describeStaleClientHint(new Error('Connection terminated unexpectedly'))).toBeNull();
    expect(describeStaleClientHint(null)).toBeNull();
  });
});
