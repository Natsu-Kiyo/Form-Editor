import { describe, expect, it } from 'vitest';

import { versionSummary } from '../version-summary';

/**
 * 版本列表的主文案（用户复测 #3）。
 *
 * 原来的主文案是 `label`，十条记录都是「保存草稿」—— 用户没法判断该退回哪一版。
 * 这三条分支覆盖了「新记录 / 首条 / 字段上线前的老记录」。
 */
describe('版本主文案', () => {
  it('有来源版本时说清基于哪一版改的，并带题数', () => {
    expect(
      versionSummary({ version: 10, sourceVersion: 6, questionCount: 4, label: '保存草稿' }),
    ).toBe('修改自 v6 · 共 4 道题');
  });

  it('第一条是「初始版本」而不是「修改自 v0」', () => {
    expect(
      versionSummary({ version: 1, sourceVersion: null, questionCount: 2, label: '保存草稿' }),
    ).toBe('初始版本 · 共 2 道题');
  });

  it('没有题也照实说 0 道，不留空', () => {
    expect(
      versionSummary({ version: 1, sourceVersion: null, questionCount: 0, label: '保存草稿' }),
    ).toBe('初始版本 · 共 0 道题');
  });

  /*
   * 字段上线前的记录没有来源版本。这里**回退显示当时的 label**，而不是拿「上一条编号」
   * 顶上 —— 老记录里的「回滚自 v5」与「上一条编号」并不是一回事，顶上去就是编造。
   */
  it('老记录回退显示原来的 label', () => {
    expect(
      versionSummary({ version: 3, sourceVersion: null, questionCount: 5, label: '保存草稿' }),
    ).toBe('保存草稿 · 共 5 道题');

    expect(
      versionSummary({ version: 8, sourceVersion: null, questionCount: 3, label: '回滚自 v6' }),
    ).toBe('回滚自 v6 · 共 3 道题');
  });

  it('来源版本就是 0 号也照常显示（不把 0 当空）', () => {
    expect(
      versionSummary({ version: 2, sourceVersion: 0, questionCount: 1, label: '保存草稿' }),
    ).toBe('修改自 v0 · 共 1 道题');
  });
});
