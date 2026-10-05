import type { Metadata } from 'next';

import { FileTextIcon } from '@/components/icons/ui-icons';
import { Topbar } from '@/components/layout/topbar';
import { EmptyState } from '@/components/ui/empty-state';
import { getNotifications, getUnreadNotificationCount } from '@/features/account/api/notifications';
import { NotificationPanel } from '@/features/account/components/notification-panel';
import { requireUser } from '@/lib/auth/dal';

export const metadata: Metadata = { title: '问卷列表' };

/**
 * 问卷列表（**临时内容**）。
 *
 * M2 会用 W02 的完整工作台替换本页：汇总卡、状态筛选、问卷卡片网格，
 * 以及顶栏的「搜索」与「新建问卷」。现在只放空状态，
 * **刻意不加「新建问卷」按钮** —— 那个入口要配弹层与创建动作，属于 M2。
 */
export default async function DashboardHomePage() {
  const user = await requireUser();

  const notifications = await getNotifications(user.id);
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <>
      <Topbar
        title="问卷列表"
        notifications={
          <NotificationPanel notifications={notifications} unreadCount={unreadCount} />
        }
      />

      <main className="mx-auto w-full max-w-[1180px] px-6 py-7">
        <EmptyState
          icon={<FileTextIcon />}
          title="还没有问卷"
          description="从空白创建，或挑一个模板开始"
        />
      </main>
    </>
  );
}
