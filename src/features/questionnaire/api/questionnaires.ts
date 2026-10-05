import 'server-only';

import { randomBytes } from 'node:crypto';

import type { QuestionnaireStatus } from '@/config/constants';
import { prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';

import type { QuestionnairePayload } from '@/lib/questionnaire-structure';

/** 列表筛选：`ALL` 刻意**不含已归档** —— 归档的语义就是「从列表折叠起来」 */
export type QuestionnaireFilter = QuestionnaireStatus | 'ALL';

/** 排序。计划书只写了「最近更新 / 最新 / 最长」，这里按「最新创建 / 最久未更新」落地 */
export type QuestionnaireSort = 'UPDATED' | 'CREATED' | 'STALE';

export type QuestionnaireCard = {
  id: string;
  title: string;
  intro: string | null;
  status: QuestionnaireStatus;
  questionCount: number;
  /** 有效答卷数（不含被作废的） */
  responseCount: number;
  responseLimit: number | null;
};

export type QuestionnaireSummary = {
  total: number;
  draft: number;
  published: number;
  paused: number;
  closed: number;
  archived: number;
  validResponses: number;
  createdThisWeek: number;
};

function randomSlug() {
  // 公开作答链接里的短标识。随机即可 —— 它不该被猜出来，也不承担语义
  return `q${randomBytes(8).toString('hex')}`;
}

const SORT_ORDER: Record<QuestionnaireSort, Parameters<typeof prisma.questionnaire.findMany>[0]> = {
  UPDATED: { orderBy: { updatedAt: 'desc' } },
  CREATED: { orderBy: { createdAt: 'desc' } },
  STALE: { orderBy: { updatedAt: 'asc' } },
};

/**
 * 列表查询。
 *
 * 答卷数单独用 `groupBy` 查一次，而不是把 `responses` 关系整个带出来 ——
 * 关系带出来会把每一份答卷的行都读进内存，几百份就把列表拖垮了；
 * 而且统计口径要的是「有效答卷」，`_count` 没法加过滤条件。
 */
export async function listQuestionnaires(input: {
  workspaceId: string;
  filter?: QuestionnaireFilter;
  keyword?: string;
  sort?: QuestionnaireSort;
}): Promise<QuestionnaireCard[]> {
  const { workspaceId, filter = 'ALL', keyword = '', sort = 'UPDATED' } = input;
  const trimmed = keyword.trim();

  const rows = await prisma.questionnaire.findMany({
    where: {
      workspaceId,
      ...(filter === 'ALL' ? { status: { not: 'ARCHIVED' } } : { status: filter }),
      ...(trimmed
        ? {
            OR: [
              { title: { contains: trimmed, mode: 'insensitive' } },
              { intro: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    ...SORT_ORDER[sort],
    select: {
      id: true,
      title: true,
      intro: true,
      status: true,
      responseLimit: true,
      _count: { select: { questions: true } },
    },
  });

  if (rows.length === 0) return [];

  const counts = await prisma.response.groupBy({
    by: ['questionnaireId'],
    where: {
      questionnaireId: { in: rows.map((row) => row.id) },
      status: 'VALID',
    },
    _count: { _all: true },
  });
  const countByQuestionnaire = new Map(counts.map((row) => [row.questionnaireId, row._count._all]));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    intro: row.intro,
    status: row.status as QuestionnaireStatus,
    questionCount: row._count.questions,
    responseCount: countByQuestionnaire.get(row.id) ?? 0,
    responseLimit: row.responseLimit,
  }));
}

/** 汇总卡的数字。全部口径与列表一致：不含已归档 */
export async function getQuestionnaireSummary(workspaceId: string): Promise<QuestionnaireSummary> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [groups, validResponses, createdThisWeek] = await Promise.all([
    prisma.questionnaire.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { _all: true },
    }),
    prisma.response.count({
      where: { status: 'VALID', questionnaire: { workspaceId } },
    }),
    prisma.questionnaire.count({ where: { workspaceId, createdAt: { gte: weekAgo } } }),
  ]);

  const countByStatus = new Map(groups.map((group) => [group.status, group._count._all]));
  const archived = countByStatus.get('ARCHIVED') ?? 0;

  return {
    total: groups.reduce((sum, group) => sum + group._count._all, 0) - archived,
    draft: countByStatus.get('DRAFT') ?? 0,
    published: countByStatus.get('PUBLISHED') ?? 0,
    paused: countByStatus.get('PAUSED') ?? 0,
    closed: countByStatus.get('CLOSED') ?? 0,
    archived,
    validResponses,
    createdThisWeek,
  };
}

