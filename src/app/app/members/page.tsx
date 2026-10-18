import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getMembersPageData } from '@/features/members/api/members';
import { MembersPanel } from '@/features/members/components/members-panel';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { hasAtLeastRole } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: '成员与权限' };

/**
 * 成员与权限（W09，桌面端专属）。
 *
 * 与其它管理页同一条分工：页面只做「读数据 + 算权限」，写操作全在 action 里，
 * 且每个 action 自己再断一次 `ADMIN`（界面不是安全边界 —— 查看者看得见这个页面，
 * 但看不见任何写入口，直接调 action 也会被拒）。
 */
export default async function MembersPage() {
  // 查看者也要能看成员与权限说明（否则「为什么我没这个按钮」无处可查）
  const { user, workspace } = await requireActiveWorkspace('VIEWER');

  /*
   * 角色要传进数据层（审查 #1）：待接受邀请里的 token 是凭据，
   * 不能「查出来再在界面上藏起来」—— 查看者的 RSC payload 里就不该有它。
   */
  const data = await getMembersPageData(workspace.id, workspace.role);
  if (!data) notFound();

  return (
    <MembersPanel
      data={data}
      viewerId={user.id}
      canManage={hasAtLeastRole(workspace.role, 'ADMIN')}
    />
  );
}
