'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';

import { requireQuestionnaireAccess } from '../lib/access';

/**
 * 删除问卷。
 *
 * 题目、选项、答卷、作答值都在数据库上挂了级联删除，所以这里一条 delete 就够 ——
 * 靠 schema 的 `onDelete: Cascade` 而不是在代码里逐个表删，才不会漏。
 *
 * 界面侧必须先过二次确认弹层（会显示答卷份数），这是设计稿明确要求的危险操作。
 */
export async function deleteQuestionnaireAction(questionnaireId: string) {
  await requireQuestionnaireAccess(questionnaireId, 'ADMIN');

  await prisma.questionnaire.delete({ where: { id: questionnaireId } });

  revalidatePath('/app');
}