/** 把一份问卷的题目结构读成 payload（导出 JSON / 另存为模板 / 复制都用它） */
export async function getQuestionnairePayload(
  questionnaireId: string,
): Promise<{ title: string; intro: string | null; payload: QuestionnairePayload } | null> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      title: true,
      intro: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          type: true,
          title: true,
          description: true,
          required: true,
          shuffleOptions: true,
          pageIndex: true,
          config: true,
          options: { orderBy: { order: 'asc' }, select: { label: true } },
        },
      },
    },
  });

  if (!questionnaire) return null;

  return {
    title: questionnaire.title,
    intro: questionnaire.intro,
    payload: {
      formatVersion: 1,
      title: questionnaire.title,
      intro: questionnaire.intro,
      questions: questionnaire.questions.map((question) => ({
        type: question.type,
        title: question.title,
        description: question.description,
        required: question.required,
        shuffleOptions: question.shuffleOptions,
        pageIndex: question.pageIndex,
        config: (question.config ?? null) as Record<string, unknown> | null,
        options: question.options.map((option) => option.label),
      })),
    },
  };
}

/** 按 payload 建一份新问卷。空白创建传 `questions: []` 即可 */
export async function createQuestionnaireWithPayload(input: {
  workspaceId: string;
  ownerId: string;
  payload: QuestionnairePayload;
  /** 从模板创建时记下模板 id，用于累计使用次数 */
  templateId?: string;
}) {
  const { workspaceId, ownerId, payload } = input;

  return prisma.$transaction(async (tx) => {
    const questionnaire = await tx.questionnaire.create({
      data: {
        workspaceId,
        ownerId,
        title: payload.title,
        intro: payload.intro ?? null,
        slug: randomSlug(),
      },
    });

    for (const [index, question] of payload.questions.entries()) {
      await tx.question.create({
        data: {
          questionnaireId: questionnaire.id,
          type: question.type,
          title: question.title,
          description: question.description ?? null,
          required: question.required,
          shuffleOptions: question.shuffleOptions,
          order: index,
          pageIndex: question.pageIndex,
          config: toJsonColumn(question.config),
          options: question.options.length
            ? {
                create: question.options.map((label, optionIndex) => ({
                  label,
                  order: optionIndex,
                })),
              }
            : undefined,
        },
      });
    }

    if (input.templateId) {
      await tx.template.update({
        where: { id: input.templateId },
        data: { usageCount: { increment: 1 } },
      });
    }

    return questionnaire;
  });
}

/**
 * 用 payload **替换**某份问卷的题目结构（导入 JSON 用）。
 *
 * 只允许草稿：已发布的问卷题目结构是冻结的，这是全站最硬的一条规则
 * （见 docs/PLAN.md §9.1 第 1 条），导入也不能例外。
 */
export async function replaceQuestionnaireStructure(input: {
  questionnaireId: string;
  payload: QuestionnairePayload;
  title: string;
  intro: string | null;
}) {
  const { questionnaireId, payload, title, intro } = input;

  return prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { questionnaireId } });

    await tx.questionnaire.update({
      where: { id: questionnaireId },
      data: { title, intro },
    });

    for (const [index, question] of payload.questions.entries()) {
      await tx.question.create({
        data: {
          questionnaireId,
          type: question.type,
          title: question.title,
          description: question.description ?? null,
          required: question.required,
          shuffleOptions: question.shuffleOptions,
          order: index,
          pageIndex: question.pageIndex,
          config: toJsonColumn(question.config),
          options: question.options.length
            ? {
                create: question.options.map((label, optionIndex) => ({
                  label,
                  order: optionIndex,
                })),
              }
            : undefined,
        },
      });
    }

    return tx.questionnaire.findUnique({ where: { id: questionnaireId } });
  });
}

/** 归档 / 恢复 / 删除共用的「取一份问卷并校验它属于该工作区」 */
export async function getQuestionnaireInWorkspace(questionnaireId: string, workspaceId: string) {
  return prisma.questionnaire.findFirst({
    where: { id: questionnaireId, workspaceId },
    select: {
      id: true,
      title: true,
      intro: true,
      status: true,
      publishedAt: true,
      archivedAt: true,
      workspaceId: true,
    },
  });
}

export function setQuestionnaireStatus(
  questionnaireId: string,
  data: { status: QuestionnaireStatus; archivedAt: Date | null },
) {
  return prisma.questionnaire.update({ where: { id: questionnaireId }, data });
}

export function deleteQuestionnaire(questionnaireId: string) {
  return prisma.questionnaire.delete({ where: { id: questionnaireId } });
}

export function renameQuestionnaire(questionnaireId: string, title: string) {
  return prisma.questionnaire.update({ where: { id: questionnaireId }, data: { title } });
}
