import 'server-only';

import {
  INVITATION_STATUS,
  ROLE_LABEL,
  type InvitationStatus,
  type Role,
} from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDisplayDate } from '@/utils/format';

/**
 * 成员与权限页（W09）要的全部数据。
 *
 * 与统计页同样的分工：**数字与文案都在服务端算好**再交给客户端组件；
 * 权限相关的判断（谁能改谁）不在这一层 —— 它属于 action，因为界面只是界面。
 */
export type MemberRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAtLabel: string;
};

export type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  token: string;
  /** 「邀请为『编辑者』· 2026-10-03 发出」 */
  summary: string;
  expiresAtLabel: string;
};

export type MembersPageData = {
  workspaceName: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  memberCount: number;
  /**
   * 「可编辑问卷」这张卡。
   *
   * 对所有者/管理员/编辑者，工作区里未归档的问卷都能编辑，所以是同一个数；
   * 查看者一个也编辑不了 —— 卡片标题会按角色换成「可查看问卷」，
   * 而不是拿一个自己无权解释的数字糊过去。
   */
  questionnaireCount: number;
  pendingCount: number;
};

export async function getMembersPageData(workspaceId: string): Promise<MembersPageData | null> {
  // 过期的邀请不该一直躺在「待接受」里等人撤回 —— 与问卷「到期懒截止」同一条思路：
  // 读取时顺手落库，列表、计数、日志三处说的才是同一个事实
  await prisma.invitation.updateMany({
    where: { workspaceId, status: INVITATION_STATUS.PENDING, expiresAt: { lt: new Date() } },
    data: { status: INVITATION_STATUS.EXPIRED },
  });

  const [workspace, memberships, invitations, questionnaireCount] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.membership.findMany({
      where: { workspaceId },
      // 按角色深浅排（所有者在前），同角色按加入时间 —— 与设计稿的列表一致
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.invitation.findMany({
      where: { workspaceId, status: INVITATION_STATUS.PENDING },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, token: true, createdAt: true, expiresAt: true },
    }),
    prisma.questionnaire.count({ where: { workspaceId, archivedAt: null } }),
  ]);

  if (!workspace) return null;

  return {
    workspaceName: workspace.name,
    memberCount: memberships.length,
    questionnaireCount,
    pendingCount: invitations.length,
    members: memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role as Role,
      joinedAtLabel: formatDisplayDate(membership.createdAt),
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as Role,
      token: invitation.token,
      summary: `邀请为「${ROLE_LABEL[invitation.role as Role]}」· ${formatDisplayDate(invitation.createdAt)} 发出`,
      expiresAtLabel: formatDisplayDate(invitation.expiresAt),
    })),
  };
}

/**
 * 邀请链接对应的那一份邀请（接受页用）。
 *
 * **凭据就是 token 本身**：本项目没有邮件通道，链接由管理员手动转发 ——
 * 与「分享问卷链接」是同一种信任模型，因此这里不做「必须与受邀邮箱同一个人」的限制，
 * 否则在没有邮件的情况下这个功能根本无法使用。真正部署时该加这条（已记进遗留）。
 */
export async function getInvitationByToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      role: true,
      email: true,
      expiresAt: true,
      workspace: { select: { id: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation) return null;

  // 过期判断是**懒**的（没有定时任务）：读取时算一次，调用方按这个结果分支
  const expired =
    invitation.status === INVITATION_STATUS.PENDING && invitation.expiresAt < new Date();

  return {
    id: invitation.id,
    workspaceId: invitation.workspace.id,
    workspaceName: invitation.workspace.name,
    role: invitation.role as Role,
    email: invitation.email,
    invitedByName: invitation.invitedBy?.name ?? '管理员',
    expiresAtLabel: formatDisplayDate(invitation.expiresAt),
    status: (expired ? INVITATION_STATUS.EXPIRED : invitation.status) as InvitationStatus,
  };
}
