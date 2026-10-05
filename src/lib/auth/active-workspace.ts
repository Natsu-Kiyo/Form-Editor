import 'server-only';

import { cookies } from 'next/headers';

import type { Role } from '@/config/constants';
import { prisma } from '@/lib/db';

import { requireUser } from './dal';
import { hasAtLeastRole } from './permissions';

/**
 * 「当前工作区」这件事属于**会话状态**，不属于任何业务 feature：
 * 问卷、编辑器、发布、统计的每个 Server Action 都要先知道「现在在哪个工作区」，
 * 而 features 之间禁止互相导入。所以解析逻辑放这里，被所有 feature 共用。
 */

export const ACTIVE_WORKSPACE_COOKIE = 'qw_workspace';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ActiveWorkspace = {
  id: string;
  name: string;
  role: Role;
};

async function readCookieWorkspaceId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}

function toActiveWorkspace(row: {
  role: string;
  workspace: { id: string; name: string };
}): ActiveWorkspace {
  return { id: row.workspace.id, name: row.workspace.name, role: row.role as Role };
}

/**
 * 动作层取当前工作区并断言权限。
 *
 * 两步都必要：Cookie 由客户端提供（可能指向已被移出的工作区），
 * 而**权限一律在服务端判断**，不能因为「前端没渲染那个按钮」就假定调用方有权。
 *
 * 先按 Cookie 精确查一次；查不到再回落到该用户的第一个工作区 ——
 * 这样最坏情况是两次查询，比「先把全部工作区拉出来再挑」稳定。
 */
export async function requireActiveWorkspace(min: Role = 'EDITOR') {
  const user = await requireUser();
  const requestedId = await readCookieWorkspaceId();

  const byCookie = requestedId
    ? await prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId: requestedId, userId: user.id } },
        select: { role: true, workspace: { select: { id: true, name: true } } },
      })
    : null;

  const membership =
    byCookie ??
    (await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, workspace: { select: { id: true, name: true } } },
    }));

  if (!membership) throw new Error('NO_WORKSPACE');

  const workspace = toActiveWorkspace(membership);
  if (!hasAtLeastRole(workspace.role, min)) throw new Error('FORBIDDEN');

  return { user, workspace };
}

export async function setActiveWorkspace(workspaceId: string) {
  const cookieStore = await cookies();

  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    // 只有服务端需要读它，前端没有用途，所以保持 httpOnly
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
}
