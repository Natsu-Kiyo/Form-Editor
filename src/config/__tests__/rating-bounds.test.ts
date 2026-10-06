import { describe, expect, it } from 'vitest';

import { RATING_SCALE, ratingBounds } from '../constants';

/**
 * 评分范围是所有评分题展示（画布刻度、题目摘要）的唯一来源，
 * 所以它必须**永远**给出一个能安全渲染的范围 —— 上限一旦漏出去，
 * 画布上就会出现一排被压扁的窄框（实测 17 个方块直接溢出卡片）。
 */
describe('ratingBounds', () => {
  it('没设过 config 时给默认 1–5', () => {
    expect(ratingBounds({})).toEqual({ min: 1, max: 5 });
  });

  it('把过大的上限收敛到 10（历史数据里可能残留 17 之类的值）', () => {
    expect(ratingBounds({ min: 1, max: 17 })).toEqual({ min: 1, max: RATING_SCALE.MAX });
  });

  it('把过小的最小值抬到 1（评分为 0 起没有意义）', () => {
    expect(ratingBounds({ min: 0, max: 5 })).toEqual({ min: 1, max: 5 });
  });

  it('两个值都越界时仍保证 min < max', () => {
    const { min, max } = ratingBounds({ min: 99, max: 99 });

    expect(min).toBeLessThan(max);
    expect(max).toBeLessThanOrEqual(RATING_SCALE.MAX);
  });

  it('合法范围内原样返回', () => {
    expect(ratingBounds({ min: 2, max: 8 })).toEqual({ min: 2, max: 8 });
  });

  it('非数字一律回落到默认值（Json 列里什么都可能有）', () => {
    expect(ratingBounds({ min: '3', max: null })).toEqual({ min: 1, max: 5 });
  });

  it('任何输入下刻度个数都不超过上限', () => {
    const samples = [
      {},
      { min: 1, max: 17 },
      { min: -5, max: 1000 },
      { min: 9, max: 9 },
      { min: 0, max: 0 },
    ];

    for (const config of samples) {
      const { min, max } = ratingBounds(config);
      expect(max - min + 1).toBeLessThanOrEqual(RATING_SCALE.MAX);
    }
  });
});
