'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, ROLE_LABEL, type Role } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

import { transferOwnershipSchema } from '../schemas';

export type TransferOwnershipResult = { ok: true } | { ok: false; message: string };

/**
 * 转让工作区所有权（仅所有者）。
 *
 * 一次动作改**三处**，而且必须在同一个事务里：`Workspace.ownerId`、
 * 继承人的成员角色、发起人自己的降级角色 —— 拆开做就会出现「工作区没有所有者」
 * 的中间态（`manage-member` 与 `leave-workspace` 都在拦这件事）。
 *
 * 三条服务端校验（界面上的下拉只是即时反馈，不是安全边界）：
 * - 发起人必须是当前所有者；
 * - **继承人必须是这个工作区的成员**（不能凭空指给一个工作区外的人）；
 * - **不能转让给自己**（那是一次空转，还会把所有者角色绕出来）。
 *
 * 日志记 `OWNER_TRANSFER`（一次动作、一条记录，第二行写清发起人降到了哪一档）——
 * 与「调整成员角色」分开：那是一条 membership 的变化，这是工作区归属的变更。
 */
export async function transferOwnershipAction(input: unknown): Promise<TransferOwnershipResult> {
  const { user, workspace } = await requireActiveWorkspace('OWNER');

  const parsed = transferOwnershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '转让信息不完整' };
  }

  const { nextOwnerUserId, selfRole } = parsed.data;

  if (nextOwnerUserId === user.id) {
    return { ok: false, message: '不能把工作区转让给自己' };
  }

  const next = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: nextOwnerUserId } },
    select: { id: true, user: { select: { id: true, name: true, email: true } } },
  });

  if (!next) {
    return { ok: false, message: '这位成员不在当前工作区里，刷新后再试' };
  }

  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspace.id },
      data: { ownerId: next.user.id },
    }),
    prisma.membership.update({ where: { id: next.id }, data: { role: 'OWNER' } }),
    prisma.membership.update({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      data: { role: selfRole },
    }),
  ]);

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.OWNER_TRANSFER,
    targetType: 'MEMBER',
    targetId: next.user.id,
    targetName: next.user.name,
    detail: { email: next.user.email, selfRole: ROLE_LABEL[selfRole as Role] },
  });

  revalidatePath('/app/members');
  revalidatePath('/app', 'layout');

  return { ok: true };
}
