'use server';

import { revalidatePath } from 'next/cache';

import { INVITATION_STATUS, OPERATION_TYPE, ROLE_LABEL, type Role } from '@/config/constants';
import { requireUser } from '@/lib/auth/dal';
import { setActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import type { FormState } from '@/types/form-state';

import { getInvitationByToken } from '../api/members';

/**
 * 接受邀请。
 *
 * **它不能要求 `requireMembership`** —— 接受邀请的人此刻还不是这个工作区的成员，
 * 凭据就是链接里的 token（没有邮件通道，链接由管理员手动转发）。
 * 这也是唯一一处「先看 token、再写成员关系」的入口，所以三道检查一个都不能少：
 * 邀请仍是待接受、未过期、以及**已经加入过的话直接当已接受处理**（避免重复成员）。
 *
 * 接受之后把活跃工作区切过去：用户点这个链接的意图就是「进这个工作区」。
 */
export async function acceptInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get('token') ?? '');
  if (!token) return { message: '邀请链接不完整' };

  const user = await requireUser();

  const invitation = await getInvitationByToken(token);
  if (!invitation) return { message: '这份邀请不存在或已被删除' };

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    return { message: '这份邀请已被撤回，请让管理员重新邀请' };
  }

  if (invitation.status === INVITATION_STATUS.EXPIRED) {
    return { message: `这份邀请已于 ${invitation.expiresAtLabel} 过期，请让管理员重新邀请` };
  }

  const existing = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
    select: { id: true },
  });

  if (invitation.status === INVITATION_STATUS.ACCEPTED || existing) {
    await setActiveWorkspace(invitation.workspaceId);
    revalidatePath('/app');

    return { success: `你已经在「${invitation.workspaceName}」里了` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.create({
      data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: INVITATION_STATUS.ACCEPTED,
        acceptedAt: new Date(),
        acceptedById: user.id,
      },
    });
  });

  await writeOperationLog({
    workspaceId: invitation.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.MEMBER_JOIN,
    targetType: 'MEMBER',
    targetId: user.id,
    targetName: user.name,
    detail: { email: user.email, role: ROLE_LABEL[invitation.role as Role] },
  });

  await setActiveWorkspace(invitation.workspaceId);
  revalidatePath('/app');
  revalidatePath('/app/members');

  return { success: `已加入「${invitation.workspaceName}」` };
}
