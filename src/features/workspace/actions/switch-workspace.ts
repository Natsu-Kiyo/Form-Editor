'use server';

import { revalidatePath } from 'next/cache';

import { setActiveWorkspace } from '@/lib/auth/active-workspace';
import { requireMembership } from '@/lib/auth/permissions';

/**
 * 切换当前工作区。
 *
 * 必须先 `requireMembership`：这个 action 的参数来自客户端，
 * 不校验的话任何登录用户都能把「别人的工作区」设成自己的当前工作区。
 */
export async function switchWorkspaceAction(workspaceId: string) {
  await requireMembership(workspaceId, 'VIEWER');
  await setActiveWorkspace(workspaceId);

  // 侧栏与顶栏在 layout 里，所以整段 layout 都要重渲染
  revalidatePath('/app', 'layout');
}
