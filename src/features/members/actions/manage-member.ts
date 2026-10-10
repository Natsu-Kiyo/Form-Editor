'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, ROLE_LABEL, type Role } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

import { changeRoleSchema } from '../schemas';

export type MemberActionResult = { ok: true } | { ok: false; message: string };

/**
 * 改成员角色 / 移除成员。
 *
 * 两条共同的前提（缺一个就会漏一种越权）：
 * - 权限 **ADMIN**；
 * - **所有者的成员关系不可改也不可移除** —— 工作区所有者是 `Workspace.ownerId`，
 *   把他降级或踢出去会让工作区失去所有者。所有者想降级自己只有一条路：**转让**
 *   （R76：成员页自己那一行的角色下拉 → `transfer-ownership.ts`）。
 *
 * 「目标不存在」与「目标是所有者」都是**用户可达的预期失败**（别人刚把他移出、
 * 两个管理员同时点移除、页面开着没刷新），所以一律**返回**而不是抛：
 * 抛出去会让调用侧那句 `setPendingId(null)` 被跳过（那一行永远转圈），
 * 用户也拿不到任何说明。同目录的 `transfer-ownership.ts` 一直是这么写的。
 */
const NOT_IN_WORKSPACE = '这位成员已不在当前工作区，刷新后再试';
const OWNER_LOCKED = '所有者不能被降级或移除；要换人请用「转让所有权」';

async function loadTarget(membershipId: string) {
  const { user, workspace } = await requireActiveWorkspace('ADMIN');

  // 查不到 = 不属于本工作区、或已经被移除 / 被改过：对外是同一件事，
  // 「猜 id」也不该从错误信息里区分出「存在但无权」
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: workspace.id },
    select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
  });

  return { actor: user, workspace, membership };
}

export async function changeMemberRoleAction(
  membershipId: string,
  role: string,
): Promise<MemberActionResult> {
  const parsed = changeRoleSchema.safeParse({ membershipId, role });
  if (!parsed.success) return { ok: false, message: '角色参数不合法' };

  const { actor, workspace, membership } = await loadTarget(parsed.data.membershipId);
  if (!membership) return { ok: false, message: NOT_IN_WORKSPACE };
  if (membership.role === 'OWNER') return { ok: false, message: OWNER_LOCKED };

  // 已经是这一档：不写库、也不记日志 —— 一次空转不该在审计里留一行
  if (membership.role === parsed.data.role) return { ok: true };

  await prisma.membership.update({
    where: { id: membership.id },
    data: { role: parsed.data.role },
  });

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: actor.id,
    type: OPERATION_TYPE.MEMBER_ROLE,
    targetType: 'MEMBER',
    targetId: membership.user.id,
    targetName: membership.user.name,
    detail: {
      email: membership.user.email,
      from: ROLE_LABEL[membership.role as Role],
      to: ROLE_LABEL[parsed.data.role],
    },
  });

  revalidatePath('/app/members');

  return { ok: true };
}

export async function removeMemberAction(membershipId: string): Promise<MemberActionResult> {
  const { actor, workspace, membership } = await loadTarget(membershipId);
  if (!membership) return { ok: false, message: NOT_IN_WORKSPACE };
  if (membership.role === 'OWNER') return { ok: false, message: OWNER_LOCKED };

  await prisma.membership.delete({ where: { id: membership.id } });

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: actor.id,
    type: OPERATION_TYPE.MEMBER_REMOVE,
    targetType: 'MEMBER',
    targetId: membership.user.id,
    targetName: membership.user.name,
    detail: { email: membership.user.email, role: ROLE_LABEL[membership.role as Role] },
  });

  revalidatePath('/app/members');

  return { ok: true };
}
