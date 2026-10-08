import 'server-only';

import type { QuestionType } from '@/config/constants';
import { prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';

import {
  questionnairePayloadSchema,
  type QuestionnairePayload,
} from '@/lib/questionnaire-structure';

export type TemplateSummary = {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
};

/** 模板中心的两个 Tab */
export const TEMPLATE_SCOPE = { OFFICIAL: 'OFFICIAL', MINE: 'MINE' } as const;
export type TemplateScope = (typeof TEMPLATE_SCOPE)[keyof typeof TEMPLATE_SCOPE];

export type TemplateCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
  usageCount: number;
  isOfficial: boolean;
  /**
   * 前几道题的题型，卡片上的**抽象骨架**按它画。
   *
   * 缩略图不用图片：设计稿那张也是骨架（长条 = 文本题、小方块 = 选项、方格 = 评分），
   * 而骨架能从题型现算出来 —— 省掉一整套缩略图资源与它们的失效问题。
   */
  previewTypes: QuestionType[];
};

export type TemplateListQuery = {
  scope: TemplateScope;
  /** 空字符串 = 不搜 */
  keyword: string;
  /** null = 全部分类 */
  category: string | null;
};

/**
 * 模板中心的列表。
 *
 * 「官方」与「我的」是**两次不同口径的查询**（一个 `isOfficial: true`，一个按工作区），
 * 而不是查全部再由界面过滤 —— 后者会把别的租户的模板也取到手（哪怕不显示），
 * 数据不该为了「省一次查询」而出边界。
 */
export async function listTemplateCards(
  workspaceId: string,
  query: TemplateListQuery,
): Promise<TemplateCardData[]> {
  const templates = await prisma.template.findMany({
    where: {
      ...(query.scope === TEMPLATE_SCOPE.OFFICIAL
        ? { isOfficial: true }
        : { isOfficial: false, workspaceId }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword, mode: 'insensitive' as const } },
              { description: { contains: query.keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy:
      query.scope === TEMPLATE_SCOPE.OFFICIAL
        ? [{ category: 'asc' }, { title: 'asc' }]
        : // 自己的模板按最近改动排：刚另存出来的应该在最前面
          [{ updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      questionCount: true,
      usageCount: true,
      isOfficial: true,
      // payload 一并取出来只为画骨架的题型（演示规模：一页十来张）
      payload: true,
    },
  });

  return templates.map((template) => {
    const parsed = questionnairePayloadSchema.safeParse(template.payload);

    return {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      questionCount: template.questionCount,
      usageCount: template.usageCount,
      isOfficial: template.isOfficial,
      previewTypes: parsed.success
        ? parsed.data.questions.slice(0, 4).map((question) => question.type)
        : [],
    };
  });
}

/** 「我的模板」的数量（Tab 上的角标要有真数字） */
export function countWorkspaceTemplates(workspaceId: string) {
  return prisma.template.count({ where: { workspaceId, isOfficial: false } });
}

/**
 * 预览 / 编辑单个模板。
 *
 * 只认「官方」或「本工作区自己的」：别人工作区的模板 id 即使被猜中也不该被读到。
 */
export async function getTemplateDetail(templateId: string, workspaceId: string) {
  const template = await prisma.template.findFirst({
    where: { id: templateId, OR: [{ isOfficial: true }, { workspaceId }] },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      questionCount: true,
      usageCount: true,
      isOfficial: true,
      payload: true,
    },
  });

  if (!template) return null;

  const parsed = questionnairePayloadSchema.safeParse(template.payload);
  if (!parsed.success) return null;

  return { ...template, payload: parsed.data };
}

/** 重命名 / 删除前的归属校验：官方模板与别人的模板都不许动 */
export async function findEditableTemplate(templateId: string, workspaceId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, workspaceId, isOfficial: false },
    select: { id: true, title: true },
  });
}

export function listOfficialTemplates(): Promise<TemplateSummary[]> {
  return prisma.template.findMany({
    where: { isOfficial: true },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      questionCount: true,
    },
  });
}

/**
 * 取模板的题目结构。
 *
 * 库里存的是 Json，读出来必须**再校验一遍**：seed 或历史数据只要有一个字段对不上，
 * 后面materialize 的时候就会在写库阶段炸掉，还不如在入口就拦住。
 */
export async function getTemplatePayload(templateId: string): Promise<QuestionnairePayload | null> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { payload: true },
  });

  if (!template) return null;

  const parsed = questionnairePayloadSchema.safeParse(template.payload);
  return parsed.success ? parsed.data : null;
}

export function createTemplate(input: {
  workspaceId: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  payload: QuestionnairePayload;
}) {
  return prisma.template.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      category: input.category,
      questionCount: input.payload.questions.length,
      payload: toJsonColumn(input.payload),
      isOfficial: false,
    },
  });
}

/** 同名模板是否已存在（「另存为模板」重复点击时给一句明确提示） */
export function findWorkspaceTemplateByTitle(workspaceId: string, title: string) {
  return prisma.template.findFirst({
    where: { workspaceId, title },
    select: { id: true },
  });
}

/**
 * 本工作区自建模板**实际用过的分类**（去重，按名称排）。
 *
 * 两处要用，而且必须是同一份口径：
 * - 模板中心的分类胶囊（「我的模板」Tab 只列真有模板的分类，避免点进去空无一物）
 * - 「另存为模板」的下拉与**新增分类的重名校验** —— 判断「这个分类是否已存在」
 *   不能只看常量，用户自己建过的分类同样算存在
 */
export async function listWorkspaceTemplateCategories(workspaceId: string): Promise<string[]> {
  const rows = await prisma.template.findMany({
    where: { workspaceId, isOfficial: false },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });

  return rows.map((row) => row.category);
}
