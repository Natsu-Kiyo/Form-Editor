import 'server-only';

import type { Role } from '@/config/constants';
import { requireMembership } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';

import { getQuestionnaireInWorkspace } from '../api/questionnaires';

/**
 * 断言当前用户对某份问卷至少有 `min` 权限，并返回该问卷。
 *
 * 这是**两道断言而不是一道**：先按 id 取到它属于哪个工作区，
 * 再按那个工作区断言成员关系。少任何一道都会出现一种越权 ——
 * 只信前端传来的 workspaceId（可以伪造），或者只断言工作区而不校验问卷归属。
 *
 * 顺带也让「问卷必须属于该工作区」成为天然条件：传别人的问卷 id 会直接 NOT_FOUND。
 */
export async function requireQuestionnaireAccess(questionnaireId: string, min: Role = 'EDITOR') {
  const owner = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { workspaceId: true },
  });
  if (!owner) throw new Error('NOT_FOUND');

  const { user } = await requireMembership(owner.workspaceId, min);

  const questionnaire = await getQuestionnaireInWorkspace(questionnaireId, owner.workspaceId);
  if (!questionnaire) throw new Error('NOT_FOUND');

  return { user, questionnaire };
}
