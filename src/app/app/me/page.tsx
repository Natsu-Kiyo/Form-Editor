import type { Metadata } from 'next';

import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { countWorkspaceQuestionnaires } from '@/features/account/api/me';
import { getNotifications, getUnreadNotificationCount } from '@/features/account/api/notifications';
import { countActiveSessions } from '@/features/account/api/sessions';
import { MePanel } from '@/features/account/components/me-panel';
import { getMembersPageData } from '@/features/members/api/members';
import { ReadOnlyMembers } from '@/features/members/components/read-only-members';
import { getWorkspacesForUser } from '@/features/workspace/api/workspaces';
import { resolveActiveWorkspace } from '@/features/workspace/lib/active-workspace';
import { requireUser } from '@/lib/auth/dal';
import { getAccountSecurityInfo } from '@/lib/auth/users';
import { formatDisplayDate } from '@/utils/format';

export const metadata: Metadata = { title: '我的' };

/**
 * 「我的」（P09）。
 *
 * 数据都在这里取好，页面本身只是把**已经存在的画面**排成一列：
 * 账号设置 / 帮助 / 工作区切换 / 通知列表 / 退出登录 —— 每一项都落到具体弹层，
 * 不留「入口点了没反应」的行。
 *
 * 权限用 VIEWER：这一页看到的都是与自己有关的东西（账号、所在工作区、通知），
 * 查看者当然该能看。改不改得动由各弹层自己的 action 判断。
 */
export default async function MePage() {
  const user = await requireUser();

  const workspaces = await getWorkspacesForUser(user.id);
  const active = await resolveActiveWorkspace(workspaces);

  const [security, activeSessionCount, notifications, unreadCount, questionnaireCount, members] =
    await Promise.all([
      getAccountSecurityInfo(user.id),
      countActiveSessions(user.id),
      getNotifications(user.id),
      getUnreadNotificationCount(user.id),
      active ? countWorkspaceQuestionnaires(active.id) : Promise.resolve(0),
      // 「成员与角色权限」的只读版（P09）：手机上只看不改，邀请与改角色留在桌面端
      active ? getMembersPageData(active.id) : Promise.resolve(null),
    ]);

  const current = workspaces.find((workspace) => workspace.id === active?.id) ?? null;

  return (
    <>
      {/* 桌面端也可以直接打开这一页（侧栏没有入口，但 URL 是稳定的） */}
      <main className="mx-auto w-full max-w-[560px] px-5 pt-6 pb-28 lg:pb-10">
        <h1 className="text-ink-900 mb-5 text-[17px] font-semibold">我的</h1>

        <MePanel
          userName={user.name}
          userEmail={user.email}
          role={active?.role ?? 'VIEWER'}
          passwordUpdatedAtLabel={
            security?.passwordUpdatedAt ? formatDisplayDate(security.passwordUpdatedAt) : null
          }
          activeSessionCount={activeSessionCount}
          workspaces={workspaces}
          activeWorkspaceId={active?.id ?? null}
          questionnaireCount={questionnaireCount}
          memberCount={current?.memberCount ?? 0}
          notifications={notifications}
          unreadCount={unreadCount}
          membersSlot={
            /*
             * 成员列表由**页面**注入：`ReadOnlyMembers` 属于 members 那个 feature，
             * 而 account 这一层不该跨 feature 引用（两个 feature 直接互相 import，
             * 迟早绕成一个解不开的环）。页面本来就是组合点。
             */
            active ? <ReadOnlyMembers members={members?.members ?? []} /> : null
          }
        />
      </main>

      <MobileTabBar />
    </>
  );
}
