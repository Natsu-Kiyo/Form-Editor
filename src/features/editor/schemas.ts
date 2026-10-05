import { z } from 'zod';

/**
 * 编辑器改的是「一个字段」，所以用 **patch** 语义而不是整表提交：
 * 属性面板的每个控件各自保存，提交一整份表单会让「只改必填」也把标题一起覆盖回去。
 */

/** 库里开放的 7 个题型；矩阵题属 1.1，不在其中 */
export const editableQuestionTypeSchema = z.enum([
  'SINGLE',
  'MULTI',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
  'DROPDOWN',
  'DATE',
]);

export const questionPatchSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: '题目不能为空' })
      .max(200, { error: '题目不超过 200 个字' })
      .optional(),
    description: z.string().trim().max(500, { error: '说明不超过 500 个字' }).nullable().optional(),
    required: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    type: editableQuestionTypeSchema.optional(),
    config: z
      .object({
        min: z.number().int().min(0).max(10).optional(),
        max: z.number().int().min(1).max(10).optional(),
        maxLength: z.number().int().min(1).max(2000).optional(),
      })
      .optional(),
  })
  // 空 patch 说明调用方写错了，直接拦住比空转一次写库好
  .refine((patch) => Object.keys(patch).length > 0, { error: '没有要修改的内容' });

export type QuestionPatch = z.infer<typeof questionPatchSchema>;

export const optionLabelSchema = z
  .string()
  .trim()
  .min(1, { error: '选项不能为空' })
  .max(100, { error: '选项不超过 100 个字' });

export const renameQuestionnaireSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: '问卷标题不能为空' })
    .max(80, { error: '标题不超过 80 个字' }),
});

export type RenameQuestionnaireInput = z.infer<typeof renameQuestionnaireSchema>;
