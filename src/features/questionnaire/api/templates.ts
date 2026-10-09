import 'server-only';

import { TEMPLATE_CATEGORY_OTHER, type QuestionType } from '@/config/constants';
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

/**
 * 模板中心的两个 Tab。
 *
 * X2 起第一个 Tab 从「官方模板」改为「**公开模板**」（所有者拍板）：池子 =
 * 官方模板（seed 写入，`isOfficial: true`）**∪** 各工作区公开的模板（`isPublic: true`）。
 * 两个来源在数据上分开，排序时官方恒在前（产品内容不该被后来者挤下去）。
 */
export const TEMPLATE_SCOPE = { PUBLIC: 'PUBLIC', MINE: 'MINE' } as const;
export type TemplateScope = (typeof TEMPLATE_SCOPE)[keyof typeof TEMPLATE_SCOPE];

export type TemplateCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
  usageCount: number;
  isOfficial: boolean;
  /** 已被某工作区公开（公开池的第二个来源；官方模板恒为 false） */
  isPublic: boolean;
  /** 本工作区是否收藏了它（星标状态） */
  isFavorited: boolean;
  /**
   * 公开池里显示「来自 X」的来源名。
   *
   * 官方模板（没有归属）与自己工作区的模板都是 null —— 前者不需要来源，
   * 后者就是「我自己的」。**透明化是防污染的一环**：谁公开的一目了然。
   */
  workspaceName: string | null;
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

/** 公开池一次最多取多少张（按公开时间倒序，超出时拿最近的那批） */
const PUBLIC_POOL_LIMIT = 48;

/**
 * 「这个工作区能读到哪些模板」的**唯一口径**：官方 / 别人已公开的 / 本工作区自己的。
 *
 * 预览、使用（复制为新问卷）、收藏校验三处共用。写路径（重命名 / 删除 / 公开）
 * 另有一套更严的口径（`findEditableTemplate`），**两者不要混**。
 */
function readableBy(workspaceId: string) {
  return { OR: [{ isOfficial: true }, { isPublic: true }, { workspaceId }] };
}

/**
 * 模板中心的列表。
 *
 * 两个 Tab 是**两次不同口径的查询**（公开池 = 官方 ∪ 已公开；「我的」= 本工作区的），
 * 而不是查全部再由界面过滤 —— 后者会把**别人的**私有模板也取到手（哪怕不显示），
 * 数据不该为了「省一次查询」而出边界。公开池是唯一一处刻意跨工作区读的地方
 * （`isPublic: true` 本身就是「允许所有人看」的意思）。
 *
 * 排序刻意**不用 usageCount**：公开池按公开时间倒序，没有排序收益就没有刷量的动机。
 */
