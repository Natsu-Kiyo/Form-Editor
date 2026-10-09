import { describe, expect, it } from 'vitest';

import {
  canPublishTemplate,
  TEMPLATE_PUBLIC_LIMIT,
  TEMPLATE_PUBLIC_RULES,
} from '../template-publish';

/** 一份「哪一项都合格」的模板，逐条用例只改要测的那一项 */
const valid = {
  description: '一份用于演示的满意度调研模板，覆盖了几种常见题型',
  questionCount: 5,
  category: '满意度调研',
  publicCount: 0,
};

describe('canPublishTemplate', () => {
  it('全部条件满足时放行', () => {
    expect(canPublishTemplate(valid)).toEqual({ ok: true });
  });

  it('配额到达上限（含等于上限）即拒绝', () => {
    expect(canPublishTemplate({ ...valid, publicCount: TEMPLATE_PUBLIC_LIMIT - 1 }).ok).toBe(true);

    const full = canPublishTemplate({ ...valid, publicCount: TEMPLATE_PUBLIC_LIMIT });
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.reasons.join()).toContain('上限');
  });

  it('空模板不能公开', () => {
    const result = canPublishTemplate({ ...valid, questionCount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join()).toContain('空的模板');
  });

  it('题数超过上限不能公开（防超大 payload 进公共池）', () => {
    const result = canPublishTemplate({
      ...valid,
      questionCount: TEMPLATE_PUBLIC_RULES.maxQuestions + 1,
    });
    expect(result.ok).toBe(false);
  });

  it('描述按 trim 后的长度算：全是空格的描述不算数', () => {
    const result = canPublishTemplate({ ...valid, description: '        ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join()).toContain('说明');
  });

  it('描述刚好到下限时放行、差一个字就拒', () => {
    const min = TEMPLATE_PUBLIC_RULES.minDescription;
    expect(canPublishTemplate({ ...valid, description: '甲'.repeat(min) }).ok).toBe(true);
    expect(canPublishTemplate({ ...valid, description: '甲'.repeat(min - 1) }).ok).toBe(false);
  });

  it('描述超过上限不能公开', () => {
    const result = canPublishTemplate({
      ...valid,
      description: '甲'.repeat(TEMPLATE_PUBLIC_RULES.maxDescription + 1),
    });
    expect(result.ok).toBe(false);
  });

  it('自建分类不能直接进公共池（要么改选官方五类，要么选「其他」）', () => {
    const rejected = canPublishTemplate({ ...valid, category: '我们小组自己的分类' });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reasons.join()).toContain('公开分类');

    // 「其他」是兜底分类：官方五类之外的模板公开时归到它下面
    expect(canPublishTemplate({ ...valid, category: '其他' }).ok).toBe(true);
  });

  it('多项不合格时把所有原因一次列出来（用户不必试三次）', () => {
    const result = canPublishTemplate({
      ...valid,
      description: '太短',
      questionCount: 0,
      category: '自建分类',
      publicCount: TEMPLATE_PUBLIC_LIMIT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toHaveLength(4);
  });
});
