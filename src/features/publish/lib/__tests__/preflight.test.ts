import { describe, expect, it } from 'vitest';

import { runPreflight, type PreflightInput, type PreflightQuestion } from '../preflight';

/**
 * 发布是不可逆操作（发布即冻结结构），所以这些规则要靠单测穷举，而不是点着验。
 * 每条断言都对着一种「发布出去会出事」的具体情形。
 */
const NOW = new Date('2026-10-05T10:00:00Z');

/** 一道「结构上没问题」的题；要验结构问题时覆写 `type` / `optionCount` / `maxLength` */
function question(overrides: Partial<PreflightQuestion> = {}): PreflightQuestion {
  return {
    title: '你叫什么',
    required: true,
    type: 'SHORT_TEXT',
    optionCount: 0,
    maxLength: null,
    ...overrides,
  };
}

function build(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    questions: [question()],
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
    expect(errorIds(build({ questions: [question({ title: '   ' })] }))).toContain('untitled');
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
          question({ title: '必答', required: true }),
          question({ title: '选答', required: false }),
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

  /*
   * 下面两条对着审查 #4 的两种「发出去没人能填」（老草稿里真实存在，
   * 写入侧的闸门管不到它们，只能由发布这一道兜住）。
   */
  it('选择题没有选项时拦住 —— 作答者打开只看到空列表', () => {
    expect(
      errorIds(build({ questions: [question({ type: 'SINGLE', optionCount: 0 })] })),
    ).toContain('empty-options');
  });

  it('填空题长度上限为 0 时拦住 —— 任何输入都会被截成空', () => {
    expect(
      errorIds(build({ questions: [question({ type: 'LONG_TEXT', maxLength: 0 })] })),
    ).toContain('zero-max-length');
  });

  it('不误伤：有选项的选择题、上限为正的填空题照常放行', () => {
    const result = runPreflight(
      build({
        questions: [
          question({ title: '单选', type: 'SINGLE', optionCount: 3 }),
          question({ title: '填空', type: 'LONG_TEXT', maxLength: 1 }),
        ],
      }),
    );

    expect(result.canPublish).toBe(true);
  });
});
