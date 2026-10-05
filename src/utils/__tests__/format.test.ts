import { describe, expect, it } from 'vitest';

import { formatNotificationTime } from '@/utils/format';

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
