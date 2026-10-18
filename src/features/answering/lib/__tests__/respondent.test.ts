import { describe, expect, it } from 'vitest';

import { resolveRespondent } from '../respondent';

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * 匿名承诺与「每人一次」都挂在这一个判断上（审查 #2、#10）：
 * 一旦匿名问卷记了账号，两条都会同时失效 —— 而界面上的文案还在说「不记录身份」。
 */
describe('resolveRespondent', () => {
  it('匿名问卷即使访问者登录着，也不记账号', () => {
    const result = resolveRespondent({
      identityMode: 'ANONYMOUS',
      userId: 'user-1',
      clientId: 'client-1',
    });

    expect(result.respondentId).toBeNull();
    expect(result.fingerprint).toMatch(SHA256_HEX);
  });

  it('匿名问卷的查重只认指纹 —— 同一个人换登录状态也只有一份', () => {
    const anonymous = resolveRespondent({
      identityMode: 'ANONYMOUS',
      userId: null,
      clientId: 'client-1',
    });
    const loggedIn = resolveRespondent({
      identityMode: 'ANONYMOUS',
      userId: 'user-1',
      clientId: 'client-1',
    });

    expect(loggedIn.fingerprint).toBe(anonymous.fingerprint);
    expect(loggedIn.respondentId).toBeNull();
  });

  it('需登录的问卷只记账号，不记指纹', () => {
    const result = resolveRespondent({
      identityMode: 'LOGIN_REQUIRED',
      userId: 'user-1',
      clientId: 'client-1',
    });

    expect(result).toEqual({ respondentId: 'user-1', fingerprint: null });
  });

  it('口令问卷：登录了就记账号，没登录就退回指纹', () => {
    expect(
      resolveRespondent({
        identityMode: 'PASSWORD',
        userId: 'user-1',
        clientId: null,
      }),
    ).toEqual({ respondentId: 'user-1', fingerprint: null });

    expect(
      resolveRespondent({
        identityMode: 'PASSWORD',
        userId: null,
        clientId: null,
      }).respondentId,
    ).toBeNull();
  });

  /*
   * 这条是审查 #10 的正面回归：没有客户端 id 时**不生成指纹**，
   * 于是这一份走不进「同一个人」的唯一索引 —— 宁可漏一次去重，也不误伤同 UA 的所有人。
   */
  it('没有客户端 id 时不生成指纹（不再拿 UA 顶替）', () => {
    expect(
      resolveRespondent({ identityMode: 'ANONYMOUS', userId: null, clientId: null }).fingerprint,
    ).toBeNull();

    expect(
      resolveRespondent({ identityMode: 'ANONYMOUS', userId: null, clientId: '  ' }).fingerprint,
    ).toBeNull();
  });

  it('不同的客户端 id 得到不同指纹', () => {
    const first = resolveRespondent({
      identityMode: 'ANONYMOUS',
      userId: null,
      clientId: 'client-1',
    });
    const second = resolveRespondent({
      identityMode: 'ANONYMOUS',
      userId: null,
      clientId: 'client-2',
    });

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});
