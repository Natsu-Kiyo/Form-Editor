import { z } from 'zod';

import { MATRIX_LIMITS, QUESTION_TYPE_LABEL, type QuestionType } from '@/config/constants';

/**
 * 问卷结构快照。
 *
 * **同一套结构同时承担三件事**：官方模板的 `Template.payload`、
 * 「导出 JSON」下发的文件、以及「导入 JSON」解析的对象。
 * 三者共用一个 schema 才不会出现「导出得出来、导入不回去」的错配。
 */

/** 数据库枚举里已开放的题型（R62 起 8 个全开放） */
const PAYLOAD_QUESTION_TYPES = [
  'SINGLE',
  'MULTI',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
  'DROPDOWN',
  'DATE',
  'MATRIX',
] as const satisfies readonly QuestionType[];

export const payloadQuestionSchema = z
  .object({
    type: z.enum(PAYLOAD_QUESTION_TYPES),
    title: z
      .string()
      .trim()
      .min(1, { error: '题目不能为空' })
      .max(200, { error: '题目不超过 200 个字' }),
    description: z.string().max(500).nullish(),
    required: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    pageIndex: z.number().int().min(0).default(0),
    /** 题型差异项：评分范围、文本长度上限、矩阵的列等 */
    config: z.record(z.string(), z.unknown()).nullish(),
    /** 选择类题型的选项文案；**矩阵题的「行」也在这一份**（两者结构完全同构，见 §R62） */
    options: z.array(z.string().trim().min(1).max(100)).default([]),
  })
  /**
   * 矩阵题的额外要求（R62）：行 2–10（在 `options` 里）、列 2–5（在 `config.columns` 里）。
   *
   * 校验放在这里 —— 这是编辑器保存 / 模板 / JSON 导入**三通路的唯一闸门**；
   * 界面上「删到下限就不给删」只是即时反馈，不是安全边界。
   */
  .superRefine((question, ctx) => {
    if (question.type !== 'MATRIX') return;

    if (
      question.options.length < MATRIX_LIMITS.MIN_ROWS ||
      question.options.length > MATRIX_LIMITS.MAX_ROWS
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `矩阵题要有 ${MATRIX_LIMITS.MIN_ROWS}–${MATRIX_LIMITS.MAX_ROWS} 行`,
      });
    }

    const columns = question.config?.columns;
    const columnsOk =
      Array.isArray(columns) &&
      columns.length >= MATRIX_LIMITS.MIN_COLUMNS &&
      columns.length <= MATRIX_LIMITS.MAX_COLUMNS &&
      columns.every(
        (item) =>
          typeof item === 'string' &&
          item.trim().length > 0 &&
          item.length <= MATRIX_LIMITS.MAX_COLUMN_LENGTH,
      );

    if (!columnsOk) {
      ctx.addIssue({
        code: 'custom',
        path: ['config', 'columns'],
        message: `矩阵题要有 ${MATRIX_LIMITS.MIN_COLUMNS}–${MATRIX_LIMITS.MAX_COLUMNS} 列`,
      });
    }
  });

export const questionnairePayloadSchema = z.object({
  /** 结构版本号。将来结构变了，靠它决定要不要迁移旧文件 */
  formatVersion: z.literal(1),
  title: z.string().trim().min(1).max(80).default('未命名问卷'),
  intro: z.string().max(500).nullish(),
  questions: z
    .array(payloadQuestionSchema)
    .max(200, { error: '一份问卷最多 200 道题' })
    .default([]),
});

export type PayloadQuestion = z.infer<typeof payloadQuestionSchema>;
export type QuestionnairePayload = z.infer<typeof questionnairePayloadSchema>;

/** 只有选择题带「选项」 */
export function isChoiceQuestion(type: QuestionType) {
  return type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN';
}

/**
 * 题目载荷里带**一组有序文本项**的题型：选择类的选项 + 矩阵题的行（R62）。
 *
 * 两者结构完全同构、共用同一张 `Option` 表与同一套列表组件，
 * 所以凡是「这份结构里有没有那串文本项、要不要保留 `options`」的判断都用它，
 * 而不是在各地各自拼一遍题型清单。
 */
export function hasOptionList(type: QuestionType) {
  return isChoiceQuestion(type) || type === 'MATRIX';
}

/** 导出文件名：把标题里对文件名不友好的字符（含空白）换成连字符 */
export function payloadFileName(title: string) {
  const safe =
    title
      .trim()
      .replace(/[\\/:*?"<>|\s]+/g, '-')
      // 首尾的连字符要去掉，否则「   」这种全空白标题会变成文件名「-.json」
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'questionnaire';

  return `${safe}.json`;
}

/** 题型的中文名，导出文件里也带上，方便人直接读 */
export function describeQuestionType(type: QuestionType) {
  return QUESTION_TYPE_LABEL[type];
}
