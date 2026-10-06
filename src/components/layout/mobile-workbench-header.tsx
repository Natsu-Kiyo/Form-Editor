'use client';

import Link from 'next/link';

import { Avatar } from '@/components/ui/avatar';
import { NotificationPanel } from '@/features/account/components/notification-panel';
import type { NotificationItem } from '@/features/account/api/notifications';
import { WorkspaceSwitcher } from '@/features/workspace/components/workspace-switcher';
import type { WorkspaceSummary } from '@/features/workspace/api/workspaces';

/**
 * 移动工作台顶栏（设计稿 P04）。
 *
 * **三个入口都有落点**（这是设计稿 P04 底下特意写明的）：
 * - 工作区名 → 复用桌面同一个切换器（真切换，写 Cookie）
 * - 铃铛 → 复用桌面同一个通知面板
 * - 头像 → 进 P09「我的」
 *
 * 与桌面顶栏的差别只剩「没有汉堡菜单」：导航已经在底部三格里了，
 * 再给一个抽屉入口等于把同一个导航放两处。
 */
export function MobileWorkbenchHeader({
  workspaces,
  activeWorkspaceId,
  notifications,
  unreadCount,
  userName,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  userName: string;
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 lg:hidden">
      {/* 切换器在侧栏里是通栏的，这里收窄到内容宽度 */}
      <div className="max-w-[62%] min-w-0">
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationPanel notifications={notifications} unreadCount={unreadCount} />
        <Link
          href="/app/me"
          // 不叫「我的」：底部那一格也叫「我的」，同名会让「点哪一个」说不清楚
          aria-label="我的账号"
          className="focus-visible:ring-brand-500 rounded-full focus-visible:ring-2 focus-visible:outline-none"
        >
          <Avatar name={userName} size="sm" tone="brand" />
        </Link>
      </div>
    </header>
  );
}
