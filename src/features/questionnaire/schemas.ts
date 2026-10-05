import { z } from 'zod';

/** 新建问卷弹层只有两种方式，没有标题输入 —— 标题在编辑器顶栏里改 */
export const CREATE_MODE = {
  BLANK: 'BLANK',
  TEMPLATE: 'TEMPLATE',
} as const;

export type CreateMode = (typeof CREATE_MODE)[keyof typeof CREATE_MODE];

export const createQuestionnaireSchema = z.object({
  mode: z.enum([CREATE_MODE.BLANK, CREATE_MODE.TEMPLATE]),
  templateId: z.string().optional(),
});

export const saveAsTemplateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: '请输入模板名称' })
    .max(60, { error: '模板名称不超过 60 个字' }),
  description: z.string().trim().max(200, { error: '模板说明不超过 200 个字' }).optional(),
});