export async function listTemplateCards(
  workspaceId: string,
  query: TemplateListQuery,
): Promise<TemplateCardData[]> {
  const favoriteIds = await listWorkspaceFavoriteIds(workspaceId);

  const templates = await prisma.template.findMany({
    where: {
      /*
       * 用 `AND` 数组而不是平铺字段：**两个 `OR` 键平铺会互相覆盖**（后写的赢），
       * 于是「公开池」那道 `OR` 会被关键词搜索的 `OR` 整个顶掉 ——
       * 搜索时公开池就会把**所有工作区里匹配关键词的私有模板**也列出来。
       * 这个 bug 是 E2E 抓到的：取消公开之后，那张模板仍出现在公开池的搜索结果里。
       */
      AND: [
        query.scope === TEMPLATE_SCOPE.PUBLIC
          ? { OR: [{ isOfficial: true }, { isPublic: true }] }
          : { isOfficial: false, workspaceId },
        ...(query.category ? [{ category: query.category }] : []),
        ...(query.keyword
          ? [
              {
                OR: [
                  { title: { contains: query.keyword, mode: 'insensitive' as const } },
                  { description: { contains: query.keyword, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy:
      query.scope === TEMPLATE_SCOPE.PUBLIC
        ? // 官方恒在前（publishedAt 为 null），其次按公开时间倒序
          [{ isOfficial: 'desc' }, { publishedAt: 'desc' }, { title: 'asc' }]
        : // 自己的模板按最近改动排：刚另存出来的应该在最前面
          [{ updatedAt: 'desc' }],
    take: query.scope === TEMPLATE_SCOPE.PUBLIC ? PUBLIC_POOL_LIMIT : undefined,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      questionCount: true,
      usageCount: true,
      isOfficial: true,
      isPublic: true,
      workspaceId: true,
      workspace: { select: { name: true } },
      // payload 一并取出来只为画骨架的题型（演示规模：一页十来张）
      payload: true,
    },
  });

  return templates.map((template) => toCardData(template, favoriteIds));
}

type SelectedTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
  usageCount: number;
  isOfficial: boolean;
  isPublic: boolean;
  workspaceId: string | null;
  workspace: { name: string } | null;
  payload: unknown;
};

function toCardData(
  template: SelectedTemplate,
  favoriteIds: ReadonlySet<string>,
): TemplateCardData {
  const parsed = questionnairePayloadSchema.safeParse(template.payload);

  return {
    id: template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    questionCount: template.questionCount,
    usageCount: template.usageCount,
    isOfficial: template.isOfficial,
    isPublic: template.isPublic,
    isFavorited: favoriteIds.has(template.id),
    /*
     * 来源只在「公开池」这一处被渲染（`showSource`），口径是：
     * 官方没有来源，其余一律给工作区名 —— 包括**自己工作区**的，
     * 那样池子里每张非官方卡都带来源，不会出现「有的有、有的没有」的怪异。
     * （「我的模板」Tab 不渲染来源行，所以这个值在那边用不上。）
     */
    workspaceName: template.isOfficial ? null : (template.workspace?.name ?? null),
    previewTypes: parsed.success
      ? parsed.data.questions.slice(0, 4).map((question) => question.type)
      : [],
  };
}

/** 「我的模板」的数量（Tab 上的角标要有真数字） */
export function countWorkspaceTemplates(workspaceId: string) {
  return prisma.template.count({ where: { workspaceId, isOfficial: false } });
}

/** 本工作区已公开的模板数量（公开配额的分母） */
export function countWorkspacePublicTemplates(workspaceId: string) {
  return prisma.template.count({ where: { workspaceId, isOfficial: false, isPublic: true } });
}

/**
 * 公开池里是否存在「其他」分类的模板。
 *
 * 决定公开池那排分类胶囊要不要出现「其他」—— **空胶囊看起来像坏了**
 * （「我的模板」那边早有同一条教训：只列真有内容的分类）。一次 findFirst 就够。
 */
export async function hasOtherPublicTemplates() {
  const row = await prisma.template.findFirst({
    where: { isPublic: true, category: TEMPLATE_CATEGORY_OTHER },
    select: { id: true },
  });

  return row !== null;
}

/** 本工作区收藏过的模板 id 集合（一次查出来，避免每张卡各查一次） */
async function listWorkspaceFavoriteIds(workspaceId: string): Promise<Set<string>> {
  const rows = await prisma.templateFavorite.findMany({
    where: { workspaceId },
    select: { templateId: true },
  });

  return new Set(rows.map((row) => row.templateId));
}

/**
 * 「我的模板」Tab 顶部的「已收藏」分组。
 *
 * 收藏的是**任意可见的模板**（官方 / 公开 / 自己的），但列表要再过一道可见性：
 * 别人公开后又取消公开的模板，收藏还在库里（重新公开就回来），**但此刻不该显示** ——
 * 否则会出现一张点开什么都没有的卡。
 */
export async function listFavoriteTemplates(workspaceId: string): Promise<TemplateCardData[]> {
  const rows = await prisma.templateFavorite.findMany({
    where: { workspaceId, template: readableBy(workspaceId) },
    orderBy: { createdAt: 'desc' },
    select: {
      template: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          questionCount: true,
          usageCount: true,
          isOfficial: true,
          isPublic: true,
          workspaceId: true,
          workspace: { select: { name: true } },
          payload: true,
        },
      },
    },
  });

  const favoriteIds = new Set(rows.map((row) => row.template.id));

  return rows.map((row) => toCardData(row.template, favoriteIds));
}

/**
 * 收藏 / 取消收藏（工作区级标记）。
 *
 * - 收藏用 `upsert`：同一个请求重试两次不该撞唯一索引；
 * - 取消用 `deleteMany`：本来就没收藏时**静默成功**（幂等），不该抛 P2025。
 *
 * 调用方（action）负责校验「模板对该工作区可见」——这里只管写。
 */
export async function setTemplateFavorite(
  workspaceId: string,
  templateId: string,
  favorited: boolean,
) {
  if (favorited) {
    await prisma.templateFavorite.upsert({
      where: { templateId_workspaceId: { templateId, workspaceId } },
      create: { templateId, workspaceId },
      update: {},
    });
    return;
  }

  await prisma.templateFavorite.deleteMany({ where: { templateId, workspaceId } });
}

/**
 * 模板是否对这个工作区可见（收藏前的校验）。
 *
 * 只看「能不能读到」：官方 / 别人已公开的 / 本工作区自己的。
 * 不可见的 id（别人的私有模板、不存在的 id）一律返回 null —— 与「不存在」同一种待遇。
 */
export function findReadableTemplate(templateId: string, workspaceId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, ...readableBy(workspaceId) },
    select: { id: true, title: true },
  });
}

/**
 * 预览 / 编辑单个模板。
 *
 * 读的口径 = `readableBy`：官方、本工作区自己的、**以及别人已公开的** ——
 * 公开池里的模板要能被所有人预览。
 */
export async function getTemplateDetail(templateId: string, workspaceId: string) {
  const template = await prisma.template.findFirst({
    where: { id: templateId, ...readableBy(workspaceId) },
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

/**
 * 重命名 / 删除 / 公开前的归属校验：官方模板与别人的模板都不许动。
 *
 * select 带上公开门槛要用的字段（描述 / 题数 / 分类 / 当前公开状态），
 * 免得 action 里再补一次查询。
 */
export async function findEditableTemplate(templateId: string, workspaceId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, workspaceId, isOfficial: false },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      questionCount: true,
      isPublic: true,
    },
  });
}

