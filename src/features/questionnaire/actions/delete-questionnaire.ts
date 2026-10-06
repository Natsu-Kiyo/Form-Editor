'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE } from '@/config/constants';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

/**
 * 删除问卷。
 *
 * 题目、选项、答卷、作答值都在数据库上挂了级联删除，所以这里一条 delete 就够 ——
 * 靠 schema 的 `onDelete: Cascade` 而不是在代码里逐个表删，才不会漏。
 *
 * 界面侧必须先过二次确认弹层（会显示答卷份数），这是设计稿明确要求的危险操作。
 */
export async function deleteQuestionnaireAction(questionnaireId: string) {
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'ADMIN');

  // 删之前先把「删的是什么」数出来：删完标题与份数就都查不到了，
  // 而这两样正是事后唯一能追回的线索
  const responses = await prisma.response.count({ where: { questionnaireId } });

  await prisma.questionnaire.delete({ where: { id: questionnaireId } });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.DELETE,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
    detail: { responses },
  });

  revalidatePath('/app');
  revalidatePath('/app/logs');
}
