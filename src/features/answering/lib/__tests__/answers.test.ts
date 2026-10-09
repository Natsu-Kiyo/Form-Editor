import { describe, expect, it } from 'vitest';

import {
  describeAnswerHint,
  isAnswered,
  parseAnswers,
  visibleQuestions,
  type SubmittableQuestion,
} from '../answers';

/**
 * 提交链路上唯一复杂的地方：八种题型各有一套规则，还要判必答。
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
    columns: [],
    showIf: null,
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

  // ---- 矩阵（R62）：行在 options 里、列在 columns 里，值是 `{ 行: 列 }` ----
  const matrixQuestion = (overrides: Partial<SubmittableQuestion> = {}) =>
    build({
      type: 'MATRIX',
      title: '请为各个环节打分',
      options: ['报名流程', '现场组织'],
      columns: ['满意', '一般', '不满意'],
      ...overrides,
    });

  it('矩阵只收下真实存在的行列（手改请求塞进来的值进不来）', () => {
    const result = parseAnswers([matrixQuestion()], {
      q1: { 报名流程: '满意', 现场组织: '还行吧', 不存在的行: '满意' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers[0]!.value).toEqual({ 报名流程: '满意' });
  });

  it('可选的矩阵答了一部分也收下（不能当成没答丢掉）', () => {
    const result = parseAnswers([matrixQuestion()], { q1: { 报名流程: '满意' } });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers[0]!.value).toEqual({ 报名流程: '满意' });
  });

  it('必答矩阵要求每一行都选（R62 所有者拍板的口径），缺行时给出该题的错误', () => {
    const partial = parseAnswers([matrixQuestion({ required: true })], {
      q1: { 报名流程: '满意' },
    });

    expect(partial.ok).toBe(false);
    if (!partial.ok) expect(partial.fieldErrors.q1).toBe('每一行都要选');

    const full = parseAnswers([matrixQuestion({ required: true })], {
      q1: { 报名流程: '满意', 现场组织: '一般' },
    });

    expect(full.ok).toBe(true);
    if (full.ok) expect(full.answers[0]!.value).toEqual({ 报名流程: '满意', 现场组织: '一般' });
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

  it('矩阵带上行列数', () => {
    expect(
      describeAnswerHint(build({ type: 'MATRIX', options: ['A', 'B', 'C'], columns: ['x', 'y'] })),
    ).toContain('3 行 × 2 列');
  });
});

describe('条件显示（R65）', () => {
  /** q1 单选（满意 / 不满意）→ q2 追问（在「不满意」时显示）→ q3 补充（在 q2 选「其他」时显示） */
  const chain = (): SubmittableQuestion[] => [
    build({ id: 'q1', type: 'SINGLE', options: ['满意', '不满意'] }),
    build({
      id: 'q2',
      type: 'LONG_TEXT',
      showIf: { questionIndex: 0, options: ['不满意'] },
    }),
    build({
      id: 'q3',
      type: 'SHORT_TEXT',
      showIf: { questionIndex: 1, options: ['其他'] },
    }),
  ];

  it('没有条件的题一直可见', () => {
    const visible = visibleQuestions(chain(), {});

    expect(visible.map((question) => question.id)).toEqual(['q1']);
  });

  it('命中依赖选项才可见；未答 / 未命中都不可见', () => {
    expect(visibleQuestions(chain(), { q1: '满意' }).map((q) => q.id)).toEqual(['q1']);
    expect(visibleQuestions(chain(), { q1: '不满意' }).map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('多选命中其中任意一个选项即满足', () => {
    const questions = [
      build({ id: 'q1', type: 'MULTI', options: ['甲', '乙', '丙'] }),
      build({ id: 'q2', type: 'SHORT_TEXT', showIf: { questionIndex: 0, options: ['甲', '丙'] } }),
    ];

    expect(visibleQuestions(questions, { q1: ['乙'] }).map((q) => q.id)).toEqual(['q1']);
    expect(visibleQuestions(questions, { q1: ['乙', '丙'] }).map((q) => q.id)).toEqual([
      'q1',
      'q2',
    ]);
  });

  it('级联：上游不可见时，只依赖它的下游也不可见', () => {
    const questions = chain();
    const both = { q1: '不满意', q2: '其他' } as Record<string, unknown>;

    expect(visibleQuestions(questions, both).map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);

    // q2 从「其他」改成别的：q3 立刻消失；再把 q1 改回「满意」：两道追问都没了
    expect(visibleQuestions(questions, { q1: '不满意', q2: '别的' }).map((q) => q.id)).toEqual([
      'q1',
      'q2',
    ]);
    expect(visibleQuestions(questions, { q1: '满意', q2: '其他' }).map((q) => q.id)).toEqual([
      'q1',
    ]);
  });

  it('提交时：不可见题的必答不拦、答案也不写库', () => {
    const questions = chain().map((question) =>
      question.showIf ? { ...question, required: true } : question,
    );

    // 选了「满意」→ 追问不可见：它即使必答也不拦，客户端塞进来的答案也不会写进去
    const result = parseAnswers(questions, { q1: '满意', q2: '幽灵答案', q3: '幽灵答案' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answers).toEqual([{ questionId: 'q1', value: '满意' }]);
    }
  });

  it('提交时：可见的必答追问照常拦', () => {
    const questions = chain().map((question) =>
      question.showIf ? { ...question, required: true } : question,
    );

    const result = parseAnswers(questions, { q1: '不满意' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.q2).toBe('这是必答题');
  });
});
