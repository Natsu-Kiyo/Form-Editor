import 'server-only';

import {
  INVITATION_RETENTION_DAYS,
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

  /*
   * 顺手清掉**已经结束**的历史邀请（已过期 / 已撤回 / 已接受）。
   *
   * 为什么必须在这里做、而不是只留一个定时脚本：这个项目没有常驻任务，而
   * 「标成 EXPIRED」与「把它删掉」是两件事 —— 前者让列表不再显示它，后者才让库里不再攒它。
   * 只做前者的话，就留下一批**页面上看不见、也没有入口能删**的残渣（用户实测报过）。
   *
   * 写在读取路径上是同一个取舍：没事可做时它们都是空操作，而这条路径只有管理员打开成员页才跑。
   * 要清比保留期更久的历史，另有 `pnpm db:prune-invitations` 交给部署时的定时任务。
   */
  await pruneInvitations();

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
 * 清掉**已经结束**的历史邀请（已过期 / 已撤回 / 已接受），保留 `INVITATION_RETENTION_DAYS` 天。
 *
 * 保留期的意义只是「留一段可追溯的时间」—— 真正的事件记录在操作日志里
 * （邀请写一条、撤回写一条），所以过了保留期就没有留着的理由。
 *
 * 判据用 `createdAt` 而不是「结束时刻」：模型上没有 `updatedAt`，而这三类状态的共同点是
 * **都已经死了**、都该清 —— 一条 40 天前发出、今天刚被撤回的邀请，同样没有留的必要。
 * （副作用：**撤回不会让一行提前可清**，它的可清时刻始终是「发出 + 保留期」。）
 */
export async function pruneInvitations() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - INVITATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const { count } = await prisma.invitation.deleteMany({
    where: {
      /*
       * 两个条件是必须分开写的 —— 第二个是**这条脚本存在的理由**。
       *
       * 成员页那条路径会先「懒过期」（把过期的 PENDING 标成 EXPIRED）再清理，所以那边
       * 一条 `status !== PENDING` 就够。但脚本单独跑时（也就是「没人打开过成员页」这种
       * 正是它要兜底的场景）那些行**还是 PENDING** —— 只用第一个条件的话，脚本会一条都删不掉，
       * 正好漏掉它唯一该管的那些。（这个漏洞是实测出来的：造一条已过期的邀请，单跑脚本删 0 条。）
       */
      OR: [
        { status: { not: INVITATION_STATUS.PENDING }, createdAt: { lt: cutoff } },
        { status: INVITATION_STATUS.PENDING, expiresAt: { lt: now } },
      ],
    },
  });

  return { deleted: count, cutoff };
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
