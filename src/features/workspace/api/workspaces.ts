import 'server-only';

import { randomBytes } from 'node:crypto';

import type { Role } from '@/config/constants';
import { prisma } from '@/lib/db';

export type WorkspaceSummary = {
  id: string;
  name: string;
  /** 当前用户在这个工作区里的角色 */
  role: Role;
  memberCount: number;
};

/**
 * 当前用户可见的全部工作区（附带自己的角色与成员数）。
 *
 * 只查 membership 而不是 workspace —— 「可见」的定义就是「我是成员」，
 * 从成员关系出发天然不会漏掉权限过滤。
 */
export async function getWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          _count: { select: { memberships: true } },
        },
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    role: membership.role as Role,
    memberCount: membership.workspace._count.memberships,
  }));
}

/** 新建工作区：建工作区的同时把自己加成所有者，两件事必须同一个事务 */
export async function createWorkspace(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        slug: `ws-${randomBytes(4).toString('hex')}`,
        ownerId: userId,
      },
    });

    await tx.membership.create({
      data: { workspaceId: workspace.id, userId, role: 'OWNER' },
    });

    return workspace;
  });
}
