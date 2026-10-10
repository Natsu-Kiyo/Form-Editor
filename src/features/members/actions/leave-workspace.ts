'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, ROLE_LABEL, type Role } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { landAfterWorkspaceGone } from '@/lib/auth/workspace-lifecycle';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';

export type LeaveWorkspaceResult = { ok: true } | { ok: false; message: string };

/**
 * 退出工作区（任何非所有者成员，含管理员）。
 *
 * 数据上只是删掉自己那一条 `Membership`（全站鉴权都收敛在它上面，
 * `Membership` 的 `questionnaire` 级权限也是从它推出来的），但三件事要说清：
 * - **所有者不能退出**，只能「解散工作区」、或**先转让出去**（R76）—— 他走了
 *   工作区就没有 owner 了；转让入口在成员页自己那一行的角色下拉里；
 * - 日志记 `MEMBER_LEAVE`，与「被移除」分开：一个是自己走，一个是被请走；
 * - 收尾同解散：切到别的工作区（没有就补一个新的）—— 否则会落在
 *   `NO_WORKSPACE` 的异常页上；**导航交给调用方**（同 `dissolveWorkspaceAction`）。
 */
export async function leaveWorkspaceAction(): Promise<LeaveWorkspaceResult> {
  const { user, workspace } = await requireActiveWorkspace('VIEWER');

  if (workspace.role === 'OWNER') {
    return { ok: false, message: '所有者不能退出工作区 —— 请用「解散工作区」' };
  }

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    select: { id: true },
  });

  if (!membership) return { ok: false, message: '你已经不在这个工作区里了' };

  await prisma.membership.delete({ where: { id: membership.id } });

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.MEMBER_LEAVE,
    targetType: 'MEMBER',
    targetId: user.id,
    targetName: user.name,
    detail: { email: user.email, role: ROLE_LABEL[workspace.role as Role] },
  });

  await landAfterWorkspaceGone(user);

  revalidatePath('/app/members');
  revalidatePath('/app', 'layout');

  return { ok: true };
}
