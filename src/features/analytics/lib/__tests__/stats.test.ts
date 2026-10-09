import { describe, expect, it } from 'vitest';

import {
  buildTrend,
  pickGranularity,
  summarize,
  summarizeQuestion,
  type ResponseRow,
} from '../stats';

/**
 * 统计的验收标准是「指标数字与口径算式自洽」——
 * 而自洽这件事只有单测能盯住：界面上一眼看不出「有效答卷」是怎么算出来的。
 */
const NOW = new Date('2026-10-06T04:00:00Z'); // 北京时间 12:00

function response(overrides: Partial<ResponseRow> = {}): ResponseRow {
  return {
    id: Math.random().toString(36),
    status: 'VALID',
    submittedAt: new Date('2026-10-05T02:00:00Z'),
    durationMs: 60_000,
    channelId: null,
    ...overrides,
  };
}

describe('summarize', () => {
  it('**有效答卷 = 回收份数 − 无效**（这一条是验收标准）', () => {
    const rows = [response(), response(), response({ status: 'INVALID' })];
    const summary = summarize(rows, 5);

    expect(summary.received).toBe(3);
    expect(summary.invalid).toBe(1);
    expect(summary.valid).toBe(summary.received - summary.invalid);
  });

  it('回收份数含已标记无效的（设计稿卡片下的注释就是这么写的）', () => {
    expect(summarize([response({ status: 'INVALID' })], 0).received).toBe(1);
  });

  it('没有任何打开记录时完成率是 null，而不是编一个 100%', () => {
    expect(summarize([response()], 0).completionRate).toBeNull();
  });

  it('完成率的分母是打开数', () => {
    expect(summarize([response(), response()], 8).completionRate).toBe(0.25);
  });

  it('平均用时取的是提交者的实际耗时，中位数不受极端值影响', () => {
    const summary = summarize(
      [
        response({ durationMs: 60_000 }),
        response({ durationMs: 80_000 }),
        response({ durationMs: 3_600_000 }), // 有人开着页面去吃饭了
      ],
      3,
    );

    expect(summary.averageDurationMs).toBe(1_246_667);
    expect(summary.medianDurationMs).toBe(80_000);
  });

  it('一条耗时记录都没有时返回 null（老数据没有这个字段）', () => {
    const summary = summarize([response({ durationMs: null })], 1);

    expect(summary.averageDurationMs).toBeNull();
    expect(summary.medianDurationMs).toBeNull();
  });
});

describe('pickGranularity', () => {
  it('两个月内按天 —— 这样「哪天是 0」看得出来', () => {
    expect(
      pickGranularity(new Date('2026-09-01T00:00:00Z'), new Date('2026-10-06T00:00:00Z')),
    ).toBe('DAY');
  });

  it('卡在边界上时归到**更细**的那档（含两端正好 62 天仍是日）', () => {
    expect(
      pickGranularity(new Date('2026-08-06T00:00:00Z'), new Date('2026-10-06T00:00:00Z')),
    ).toBe('DAY');
    expect(
      pickGranularity(new Date('2026-08-05T00:00:00Z'), new Date('2026-10-06T00:00:00Z')),
    ).toBe('WEEK');
  });

  it('一年多以内按周，再长按月', () => {
    expect(
      pickGranularity(new Date('2026-01-01T00:00:00Z'), new Date('2026-10-06T00:00:00Z')),
    ).toBe('WEEK');
    expect(
      pickGranularity(new Date('2023-10-06T00:00:00Z'), new Date('2026-10-06T00:00:00Z')),
    ).toBe('MONTH');
  });

  it('同一天也至少是「按天」，不会退化成 0 天', () => {
    expect(pickGranularity(NOW, NOW)).toBe('DAY');
  });
});

describe('buildTrend', () => {
  /** 以 NOW 为终点往前 n 天（含两端）的区间 */
  function rangeEndingAtNow(days: number) {
    return { from: new Date(NOW.getTime() - (days - 1) * 24 * 60 * 60 * 1000), to: NOW };
  }

  it('只统计有效答卷（与图表口径一致）', () => {
    const { points } = buildTrend(
      [
        response({ submittedAt: new Date('2026-10-06T02:00:00Z') }),
        response({ submittedAt: new Date('2026-10-06T03:00:00Z'), status: 'INVALID' }),
      ],
      rangeEndingAtNow(14),
    );

    expect(points.at(-1)!.count).toBe(1);
  });

  it('**横轴就是筛选区间**：选 14 天就画 14 个点（不再固定成最近 14 天）', () => {
    const { points } = buildTrend([], {
      from: new Date('2026-09-23T00:00:00Z'),
      to: NOW,
    });

    expect(points).toHaveLength(14);
    expect(points.at(0)!.label).toBe('09-23');
    expect(points.at(-1)!.label).toBe('10-06');
  });

  it('空桶也会画出来 —— 否则「那天是 0」会被看成「那天不存在」', () => {
    const { points } = buildTrend(
      [response({ submittedAt: new Date('2026-10-06T02:00:00Z') })],
      rangeEndingAtNow(14),
    );

    expect(points).toHaveLength(14);
    expect(points.filter((point) => point.count === 0)).toHaveLength(13);
  });

  it('按展示时区切天：北京时间凌晨提交的算前一天', () => {
    // 2026-10-05T16:30Z = 北京时间 10-06 00:30 → 应落在 10-06 那一桶
    const { points } = buildTrend(
      [response({ submittedAt: new Date('2026-10-05T16:30:00Z') })],
      rangeEndingAtNow(14),
    );

    expect(points.at(-1)!.label).toBe('10-06');
    expect(points.at(-1)!.count).toBe(1);
  });

  it('区间长到一年多时自动按月，且最后一个桶是当月', () => {
    const { granularity, points } = buildTrend([], {
      from: new Date('2023-10-06T00:00:00Z'),
      to: NOW,
    });

    expect(granularity).toBe('MONTH');
    expect(points.at(-1)!.label).toBe('2026-10');
    expect(points).toHaveLength(37);
  });

  it('按月走不会在原地打转（31 天与 30 天的月份都要跨过去）', () => {
    const { points } = buildTrend([], {
      from: new Date('2025-01-15T00:00:00Z'),
      to: new Date('2026-05-02T00:00:00Z'),
    });
    const labels = points.map((point) => point.label);

    // 17 个月：减 30 天那种写法会在 3 月 31 日→3 月 1 日这种地方重复同一个标签
    expect(labels).toHaveLength(17);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.at(0)).toBe('2025-01');
    expect(labels.at(-1)).toBe('2026-05');
  });

  it('手改 URL 给出上千个月时只画最近的那一段（「最近怎么样」才是要看的）', () => {
    const { points } = buildTrend([], {
      from: new Date('1900-01-01T00:00:00Z'),
      to: NOW,
    });

    expect(points).toHaveLength(120);
    expect(points.at(-1)!.label).toBe('2026-10');
    expect(points.at(0)!.label).toBe('2016-11');
  });
});

