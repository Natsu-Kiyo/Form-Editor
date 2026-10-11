import { describe, expect, it } from 'vitest';

import { collectionActionSchema } from '../../schemas';
import {
  COLLECTION_ACTIONS,
  COLLECTION_UI_ACTIONS,
  resolveCollectionTransition,
  type CollectionAction,
} from '../transitions';

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

/**
 * R91 的回归（第七轮 B1）：**回收开关接口的白名单不含 `PUBLISH`**。
 *
 * 这条旁路曾经真的存在 —— schema 用的是状态机全集，于是任何一个有 ADMIN 的人（或一段
 * 伪造请求）发一个 `'PAUSE'` 以外的东西就能「发布」，绕过 preflight / publishedAt /
 * 版本快照；而 `publishedAt` 为空又会让「归档后恢复」把一份**收过答卷**的问卷变回草稿，
 * 编辑器再一保存就把题目（连带级联的答卷）删了。
 *
 * 断言落在 schema 上：它是这条接口的第一道闸，接口收什么就是它收什么。
 */
describe('collectionActionSchema（回收开关接口的入参白名单）', () => {
  it('拒绝 PUBLISH —— 发布必须走发布设置那一套校验', () => {
    expect(collectionActionSchema.safeParse('PUBLISH').success).toBe(false);
  });

  it('放行 UI 真正会发的三个动作', () => {
    for (const action of COLLECTION_UI_ACTIONS) {
      expect(collectionActionSchema.safeParse(action).success).toBe(true);
    }
  });

  it('状态机仍认识 PUBLISH（两个集合刻意不同，别混用）', () => {
    expect(COLLECTION_ACTIONS).toContain('PUBLISH');
    expect(resolveCollectionTransition('DRAFT', 'PUBLISH', NOT_PAST)).toEqual({
      ok: true,
      next: 'PUBLISHED',
    });
  });
});
