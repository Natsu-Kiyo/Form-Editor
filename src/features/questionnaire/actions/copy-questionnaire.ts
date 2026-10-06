'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE } from '@/config/constants';
import { requireMembership } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

import { getQuestionnairePayload } from '@/lib/questionnaire-snapshot';

import { createQuestionnaireWithPayload } from '../api/questionnaires';
import type { QuestionnairePayload } from '@/lib/questionnaire-structure';

/** 副本标题的规则：加后缀而不是「副本 2 / 副本 3」，避免同一份问卷反复复制后成为一串数字 */
const COPY_SUFFIX = '（副本）';

export async function copyQuestionnaireAction(questionnaireId: string) {
  const source = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { workspaceId: true, ownerId: true, title: true },
  });
  if (!source) throw new Error('NOT_FOUND');

  await requireMembership(source.workspaceId, 'EDITOR');

  const data = await getQuestionnairePayload(questionnaireId);
  if (!data) throw new Error('NOT_FOUND');

  const payload: QuestionnairePayload = {
    ...data.payload,
    title: `${source.title}${COPY_SUFFIX}`.slice(0, 80),
  };

  const copy = await createQuestionnaireWithPayload({
    workspaceId: source.workspaceId,
    ownerId: source.ownerId,
    payload,
  });

  await writeOperationLog({
    workspaceId: source.workspaceId,
    actorId: source.ownerId,
    type: OPERATION_TYPE.COPY,
    targetType: 'QUESTIONNAIRE',
    // 记**源问卷**：日志的句子是「复制了问卷 X」，X 是那份被复制的
    targetId: questionnaireId,
    targetName: source.title,
    detail: { copyId: copy.id, copyTitle: payload.title },
  });

  revalidatePath('/app');
  revalidatePath('/app/logs');
}
