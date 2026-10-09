import { describe, expect, it } from 'vitest';

import { payloadFileName, questionnairePayloadSchema } from '@/lib/questionnaire-structure';

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

  it('接受合法的矩阵题（R62）：行在 options、列在 config.columns', () => {
    const parsed = questionnairePayloadSchema.parse({
      ...minimal,
      questions: [
        {
          type: 'MATRIX',
          title: '请为各个环节打分',
          options: ['报名流程', '现场组织'],
          config: { columns: ['满意', '一般', '不满意'] },
        },
      ],
    });

    expect(parsed.questions[0].options).toHaveLength(2);
  });

  it('拒绝缺行列的矩阵题（没有行列就不是一道能答的矩阵）', () => {
    const noLines = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [{ type: 'MATRIX', title: '矩阵题' }],
    });
    expect(noLines.success).toBe(false);

    // 只有 1 行（少于下限 2）、或只有 1 列，同样要拒
    const oneRow = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [
        {
          type: 'MATRIX',
          title: '矩阵题',
          options: ['孤零零一行'],
          config: { columns: ['a', 'b'] },
        },
      ],
    });
    expect(oneRow.success).toBe(false);

    const oneColumn = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [
        { type: 'MATRIX', title: '矩阵题', options: ['行 1', '行 2'], config: { columns: ['a'] } },
      ],
    });
    expect(oneColumn.success).toBe(false);
  });

  it('拒绝超出上下限的矩阵题（列 6 个 / 行 11 个都进不来）', () => {
    const tooManyColumns = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [
        {
          type: 'MATRIX',
          title: '矩阵题',
          options: ['行 1', '行 2'],
          config: { columns: ['1', '2', '3', '4', '5', '6'] },
        },
      ],
    });
    expect(tooManyColumns.success).toBe(false);

    const tooManyRows = questionnairePayloadSchema.safeParse({
      ...minimal,
      questions: [
        {
          type: 'MATRIX',
          title: '矩阵题',
          options: Array.from({ length: 11 }, (_, index) => `行 ${index + 1}`),
          config: { columns: ['a', 'b'] },
        },
      ],
    });
    expect(tooManyRows.success).toBe(false);
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
