import 'server-only';

import { prisma } from '@/lib/db';

import {
  questionnairePayloadSchema,
  toJsonColumn,
  type QuestionnairePayload,
} from '../lib/payload';

export type TemplateSummary = {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
};

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
