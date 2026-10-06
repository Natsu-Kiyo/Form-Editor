'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, formatVersion } from '@/config/constants';
import { requireDraftQuestionnaire } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import { questionnairePayloadSchema } from '@/lib/questionnaire-structure';
import { writeQuestionnaireVersion } from '@/lib/questionnaire-version';

import { replaceStructure } from '../api/structure';

export type RollbackResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * 回滚到某个版本。
 *
 * 三条原则：
 * - **只有草稿能回滚**：已发布的结构是冻结的（历史答卷与统计口径都挂在它上面），
 *   改回去等于让已经收上来的数据对不上题目。
 * - **回滚不删任何历史版本**，而是**再写一条新版本**（label 记「回滚自 vN」）——
 *   设计稿 W11 的原话。这样「谁在什么时候把结构退回去了」本身也是可追溯的。
 * - 快照要先过 schema 再写库：它是 Json 列，历史上可能有结构不完整的行。
 */
export async function rollbackVersionAction(
  questionnaireId: string,
  versionId: string,
): Promise<RollbackResult> {
  const { user, questionnaire } = await requireDraftQuestionnaire(questionnaireId);

  const version = await prisma.questionnaireVersion.findFirst({
    where: { id: versionId, questionnaireId },
    select: { version: true, snapshot: true },
  });

  if (!version) return { ok: false, message: '这个版本不存在或不属于这份问卷' };

  const parsed = questionnairePayloadSchema.safeParse(version.snapshot);
  if (!parsed.success) {
    return { ok: false, message: '这个版本的结构不完整，无法回滚' };
  }

  await replaceStructure(questionnaireId, parsed.data);

  await writeQuestionnaireVersion({
    questionnaireId,
    label: `回滚自 ${formatVersion(version.version)}`,
    createdById: user.id,
    payload: parsed.data,
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.ROLLBACK,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
    detail: { from: formatVersion(version.version) },
  });

  revalidatePath(`/app/q/${questionnaireId}`, 'layout');

  return { ok: true, message: `已回滚到 ${formatVersion(version.version)}` };
}