/** 公开：写入描述与分类（弹层会在公开时就地补齐这两项），并打上公开时间 */
export function setTemplatePublic(input: {
  templateId: string;
  description: string;
  category: string;
}) {
  return prisma.template.update({
    where: { id: input.templateId },
    data: {
      description: input.description,
      category: input.category,
      isPublic: true,
      publishedAt: new Date(),
    },
  });
}

/** 取消公开：即刻从公开池消失（不可见的收藏留库，重新公开即回来） */
export function setTemplatePrivate(templateId: string) {
  return prisma.template.update({
    where: { id: templateId },
    data: { isPublic: false, publishedAt: null },
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
 * 取模板的题目结构（「使用此模板」时复制）。
 *
 * 库里存的是 Json，读出来必须**再校验一遍**：seed 或历史数据只要有一个字段对不上，
 * 后面 materialize 的时候就会在写库阶段炸掉，还不如在入口就拦住。
 *
 * **归属校验在这里一并做**（X2 收口）：此前只按 id 查 —— 加上公开池之后，
 * 「能用的模板」= 官方 / 别人已公开的 / 本工作区自己的，别的一律当作不存在。
 */
export async function getTemplatePayload(
  templateId: string,
  workspaceId: string,
): Promise<QuestionnairePayload | null> {
  const template = await prisma.template.findFirst({
    where: { id: templateId, ...readableBy(workspaceId) },
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
