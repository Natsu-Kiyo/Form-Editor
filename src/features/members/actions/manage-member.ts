'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, ROLE_LABEL, type Role } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

import { changeRoleSchema } from '../schemas';

/**
 * 改成员角色 / 移除成员。
 *
 * 两条共同的前提（缺一个就会漏一种越权）：
 * - 权限 **ADMIN**；
 * - **所有者的成员关系不可改也不可移除** —— 工作区所有者是 `Workspace.ownerId`，
 *   把他降级或踢出去会让工作区失去所有者。所有者想降级自己只有一条路：**转让**
 *   （R76：成员页自己那一行的角色下拉 → `transfer-ownership.ts`）。
 */
async function loadTarget(membershipId: string) {
  const { user, workspace } = await requireActiveWorkspace('ADMIN');

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: workspace.id },
    select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
  });

  if (!membership) throw new Error('NOT_FOUND');
  if (membership.role === 'OWNER') throw new Error('OWNER_LOCKED');

  return { actor: user, workspace, membership };
}

export async function changeMemberRoleAction(membershipId: string, role: string) {
  const parsed = changeRoleSchema.safeParse({ membershipId, role });
  if (!parsed.success) throw new Error('INVALID_INPUT');

  const { actor, workspace, membership } = await loadTarget(parsed.data.membershipId);

  if (membership.role === parsed.data.role) return;

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
}

export async function removeMemberAction(membershipId: string) {
  const { actor, workspace, membership } = await loadTarget(membershipId);

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
}