describe('summarizeQuestion', () => {
  it('单选题按作答人数算占比（没答的人不摊薄分母）', () => {
    const stats = summarizeQuestion(
      { type: 'SINGLE', options: ['甲', '乙'], columns: [], min: null, max: null, required: true },
      ['甲', '甲', '乙'],
      10,
    );

    expect(stats.kind).toBe('CHOICE');
    if (stats.kind !== 'CHOICE') return;

    expect(stats.answered).toBe(3);
    expect(stats.rows[0]).toEqual({ label: '甲', count: 2, percent: 2 / 3 });
  });

  it('多选题一个答案算多个选项，所以各选项占比之和会大于 100%', () => {
    const stats = summarizeQuestion(
      {
        type: 'MULTI',
        options: ['甲', '乙', '丙'],
        columns: [],
        min: null,
        max: null,
        required: false,
      },
      [
        ['甲', '乙'],
        ['甲', '丙'],
      ],
      2,
    );

    if (stats.kind !== 'CHOICE') throw new Error('应为选择题');
    const total = stats.rows.reduce((sum, row) => sum + row.percent, 0);
    expect(total).toBeGreaterThan(1);
    expect(stats.multi).toBe(true);
  });

  it('评分题给平均分并保留一位小数，且列出每一分的分布', () => {
    const stats = summarizeQuestion(
      { type: 'RATING', options: [], columns: [], min: 1, max: 10, required: true },
      [8, 9, 10],
      3,
    );

    if (stats.kind !== 'RATING') throw new Error('应为评分题');
    expect(stats.average).toBe(9);
    expect(stats.rows).toHaveLength(10);
    expect(stats.rows.find((row) => row.score === 9)!.count).toBe(1);
  });

  it('评分题一个人在范围外的分数不计入', () => {
    const stats = summarizeQuestion(
      { type: 'RATING', options: [], columns: [], min: 1, max: 10, required: true },
      [10, 99],
      2,
    );

    if (stats.kind !== 'RATING') throw new Error('应为评分题');
    expect(stats.answered).toBe(1);
  });

  it('填空题给出作答率（分母是有效答卷数）与最多三条示例', () => {
    const stats = summarizeQuestion(
      { type: 'LONG_TEXT', options: [], columns: [], min: null, max: null, required: false },
      ['一', '二', '三', '四', '  '],
      8,
    );

    if (stats.kind !== 'TEXT') throw new Error('应为文本题');
    expect(stats.answered).toBe(4);
    expect(stats.answerRate).toBe(0.5);
    expect(stats.samples).toHaveLength(3);
  });

  // ---- 矩阵（R62）：每行一条分布，分母是**该行**的作答人数 ----
  it('矩阵题每行独立算占比（只选了部分行的人不摊薄其余行）', () => {
    const stats = summarizeQuestion(
      {
        type: 'MATRIX',
        options: ['报名流程', '现场组织'],
        columns: ['满意', '不满意'],
        min: null,
        max: null,
        required: false,
      },
      [
        { 报名流程: '满意', 现场组织: '满意' },
        { 报名流程: '不满意' }, // 只选了一行
        { 现场组织: '满意' },
      ],
      3,
    );

    if (stats.kind !== 'MATRIX') throw new Error('应为矩阵题');

    // 作答人数 = 至少选了一行的人数
    expect(stats.answered).toBe(3);
    expect(stats.rows[0]).toEqual({
      label: '报名流程',
      answered: 2,
      cells: [
        { label: '满意', count: 1, percent: 0.5 },
        { label: '不满意', count: 1, percent: 0.5 },
      ],
    });
    expect(stats.rows[1]!.answered).toBe(2);
    expect(stats.rows[1]!.cells[0]).toEqual({ label: '满意', count: 2, percent: 1 });
  });

  it('矩阵题里不认识的行列不计入（手动改过的历史值不污染分布）', () => {
    const stats = summarizeQuestion(
      {
        type: 'MATRIX',
        options: ['行 1', '行 2'],
        columns: ['甲'],
        min: null,
        max: null,
        required: false,
      },
      [{ '行 1': '乙', 不存在的行: '甲' }, { '行 2': '甲' }],
      2,
    );

    if (stats.kind !== 'MATRIX') throw new Error('应为矩阵题');

    expect(stats.answered).toBe(1);
    expect(stats.rows[0]!.answered).toBe(0);
    expect(stats.rows[1]!.cells[0]!.count).toBe(1);
  });
});
