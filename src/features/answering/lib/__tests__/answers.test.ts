import { describe, expect, it } from 'vitest';

import { describeAnswerHint, isAnswered, parseAnswers, type SubmittableQuestion } from '../answers';

/**
 * 提交链路上唯一复杂的地方：七种题型各有一套规则，还要判必答。
 * 客户端用它提前提示、服务端用它最终拦截 —— 所以这里的每条规则都值得穷举。
 */
function build(overrides: Partial<SubmittableQuestion> = {}): SubmittableQuestion {
  return {
    id: 'q1',
    type: 'SINGLE',
    title: '你的意向部门是？',
    required: false,
    min: null,
    max: null,
    maxLength: null,
    options: ['策划部', '宣传部'],
    ...overrides,
  };
}

describe('isAnswered', () => {
  it('空字符串、空数组、null 都算没答', () => {
    expect(isAnswered('')).toBe(false);
    expect(isAnswered('   ')).toBe(false);
    expect(isAnswered([])).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
  });

  it('评分给了 0 也算答了（0 是合法分数，不能因为它是 falsy 就丢掉）', () => {
    expect(isAnswered(0)).toBe(true);
  });
});

describe('parseAnswers', () => {
  it('必答题没答时给出字段级错误', () => {
    const result = parseAnswers([build({ required: true })], {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.q1).toBe('这是必答题');
  });

  it('选了不存在的选项一律当没答（手改请求塞不进来）', () => {
    const result = parseAnswers([build({ required: true })], { q1: '财务部' });

    expect(result.ok).toBe(false);
  });

  it('多选去掉重复项，并按选项顺序归一', () => {
    const result = parseAnswers([build({ type: 'MULTI' })], {
      q1: ['宣传部', '宣传部', '策划部'],
    });

    expect(result.ok).toBe(true);
    // 按问卷里的选项顺序存：这样导出的多选答案与用户在界面上看到的顺序一致
    if (result.ok) expect(result.answers[0]!.value).toEqual(['宣传部', '策划部']);
  });

  it('评分超出范围当没答（上限是 10，给 99 不算数）', () => {
    const result = parseAnswers([build({ type: 'RATING', required: true, max: 10 })], { q1: 99 });

    expect(result.ok).toBe(false);
  });

  it('评分给了合法分就存数字', () => {
    const result = parseAnswers([build({ type: 'RATING', max: 10 })], { q1: 7 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers[0]!.value).toBe(7);
  });

  it('填空超过长度上限时截断而不是丢掉（用户的输入不该因为一个上限被扔）', () => {
    const result = parseAnswers([build({ type: 'LONG_TEXT', maxLength: 5 })], {
      q1: '一二三四五六七',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers[0]!.value).toBe('一二三四五');
  });

  it('日期只认 `2026-10-20` 这种写法', () => {
    expect(parseAnswers([build({ type: 'DATE', required: true })], { q1: '2026/10/20' }).ok).toBe(
      false,
    );
    expect(parseAnswers([build({ type: 'DATE' })], { q1: '2026-10-20' }).ok).toBe(true);
  });

  it('不认识的问题 id 直接忽略（结构发布后被改过时，多出来的答案不该让整份提交失败）', () => {
    const result = parseAnswers([build()], { q1: '策划部', 已经删除的题: 'x' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers).toHaveLength(1);
  });

  it('没答的选填题不写进答案里（免得统计时多出一堆空值）', () => {
    const result = parseAnswers([build()], {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers).toHaveLength(0);
  });
});

describe('describeAnswerHint', () => {
  it('把「怎么答、是否必答、有什么限制」一次说清', () => {
    const hint = describeAnswerHint(build({ type: 'MULTI', required: true }));

    expect(hint).toContain('多选');
    expect(hint).toContain('必答');
  });

  it('评分题带上真实范围', () => {
    expect(describeAnswerHint(build({ type: 'RATING', min: 2, max: 10 }))).toContain('2–10 分');
  });

  it('填空带上字数上限', () => {
    expect(describeAnswerHint(build({ type: 'LONG_TEXT', maxLength: 200 }))).toContain(
      '最多 200 字',
    );
  });
});
