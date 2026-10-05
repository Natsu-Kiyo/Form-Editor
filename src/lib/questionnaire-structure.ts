import { z } from 'zod';

import { QUESTION_TYPE_LABEL, type QuestionType } from '@/config/constants';

/**
 * 问卷结构快照。
 *
 * **同一套结构同时承担三件事**：官方模板的 `Template.payload`、
 * 「导出 JSON」下发的文件、以及「导入 JSON」解析的对象。
 * 三者共用一个 schema 才不会出现「导出得出来、导入不回去」的错配。
 */

/** 数据库枚举里 M2 已开放的题型（矩阵题属 1.1，不在 payload 的合法取值里） */
const PAYLOAD_QUESTION_TYPES = [
  'SINGLE',
  'MULTI',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
  'DROPDOWN',
  'DATE',
] as const satisfies readonly QuestionType[];

export const payloadQuestionSchema = z.object({
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
  /** 题型差异项：评分范围、文本长度上限等 */
  config: z.record(z.string(), z.unknown()).nullish(),
  /** 选择类题型的选项文案，按顺序 */
  options: z.array(z.string().trim().min(1).max(100)).default([]),
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

/** 只有选择题带选项，其余题型的空 `options` 数组写库前要去掉 */
export function isChoiceQuestion(type: QuestionType) {
  return type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN';
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
