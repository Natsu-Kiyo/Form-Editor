import 'server-only';

import { cache } from 'react';

import type { Role } from '@/config/constants';
import { prisma } from '@/lib/db';

import { requireMembership } from './permissions';

/**
 * 「这份问卷我能不能动」的断言。
 *
 * 为什么在 `lib/auth` 而不是某个 feature 的 `api/`：**questionnaire 与 editor 两个 feature
 * 都要用它**（前者管生命周期，后者管题目结构），而 features 之间禁止互相导入。
 * 判断标准与 `active-workspace.ts` 一致：凡是被多个 feature 共用的**鉴权断言**，一律收在 shared 层。
 *
 * 这里是**两道断言**，少任何一道都会漏一种越权：
 * 1. 按 id 查出它属于哪个工作区 —— 不能信调用方传进来的 workspaceId（可以伪造）
 * 2. 按那个工作区断言成员关系与角色 —— 同工作区的查看者也不能改别人负责的问卷
 */
export const requireQuestionnaireAccess = cache(
  async (questionnaireId: string, min: Role = 'EDITOR') => {
    const row = await prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        intro: true,
        status: true,
        publishedAt: true,
        archivedAt: true,
      },
    });

    // 不存在时同样抛 NOT_FOUND：不能让「猜 id」从错误类型里区分出「存在但没权限」
    if (!row) throw new Error('NOT_FOUND');

    const { user, membership } = await requireMembership(row.workspaceId, min);

    // 带出角色：编辑器要据此决定「只读」的具体理由（无权限 vs 已冻结）
    return { user, role: membership.role as Role, questionnaire: row };
  },
);

/**
 * 结构改动的额外前置：**只有草稿能改题目结构**。
 *
 * 这是全站最硬的一条业务规则（docs/PLAN.md §9.1 第 1 条「发布即冻结」）：
 * 发布后改结构会让历史答卷与统计口径对不上。
 * 界面会把编辑器切成只读，但界面只是界面 —— 服务端必须自己再拦一次。
 */
export async function requireDraftQuestionnaire(questionnaireId: string, min: Role = 'EDITOR') {
  const result = await requireQuestionnaireAccess(questionnaireId, min);

  if (result.questionnaire.status !== 'DRAFT') {
    throw new Error('STRUCTURE_FROZEN');
  }

  return result;
}
