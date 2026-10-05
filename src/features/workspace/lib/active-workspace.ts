import 'server-only';

import { cookies } from 'next/headers';

import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/auth/active-workspace';

import type { WorkspaceSummary } from '../api/workspaces';

/**
 * 从「已经是我的工作区列表」里挑出当前这一个。
 *
 * Cookie 里只存工作区 id；**不能只信 Cookie** ——
 * 用户可能已经被移出那个工作区，而旧 Cookie 还留在浏览器里。
 * 所以一律拿它去自己的成员关系里核对，核对不上就回落到第一个。
 *
 * 刻意接收「已查好的列表」而不是自己去查：调用方（layout）本来就要这份列表，
 * 再查一次就是白白多一次数据库往返 —— 而数据库可能远在另一个区域，一次往返就是几百毫秒。
 *
 * 断言权限的版本是 `requireActiveWorkspace`（在 `@/lib/auth/active-workspace`），
 * 那个给 Server Action 用；这个只负责「列表 + 当前项」的展示口径。
 */
export async function resolveActiveWorkspace(
  workspaces: WorkspaceSummary[],
): Promise<WorkspaceSummary | null> {
  if (workspaces.length === 0) return null;

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  return workspaces.find((workspace) => workspace.id === requestedId) ?? workspaces[0];
}
