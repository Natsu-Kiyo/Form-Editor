import { describe, expect, it } from 'vitest';

import { runPreflight, type PreflightInput } from '../preflight';

/**
 * 发布是不可逆操作（发布即冻结结构），所以这些规则要靠单测穷举，而不是点着验。
 * 每条断言都对着一种「发布出去会出事」的具体情形。
 */
const NOW = new Date('2026-10-05T10:00:00Z');

function build(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    questions: [{ title: '你叫什么', required: true }],
    startsAt: null,
    endsAt: new Date('2026-10-20T15:59:00Z'),
    responseLimit: null,
    responseCount: 0,
    identityMode: 'ANONYMOUS',
    hasPassword: false,
    now: NOW,
    ...overrides,
  };
}

function errorIds(input: PreflightInput) {
  return runPreflight(input)
    .checks.filter((check) => check.tone === 'error')
    .map((check) => check.id);
}

describe('runPreflight', () => {
  it('题目齐全、时间合法时可以发布', () => {
    const result = runPreflight(build());

    expect(result.canPublish).toBe(true);
    expect(result.blockerCount).toBe(0);
  });

  it('一道题都没有时拦住', () => {
    expect(errorIds(build({ questions: [] }))).toContain('no-question');
  });

  it('有题目没写标题时拦住', () => {
    expect(errorIds(build({ questions: [{ title: '   ', required: true }] }))).toContain(
      'untitled',
    );
  });

  it('结束时间早于开始时间时拦住', () => {
    expect(
      errorIds(
        build({
          startsAt: new Date('2026-10-20T00:00:00Z'),
          endsAt: new Date('2026-10-10T00:00:00Z'),
        }),
      ),
    ).toContain('time-order');
  });

  it('结束时间已经过去时拦住', () => {
    expect(errorIds(build({ endsAt: new Date('2026-10-01T00:00:00Z') }))).toContain('time-past');
  });

  it('回收上限小于已回收份数时拦住 —— 否则一发布就立刻截止', () => {
    expect(errorIds(build({ responseLimit: 50, responseCount: 128 }))).toContain(
      'limit-below-collected',
    );
  });

  it('回收上限恰好等于已回收份数也拦住（同上）', () => {
    expect(errorIds(build({ responseLimit: 128, responseCount: 128 }))).toContain(
      'limit-below-collected',
    );
  });

  it('选了口令访问却没有口令时拦住', () => {
    expect(errorIds(build({ identityMode: 'PASSWORD', hasPassword: false }))).toContain(
      'password-missing',
    );
  });

  it('选了口令访问且已有口令时放行', () => {
    const result = runPreflight(build({ identityMode: 'PASSWORD', hasPassword: true }));

    expect(result.canPublish).toBe(true);
  });

  it('有选填题只提示、不拦 —— 那是问卷设计者的合理选择', () => {
    const result = runPreflight(
      build({
        questions: [
          { title: '必答', required: true },
          { title: '选答', required: false },
        ],
      }),
    );

    expect(result.canPublish).toBe(true);
    expect(result.checks.some((check) => check.id === 'optional' && check.tone === 'warn')).toBe(
      true,
    );
  });

  it('不设时间只提示「长期开放」，不拦', () => {
    const result = runPreflight(build({ startsAt: null, endsAt: null }));

    expect(result.canPublish).toBe(true);
    expect(result.checks.some((check) => check.id === 'open-ended')).toBe(true);
  });
});
