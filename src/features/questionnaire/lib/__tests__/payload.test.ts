import { describe, expect, it } from 'vitest';

import { payloadFileName, questionnairePayloadSchema } from '@/features/questionnaire/lib/payload';

/**
 * 这套 schema 同时守着三条通路：模板 payload、导出 JSON、导入 JSON。
 * 所以这里测的是「哪些结构会被放进来」——放进来一个坏结构，
 * 后面 materialize 写库时才会炸，那时已经很难定位了。
 */
describe('questionnairePayloadSchema', () => {
  const minimal = {
    formatVersion: 1,
    title: '测试问卷',
    questions: [{ type: 'SINGLE', title: '你选哪个？', options: ['A', 'B'] }],
  };

  it('接受一个最小可用结构，并补齐默认值', () => {
    const parsed = questionnairePayloadSchema.parse(minimal);

    expect(parsed.questions[0].required).toBe(false);
    expect(parsed.questions[0].shuffleOptions).toBe(false);
    expect(parsed.questions[0].pageIndex).toBe(0);
  });

  it('拒绝矩阵题（1.1 才开放，不进 payload）', () => {
    const result = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [{ type: 'MATRIX', title: '矩阵题' }],
    });

    expect(result.success).toBe(false);
  });

  it('拒绝缺少 formatVersion 的旧结构', () => {
    const withoutVersion: Record<string, unknown> = { ...minimal };
    delete withoutVersion.formatVersion;

    expect(questionnairePayloadSchema.safeParse(withoutVersion).success).toBe(false);
  });

  it('拒绝题目超过 200 道', () => {
    const result = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: Array.from({ length: 201 }, (_, index) => ({
        type: 'SHORT_TEXT',
        title: `第 ${index + 1} 题`,
      })),
    });

    expect(result.success).toBe(false);
  });

  it('拒绝空题目标题', () => {
    const result = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [{ type: 'SHORT_TEXT', title: '   ' }],
    });

    expect(result.success).toBe(false);
  });
});

describe('payloadFileName', () => {
  it('把标题里对文件名不友好的字符换成连字符', () => {
    expect(payloadFileName('2026 秋季/社团:招新')).toBe('2026-秋季-社团-招新.json');
  });

  it('标题全是特殊字符时回落到默认名', () => {
    expect(payloadFileName('   ')).toBe('questionnaire.json');
  });
});
