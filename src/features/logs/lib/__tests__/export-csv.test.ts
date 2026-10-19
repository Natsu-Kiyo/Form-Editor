import { describe, expect, it } from 'vitest';

import type { LogsPageData } from '../../api/logs';
import { buildLogsCsvRows } from '../export-csv';

function build(overrides: Partial<LogsPageData> = {}): LogsPageData {
  return {
    days: [
      {
        key: '2026-10-18',
        label: '2026-10-18',
        rows: [
          {
            id: 'log-1',
            actorName: '林予',
            sentence: { prefix: '发布了问卷', target: '「秋季招新」', suffix: '' },
            extra: null,
            typeLabel: '发布',
            groupLabel: '问卷',
            timeLabel: '10:24',
          },
        ],
      },
    ],
    actors: [],
    total: 1,
    truncated: false,
    ...overrides,
  };
}

/**
 * 审计文件的完整性是它唯一的用处（审查 #18）：
 * 被截断时必须**在文件里**留下痕迹，而不是靠用户去猜。
 */
describe('buildLogsCsvRows', () => {
  it('未截断时是「表头 + 数据」', () => {
    const rows = buildLogsCsvRows(build());

    expect(rows[0]).toEqual(['时间', '成员', '操作', '类型', '对象', '补充']);
    expect(rows[1]).toEqual([
      '2026-10-18 10:24',
      '林予',
      '发布了问卷「秋季招新」',
      '问卷',
      '发布',
      '',
    ]);
  });

  it('被截断时第一行就是说明，不会把「最近 2000 条」冒充成全部', () => {
    const rows = buildLogsCsvRows(build({ truncated: true }), 2000);

    expect(rows[0]?.[0]).toContain('只包含最近 2000 条');
    expect(rows[1]).toEqual(['时间', '成员', '操作', '类型', '对象', '补充']);
  });
});
