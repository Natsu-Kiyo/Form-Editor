'use server';

import { revalidatePath } from 'next/cache';

import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';

/**
 * 标记为无效 / 恢复有效。
 *
 * 四处刻意的处理：
 * - **只收 `responseId`**：这份答卷属于哪张问卷是服务端查出来的，不信调用方传进来的
 *   问卷 id（它可以是伪造的），然后按那张问卷自己的 workspace 断言 `EDITOR` ——
 *   `requireQuestionnaireAccess` 里已经是两道检查（查真实归属 + 断成员角色）。
 * - **原始记录一律保留**：标无效只改 `status`，明细里那份答卷还在，只是统计图表
 *   不再吃它（统计口径只算有效答卷）。这是设计稿 W07 里写明的行为 ——
 *   「标记后该答卷将从统计图表中排除，但原始记录保留」。
 * - **写下操作者与时间**（`invalidatedById` / `invalidatedAt`）：这个动作会改变
 *   已发布问卷的统计结果，属于「必须能查出是谁改的」那一类。
 * - 已经是目标状态时直接返回，不做无谓的写与审计字段覆盖。
 */
export async function setResponseValidityAction(input: {
  responseId: string;
  invalid: boolean;
  /** 标无效的原因（可选，会写进 invalidReason） */
  reason?: string;
}) {
  const response = await prisma.response.findUnique({
    where: { id: input.responseId },
    select: { id: true, questionnaireId: true, status: true },
  });

  if (!response) throw new Error('NOT_FOUND');

  const { user } = await requireQuestionnaireAccess(response.questionnaireId, 'EDITOR');

  if ((response.status === 'INVALID') === input.invalid) return;

  await prisma.response.update({
    where: { id: response.id },
    data: input.invalid
      ? {
          status: 'INVALID',
          invalidatedAt: new Date(),
          invalidatedById: user.id,
          invalidReason: input.reason?.trim() || null,
        }
      : { status: 'VALID', invalidatedAt: null, invalidatedById: null, invalidReason: null },
  });

  revalidatePath(`/app/q/${response.questionnaireId}/responses`);
  // 统计页必须立刻反映：标无效 = 从图表里排除，这是 M6 验收里明确写着的一条
  revalidatePath(`/app/q/${response.questionnaireId}/stats`);
}
