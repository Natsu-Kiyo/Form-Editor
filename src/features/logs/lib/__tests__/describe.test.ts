import { describe, expect, it } from 'vitest';

import { OPERATION_TYPE } from '@/config/constants';

import { describeOperation } from '../describe';

/**
 * 日志文案是这一页的全部可读性来源，而它按操作类型分支 —— 十几条分支靠肉眼点是点不过来的。
 * 这里盯三件事：句子读得通、`extra` 从 detail 里取到了真东西、**没见过的类型不炸**。
 */
describe('describeOperation', () => {
  it('状态变更类：句子读得通，且第二行说清前后状态', () => {
    const pause = describeOperation({
      type: OPERATION_TYPE.PAUSE,
      targetName: '课程作业互评',
      detail: null,
    });

    expect(pause.sentence).toEqual({
      prefix: '暂停了问卷',
      target: '课程作业互评',
      suffix: '的回收',
    });
    expect(pause.extra).toBe('回收中 → 已暂停');
    expect(pause.group).toBe('状态变更');
  });

  it('把 detail 里的东西取出来（回滚的版本、渠道的参数、导出的份数）', () => {
    expect(
      describeOperation({ type: OPERATION_TYPE.ROLLBACK, targetName: 'X', detail: { from: 'v2' } })
        .extra,
    ).toBe('恢复到 v2');

    const channel = describeOperation({
      type: OPERATION_TYPE.CHANNEL_CREATE,
      targetName: 'X',
      detail: { channel: '公众号', src: 'ch-ab12' },
    });
    expect(channel.extra).toContain('公众号');
    expect(channel.extra).toContain('?src=ch-ab12');

    expect(
      describeOperation({ type: OPERATION_TYPE.EXPORT, targetName: 'X', detail: { rows: 342 } })
        .extra,
    ).toBe('CSV · 342 份');
  });

  it('答卷状态：说清是第几号答卷，并点出它对统计的影响', () => {
    const invalid = describeOperation({
      type: OPERATION_TYPE.RESPONSE_INVALIDATE,
      targetName: 'X',
      detail: { serial: 126 },
    });

    expect(invalid.sentence.suffix).toContain('#126');
    expect(invalid.extra).toBe('统计图不再计入它');
    expect(invalid.group).toBe('数据');
  });

  it('成员管理：对象是邮箱或成员名，不是问卷名', () => {
    const invite = describeOperation({
      type: OPERATION_TYPE.INVITE,
      targetName: '轻问卷演示团队',
      detail: { email: 'li.meng@example.com', role: '编辑者' },
    });

    expect(invite.sentence.target).toBe('li.meng@example.com');
    expect(invite.extra).toBe('编辑者 · 等待接受');
  });

  it('模板公开与取消公开：对象是模板名，第二行带分类', () => {
    const publish = describeOperation({
      type: OPERATION_TYPE.TEMPLATE_PUBLISH,
      targetName: '活动满意度回访',
      detail: { category: '满意度调研' },
    });

    expect(publish.sentence).toEqual({
      prefix: '把模板',
      target: '活动满意度回访',
      suffix: '公开到了公开池',
    });
    expect(publish.extra).toBe('分类：满意度调研');

    const unpublish = describeOperation({
      type: OPERATION_TYPE.TEMPLATE_UNPUBLISH,
      targetName: '活动满意度回访',
      detail: null,
    });
    expect(unpublish.sentence.suffix).toBe('从公开池收回了');
    expect(unpublish.group).toBe(publish.group);
  });

  it('没见过的类型也要兜住（类型会随里程碑增长，漏一个不该让整页空白）', () => {
    const unknown = describeOperation({ type: 'FUTURE_TYPE', targetName: 'X', detail: null });

    expect(unknown.sentence.target).toBe('X');
    expect(unknown.sentence.suffix).toBeTruthy();
  });

  it('对象名缺失时不留空白', () => {
    expect(
      describeOperation({ type: OPERATION_TYPE.PUBLISH, targetName: '', detail: null }).sentence
        .target,
    ).toBe('问卷');
  });
});
