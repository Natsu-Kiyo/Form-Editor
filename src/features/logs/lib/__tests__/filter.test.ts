import { describe, expect, it } from 'vitest';

import { OPERATION_TYPE_GROUP } from '@/config/constants';

import { parseLogsQuery } from '../filter';

describe('parseLogsQuery', () => {
  it('重复参数各取第一个（审查 #6）', () => {
    const group = Object.values(OPERATION_TYPE_GROUP)[0];

    const query = parseLogsQuery({
      actor: ['user-1', 'user-2'],
      group: [group, group],
      days: ['30', '7'],
    });

    expect(query.actorId).toBe('user-1');
    expect(query.group).toBe(group);
    expect(query.days).toBe(30);
  });

  it('白名单外的值回落默认', () => {
    expect(parseLogsQuery({ actor: 'x'.repeat(41), group: 'NOPE', days: '365' })).toEqual({
      actorId: null,
      group: null,
      days: 7,
    });
  });
});
