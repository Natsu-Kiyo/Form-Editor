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

export type CopyQuestionnaireResult = { ok: true } | { ok: false; message: string };

/**
 * 复制一份问卷。
 *
 * 「源问卷已不在」是用户可达的预期失败（另一个人刚删了它、页面开着没刷新），
 * 所以**返回**而不是抛 —— 抛出去调用侧只会卡住、且不说明原因（理由同 `manage-member.ts`）。
 */
export async function copyQuestionnaireAction(
  questionnaireId: string,
): Promise<CopyQuestionnaireResult> {
  const source = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { workspaceId: true, ownerId: true, title: true },
  });
  if (!source) return { ok: false, message: '这份问卷已不存在，刷新后再试' };

  await requireMembership(source.workspaceId, 'EDITOR');

  const data = await getQuestionnairePayload(questionnaireId);
  if (!data) return { ok: false, message: '读不到这份问卷的结构（可能刚被删除），刷新后再试' };

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

  return { ok: true };
}
