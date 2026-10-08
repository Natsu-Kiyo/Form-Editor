import { z } from 'zod';

import { TEMPLATE_CATEGORY_NEW } from '@/config/constants';

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

/** 模板重命名：与「另存为模板」共用同一套名称规则（长度、去空格） */
export const renameTemplateSchema = z.object({
  templateId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, { error: '请输入模板名称' })
    .max(60, { error: '模板名称不超过 60 个字' }),
});

/**
 * 另存为模板。
 *
 * 分类有两个来源，用**哨兵值**在同一个字段里表达：
 * - `category` = 一个现有分类名 → 直接用
 * - `category` = `TEMPLATE_CATEGORY_NEW` → 真实分类在 `newCategory` 里，且**不能与现有分类重名**
 *
 * 重名只在**新增**这一支校验：从下拉里选的必然已存在，报「已存在」是噪音。
 * 「现有分类」的范围（常量 + 本工作区已有的）服务端才知道，所以那一半在 action 里判。
 */
export const saveAsTemplateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: '请输入模板名称' })
      .max(60, { error: '模板名称不超过 60 个字' }),
    description: z.string().trim().max(200, { error: '模板说明不超过 200 个字' }).optional(),
    category: z.string().trim().min(1, { error: '请选择模板分类' }),
    newCategory: z.string().trim().max(20, { error: '分类名称不超过 20 个字' }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.category !== TEMPLATE_CATEGORY_NEW) return;

    if (!value.newCategory) {
      ctx.addIssue({ code: 'custom', path: ['newCategory'], message: '请输入新的分类名称' });
    }
  });
