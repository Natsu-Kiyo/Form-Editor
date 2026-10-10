import 'server-only';

import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/db';

import { setActiveWorkspace } from './active-workspace';

/**
 * 工作区的「生」与「走」。
 *
 * 这个文件回答两个只有这里该回答的问题：
 * - 新工作区的 URL 标识怎么生成（`randomWorkspaceSlug`）—— 注册与「无工作区兜底」共用一份；
 * - **一个人离开一个工作区之后落在哪**（`landAfterWorkspaceGone`）。
 *
 * 为什么不放在 `features/`：退出与解散分属两个 action，但「落地」是同一件事，
 * 而 features 之间禁止互相导入 —— 与会话状态有关的收尾就该放 `lib/auth`。
 */

/** 工作区 slug。目前只用于唯一标识，不进 URL（切换工作区靠 Cookie），所以随机即可 */
export function randomWorkspaceSlug() {
  return `ws-${randomBytes(4).toString('hex')}`;
}

/**
 * 退出 / 解散之后把会话安顿好 —— 不这么做，用户会撞上 `NO_WORKSPACE`
 * 的异常页（`requireActiveWorkspace` 在「一个工作区都没有」时直接抛错，
 * 而全站没有 `error.tsx` 兜它）。
 *
 * 两步：
 * 1. 还有别的工作区 → 切到最早的那个（与 `requireActiveWorkspace` 的回落口径一致）；
 * 2. 一个都不剩 → **补一个新的**（与注册同款）。这不是"贴心地又给一个"，
 *    而是这个产品里「没有工作区」是一个到不了的状态：问卷、成员、日志全挂在
 *    工作区下，没有它连侧栏都渲染不出来。
 */
export async function landAfterWorkspaceGone(actor: { id: string; name: string }) {
  const next = await prisma.membership.findFirst({
    where: { userId: actor.id },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  });

  if (next) {
    await setActiveWorkspace(next.workspaceId);
    return;
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        name: `${actor.name} 的工作区`,
        slug: randomWorkspaceSlug(),
        ownerId: actor.id,
      },
    });

    await tx.membership.create({
      data: { workspaceId: created.id, userId: actor.id, role: 'OWNER' },
    });

    return created;
  });

  await setActiveWorkspace(workspace.id);
}
