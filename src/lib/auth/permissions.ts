import 'server-only';

import type { Role } from '@/config/constants';
import { prisma } from '@/lib/db';

import { requireUser } from './dal';

/** 权限深浅：数值越大权限越高 */
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasAtLeastRole(role: Role, min: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** 当前用户在某工作区的成员关系；不在该工作区则为 null */
export function getMembership(workspaceId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

/**
 * 断言当前用户对某工作区至少有 `min` 权限，返回成员记录。
 *
 * 规则（见 AGENTS.md）：**权限一律在服务端判断**，前端只隐藏无权入口 ——
 * 不能让用户自己判断按钮能不能点，也绝不能靠「客户端没渲染这个按钮」当安全。
 * 所以每个写操作的 Server Action 第一行就是它。
 */
export async function requireMembership(workspaceId: string, min: Role = 'VIEWER') {
  const user = await requireUser();
  const membership = await getMembership(workspaceId, user.id);

  if (!membership || !hasAtLeastRole(membership.role as Role, min)) {
    throw new Error('FORBIDDEN');
  }

  return { user, membership };
}
