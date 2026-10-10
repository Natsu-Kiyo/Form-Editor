import { describe, expect, it } from 'vitest';

import { resolveCollectionTransition, type CollectionAction } from '../transitions';

/**
 * 这三条迁移都会改数据库里的状态，其中「截止」还不可逆 ——
 * 靠手点验不完，所以整张状态表都要被穷举。
 */
const NOT_PAST = { pastEndTime: false };
const PAST = { pastEndTime: true };

function run(current: Parameters<typeof resolveCollectionTransition>[0], action: CollectionAction) {
  return resolveCollectionTransition(current, action, NOT_PAST);
}

describe('resolveCollectionTransition', () => {
  it('草稿可以发布', () => {
    expect(run('DRAFT', 'PUBLISH')).toEqual({ ok: true, next: 'PUBLISHED' });
  });

  it('已发布的不能再发布一次', () => {
    expect(run('PUBLISHED', 'PUBLISH').ok).toBe(false);
  });

  it('回收中可以暂停，但不是反过来', () => {
    expect(run('PUBLISHED', 'PAUSE')).toEqual({ ok: true, next: 'PAUSED' });
    expect(run('PAUSED', 'PAUSE').ok).toBe(false);
  });

  it('已暂停可以恢复', () => {
    expect(run('PAUSED', 'RESUME')).toEqual({ ok: true, next: 'PUBLISHED' });
  });

  it('跳过结束时间就不能恢复 —— 否则「点了恢复，链接还是不能填」', () => {
    const result = resolveCollectionTransition('PAUSED', 'RESUME', PAST);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('结束时间已过');
  });

  it('回收中与已暂停都能截止', () => {
    expect(run('PUBLISHED', 'CLOSE')).toEqual({ ok: true, next: 'CLOSED' });
    expect(run('PAUSED', 'CLOSE')).toEqual({ ok: true, next: 'CLOSED' });
  });

  it('**已截止不可重开**（恢复回收也不行）', () => {
    expect(run('CLOSED', 'RESUME').ok).toBe(false);
    expect(run('CLOSED', 'PUBLISH').ok).toBe(false);
    expect(run('CLOSED', 'PAUSE').ok).toBe(false);
  });

  it('已归档是终点：三种动作都不允许', () => {
    for (const action of ['PAUSE', 'RESUME', 'CLOSE'] as const) {
      expect(run('ARCHIVED', action).ok).toBe(false);
    }
  });

  it('草稿不能暂停 / 截止（还没开始回收）', () => {
    expect(run('DRAFT', 'PAUSE').ok).toBe(false);
    expect(run('DRAFT', 'CLOSE').ok).toBe(false);
  });

  it('伪造的动作名得到 { ok: false }，**不是** undefined（否则调用方读 .ok 直接抛）', () => {
    // 动作名从 Server Action 的参数进来，运行时不保证是这四个字面量之一
    const bogus = 'DROP' as CollectionAction;

    expect(resolveCollectionTransition('PUBLISHED', bogus, NOT_PAST)).toEqual({
      ok: false,
      message: '不支持的操作',
    });
  });
});
