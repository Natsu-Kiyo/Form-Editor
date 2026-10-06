import 'server-only';

import { prisma } from '@/lib/db';

/**
 * P09「我的」页要用的工作区计数。
 *
 * 成员数从 `getWorkspacesForUser` 的结果里取（已经带了 `memberCount`），
 * 只有问卷数需要单独查一次 —— 所以这里只补这一项，不把成员也再数一遍。
 */
export function countWorkspaceQuestionnaires(workspaceId: string) {
  return prisma.questionnaire.count({ where: { workspaceId } });
}
