import { describe, expect, it } from 'vitest';

import { parseDisplayDate } from '@/utils/format';

import { parseAnalyticsFilter } from '../filter';

/**
 * 解析入口要能接住「重复参数」（审查 #6）：
 * `?from=a&from=b` 会让 Next 把值给成数组，原样传下去会进到 Prisma 里。
 */
describe('parseAnalyticsFilter', () => {
  it('正常值：渠道与日期都解析出来', () => {
    const filter = parseAnalyticsFilter({
      channel: 'ck-1',
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(filter.channelId).toBe('ck-1');
    expect(filter.from?.getTime()).toBe(parseDisplayDate('2026-09-01')?.getTime());
    expect(filter.to?.getTime()).toBe(parseDisplayDate('2026-09-30')?.getTime());
  });

  it('重复参数各取第一个，不会把数组传进查询', () => {
    const filter = parseAnalyticsFilter({
      channel: ['ck-1', 'ck-2'],
      from: ['2026-09-01', '2026-10-01'],
      to: ['2026-09-30', '2026-10-31'],
    });

    expect(filter.channelId).toBe('ck-1');
    expect(filter.from?.getTime()).toBe(parseDisplayDate('2026-09-01')?.getTime());
    expect(filter.to?.getTime()).toBe(parseDisplayDate('2026-09-30')?.getTime());
  });

  it('空值与超长渠道 id 回落 null', () => {
    expect(parseAnalyticsFilter({ channel: 'x'.repeat(41) }).channelId).toBeNull();
    expect(parseAnalyticsFilter({ channel: '' }).channelId).toBeNull();
    expect(parseAnalyticsFilter({}).from).toBeNull();
  });
});
