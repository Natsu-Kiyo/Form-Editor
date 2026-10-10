'use server';

import { revalidatePath } from 'next/cache';

import { CLOSE_REASON, OPERATION_TYPE, type OperationType } from '@/config/constants';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

import { resolveCollectionTransition, type CollectionAction } from '../lib/transitions';
import { collectionActionSchema } from '../schemas';

export type CollectionActionResult = { ok: true; message: string } | { ok: false; message: string };

const ACTION_LABEL: Record<CollectionAction, string> = {
  PUBLISH: '发布',
  PAUSE: '暂停回收',
  RESUME: '恢复回收',
  CLOSE: '截止回收',
};

const OPERATION_BY_ACTION: Record<CollectionAction, OperationType> = {
  PUBLISH: OPERATION_TYPE.PUBLISH,
  PAUSE: OPERATION_TYPE.PAUSE,
  RESUME: OPERATION_TYPE.RESUME,
  CLOSE: OPERATION_TYPE.CLOSE,
};

/**
 * 回收开关的三种动作（暂停 / 恢复 / 截止）。
 *
 * 允许哪些迁移由 `lib/transitions.ts` 这个纯函数判断 —— 界面按钮的可用性也读同一份规则，
 * 所以不会出现「按钮点得动但服务端拒绝」。发布（DRAFT → PUBLISHED）不在这里：
 * 它要带上发布设置的整套校验，走 `publishQuestionnaireAction`。
 */
export async function changeCollectionStatusAction(
  questionnaireId: string,
  requestedAction: CollectionAction,
): Promise<CollectionActionResult> {
  /*
   * 入参校验放最前面：Server Action 的参数是**客户端可控的入参**，
   * 而 `CollectionAction` 这个联合类型编译完就没了 —— 伪造的动作名会让状态机与下面两张
   * 文案表都查不到值（`lib/transitions.ts` 那边也补了 default 兜底，两层都要有）。
   * 顺序沿用项目约定：zod → 权限断言 → 落库。
   */
  const parsedAction = collectionActionSchema.safeParse(requestedAction);
  if (!parsedAction.success) return { ok: false, message: '不支持的操作' };

  const action = parsedAction.data;

  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'ADMIN');

  const row = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { endsAt: true },
  });
  if (!row) return { ok: false, message: '问卷不存在' };

  const now = new Date();
  const transition = resolveCollectionTransition(questionnaire.status, action, {
    // 「过了结束时间就不能恢复回收」：恢复完下一次访问又会自动截止，
    // 用户只会看到「点了恢复，链接还是不能填」
    pastEndTime: row.endsAt !== null && row.endsAt.getTime() <= now.getTime(),
  });

  if (!transition.ok) return transition;

  await prisma.questionnaire.update({
    where: { id: questionnaireId },
    data: {
      status: transition.next,
      // 截止要记下时间与原因；恢复要把它们清掉，否则界面上会同时显示
      //「回收中」和一个截止时间，自相矛盾
      ...(action === 'CLOSE' ? { closedAt: now, closeReason: CLOSE_REASON.MANUAL } : {}),
      ...(action === 'RESUME' ? { closedAt: null, closeReason: null } : {}),
    },
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_BY_ACTION[action],
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
  });

  revalidatePath('/app');
  revalidatePath(`/app/q/${questionnaireId}`, 'layout');

  return { ok: true, message: `${ACTION_LABEL[action]}成功` };
}
