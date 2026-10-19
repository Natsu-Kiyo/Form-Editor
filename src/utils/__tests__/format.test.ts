import { describe, expect, it } from 'vitest';

import { formatNotificationTime, isValidDateOnly, parseDateTimeLocal } from '@/utils/format';

/** 东八区 2026-10-05 13:38 */
const NOW = new Date('2026-10-05T05:38:00.000Z');

describe('formatNotificationTime', () => {
  it('今天的通知只显示时分', () => {
    expect(formatNotificationTime(new Date('2026-10-05T05:38:00.000Z'), NOW)).toBe('13:38');
  });

  it('昨天的通知带「昨天」前缀', () => {
    expect(formatNotificationTime(new Date('2026-10-04T10:20:00.000Z'), NOW)).toBe('昨天 18:20');
  });

  it('更早的通知显示月日', () => {
    expect(formatNotificationTime(new Date('2026-10-03T02:00:00.000Z'), NOW)).toBe('10-03');
  });

  it('按东八区分天，而不是按 UTC', () => {
    // UTC 是 10-04 16:30，东八区已经是 10-05 00:30 —— 应算作「今天」
    expect(formatNotificationTime(new Date('2026-10-04T16:30:00.000Z'), NOW)).toBe('00:30');
  });
});

/**
 * 日期 / 时刻的「真实存在」校验（审查 #16）。
 *
 * 正则只保证形状：`Date.UTC` 会把 `2026-02-31` 滚到 3 月 3 日、`25:00` 滚到次日，
 * 于是发布设置或作答答案会静默变成另一个时刻 / 一个不存在的日期。
 */
describe('parseDateTimeLocal', () => {
  it('真实存在的时刻照常解析（含闰年 2 月 29）', () => {
    expect(parseDateTimeLocal('2024-02-29 10:30')).toBeInstanceOf(Date);
  });

  it('不存在的日期返回 null（不滚到下个月）', () => {
    expect(parseDateTimeLocal('2026-02-31 10:00')).toBeNull();
    expect(parseDateTimeLocal('2026-13-01 10:00')).toBeNull();
  });

  it('越界的时刻返回 null', () => {
    expect(parseDateTimeLocal('2026-10-05 25:00')).toBeNull();
    expect(parseDateTimeLocal('2026-10-05 10:60')).toBeNull();
  });

  it('格式不对仍是 null', () => {
    expect(parseDateTimeLocal('2026/10/05 10:00')).toBeNull();
  });
});

describe('isValidDateOnly', () => {
  it('真实存在的日期为 true（含闰年 2 月 29）', () => {
    expect(isValidDateOnly('2026-10-20')).toBe(true);
    expect(isValidDateOnly('2024-02-29')).toBe(true);
  });

  it('不存在的日期为 false', () => {
    expect(isValidDateOnly('2026-02-31')).toBe(false);
    expect(isValidDateOnly('2025-02-29')).toBe(false);
    expect(isValidDateOnly('0000-00-00')).toBe(false);
  });
});
