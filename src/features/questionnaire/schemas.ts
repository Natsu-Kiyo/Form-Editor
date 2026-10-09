import { z } from 'zod';

import { TEMPLATE_CATEGORY_NEW, TEMPLATE_PUBLIC_CATEGORIES } from '@/config/constants';

import { TEMPLATE_PUBLIC_RULES } from './lib/template-publish';

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

/**
 * 公开模板（X2）。
 *
 * 描述与分类**在公开时现场补齐**：模板创建之后没有编辑它们的入口（只有重命名），
 * 而公开池要求「一段像样的描述 + 官方分类」—— 没有这个弹层，早先另存出来的模板
 * 就永远公开不了（门槛把用户领进死路，比没有门槛更糟）。
 *
 * 配额与题数那两条不在这里：它们是**服务端才知道的业务状态**（已公开几张、库里几道题），
 * 见 `lib/template-publish.ts` 的 `canPublishTemplate`（界面与服务端共用）。
 */
export const publishTemplateSchema = z.object({
  templateId: z.string().min(1),
  description: z
    .string()
    .trim()
    .min(TEMPLATE_PUBLIC_RULES.minDescription, {
      error: `公开的模板需要一段 ${TEMPLATE_PUBLIC_RULES.minDescription} 个字以上的说明，让别人知道它是什么`,
    })
    .max(TEMPLATE_PUBLIC_RULES.maxDescription, {
      error: `模板说明不超过 ${TEMPLATE_PUBLIC_RULES.maxDescription} 个字`,
    }),
  category: z.enum(TEMPLATE_PUBLIC_CATEGORIES, { error: '请选择一个公开分类' }),
});
