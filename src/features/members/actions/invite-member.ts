'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  INVITATION_EXPIRES_DAYS,
  INVITATION_STATUS,
  OPERATION_TYPE,
  ROLE_LABEL,
  type Role,
} from '@/config/constants';
import { env } from '@/config/env';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import type { FormState } from '@/types/form-state';

import { inviteMemberSchema } from '../schemas';
import type { MemberActionResult } from './manage-member';

/**
 * 邀请成员。
 *
 * 四条刻意的处理：
 * - 权限是 **ADMIN**（设计稿权限矩阵：邀请 / 移除成员 = 所有者 ● / 管理员 ● / 其余 —）。
 * - 已经是工作区成员时**直接拒绝并说明**：否则会生成一个「接受后会变成重复成员」的链接。
 * - 同一个邮箱已有待接受邀请时**刷新它**（换新 token、更新角色与有效期），而不是报「重复邀请」——
 *   管理员手滑退回来重发是常态，而报错会留下一条谁也点不动的旧链接。
 * - 链接由**服务端**拼好返回（`NEXT_PUBLIC_APP_URL` 只在服务端可读，见 AGENTS.md）。
 */
export type InviteMemberState = FormState & {
  /** 邀请生成后的完整链接，弹层直接拿它做「复制邀请链接」 */
  inviteLink?: string;
  invitedEmail?: string;
};

export async function inviteMemberAction(
  _prev: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const { user, workspace } = await requireActiveWorkspace('ADMIN');

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });

  const values = {
    email: String(formData.get('email') ?? ''),
    role: String(formData.get('role') ?? ''),
  };

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { email, role } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { memberships: { where: { workspaceId: workspace.id }, select: { id: true } } },
  });

  if (existingUser && existingUser.memberships.length > 0) {
    return { message: '该邮箱已经是这个工作区的成员', values };
  }

  const expiresAt = new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  const token = randomBytes(24).toString('base64url');

  const pending = await prisma.invitation.findFirst({
    where: { workspaceId: workspace.id, email, status: INVITATION_STATUS.PENDING },
    select: { id: true },
  });

  if (pending) {
    await prisma.invitation.update({
      where: { id: pending.id },
      data: { role, token, expiresAt, invitedById: user.id },
    });
  } else {
    await prisma.invitation.create({
      data: { workspaceId: workspace.id, email, role, token, expiresAt, invitedById: user.id },
    });
  }

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.INVITE,
    targetType: 'WORKSPACE',
    targetId: workspace.id,
    targetName: workspace.name,
    detail: { email, role: ROLE_LABEL[role as Role] },
  });

  revalidatePath('/app/members');

  return {
    success: `邀请已生成：${email}（${ROLE_LABEL[role as Role]}）`,
    values: { email, role },
    invitedEmail: email,
    inviteLink: `${appOrigin()}/invite/${token}`,
  };
}

/** 撤回一条待接受的邀请。失败一律**返回**（理由见 `manage-member.ts` 顶部的说明） */
export async function revokeInvitationAction(invitationId: string): Promise<MemberActionResult> {
  const { user, workspace } = await requireActiveWorkspace('ADMIN');

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, workspaceId: workspace.id, status: INVITATION_STATUS.PENDING },
    select: { id: true, email: true },
  });

  // 不属于本工作区、或已经不是「待接受」的，一律当不存在：撤回一条已接受的邀请没有意义，
  // 而「猜 id」不该从错误信息里区分出「存在但无权」
  if (!invitation)
    return { ok: false, message: '这条邀请已不在了（可能已被接受或撤回），刷新后再试' };

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: INVITATION_STATUS.REVOKED },
  });

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.INVITE_REVOKE,
    targetType: 'WORKSPACE',
    targetId: workspace.id,
    targetName: workspace.name,
    detail: { email: invitation.email },
  });

  revalidatePath('/app/members');

  return { ok: true };
}

export type InvitationTokenResult = { ok: true; token: string } | { ok: false; message: string };

/**
 * 取一条待接受邀请的 token —— **只有管理员能调**（审查 #1）。
 *
 * 邀请链接是凭据：拿到它就能以受邀邮箱接受邀请，而注册不验证邮箱，
 * 所以「链接 + 受邀邮箱」足以让一个人把自己变成邀请里指定的那个角色。
 * 在这之前，token 跟着成员页的列表一起下发给所有能打开该页的人（最低是查看者）。
 *
 * 现在它**不进列表**（`getMembersPageData` 的 select 里没有这一列），
 * 只在管理员点「复制链接」的这一刻单独取一次。列表里连受邀邮箱都不再给查看者。
 */
export async function getInvitationTokenAction(
  invitationId: string,
): Promise<InvitationTokenResult> {
  const { workspace } = await requireActiveWorkspace('ADMIN');

  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      workspaceId: workspace.id,
      status: INVITATION_STATUS.PENDING,
      // 过期的链接不该还能复制出来：对方点开只会看到「已失效」
      expiresAt: { gt: new Date() },
    },
    select: { token: true },
  });

  // 不属于本工作区、已失效、已撤回的一律当不存在 —— 与撤回 action 同一套口径
  if (!invitation) {
    return { ok: false, message: '这条邀请已不在了（可能已被接受或撤回），刷新后再试' };
  }

  return { ok: true, token: invitation.token };
}

/**
 * 邀请链接的站点前缀。只在服务端取 —— 客户端组件拿不到这个变量（见 AGENTS.md）。
 *
 * 经 `@/config/env` 读、而不是直接读 `process.env`：那里有一档「没显式配置就取平台域名」
 * 的回退（部署到 Vercel 时不必先知道域名）。绕过它的话，链接会拼成一个**空前缀**。
 */
function appOrigin() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
}
