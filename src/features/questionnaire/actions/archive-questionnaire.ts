'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE } from '@/config/constants';
import { setQuestionnaireStatus } from '../api/questionnaires';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { writeOperationLog } from '@/lib/operation-log';

/** 归档：从列表折叠起来，数据只读保留 */
export async function archiveQuestionnaireAction(questionnaireId: string) {
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'ADMIN');

  await setQuestionnaireStatus(questionnaireId, {
    status: 'ARCHIVED',
    archivedAt: new Date(),
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.ARCHIVE,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
  });

  revalidatePath('/app');
  revalidatePath('/app/logs');
}

/**
 * 恢复归档。
 *
 * **不回到「回收中」**：归档期间公开链接已经失效，静默恢复回收会让「链接为什么又能填了」
 * 变成一个没人能解释的现象。所以曾经发布过的回到「已截止」（由用户到发布设置里显式重新开启），
 * 从未发布过的回到草稿。
 */
export async function restoreQuestionnaireAction(questionnaireId: string) {
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'ADMIN');

  await setQuestionnaireStatus(questionnaireId, {
    status: questionnaire.publishedAt ? 'CLOSED' : 'DRAFT',
    archivedAt: null,
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.RESTORE,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
    detail: { status: questionnaire.publishedAt ? '已截止' : '草稿' },
  });

  revalidatePath('/app');
  revalidatePath('/app/logs');
}
