'use client';

import Link from 'next/link';

import { Avatar } from '@/components/ui/avatar';

/**
 * 移动工作台顶栏（设计稿 P04）。
 *
 * **三个入口都有落点**（这是设计稿 P04 底下特意写明的）：
 * - 工作区名 → 复用桌面同一个切换器（真切换，写 Cookie）
 * - 铃铛 → 复用桌面同一个通知面板
 * - 头像 → 进 P09「我的」
 *
 * 切换器与通知面板由**页面注入**：它们分别属于 workspace 与 account 两个 feature，
 * 而这一层在共享层里（共享层不得反向依赖 features）—— 组合点永远是 `app` 层，
 * 与 `Topbar` 的 `notifications` 是同一个写法。
 *
 * 与桌面顶栏的差别只剩「没有汉堡菜单」：导航已经在底部三格里了，
 * 再给一个抽屉入口等于把同一个导航放两处。
 */
export function MobileWorkbenchHeader({
  workspaceSwitcher,
  notifications,
  userName,
}: {
  /** 工作区切换器（页面注入：workspace 是另一个 feature） */
  workspaceSwitcher: React.ReactNode;
  /** 通知面板（页面注入：account 是另一个 feature） */
  notifications: React.ReactNode;
  userName: string;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 px-5 pt-4 pb-3 lg:hidden">
      {/* 切换器在侧栏里是通栏的，这里收窄到内容宽度 */}
      <div className="max-w-[62%] min-w-0">{workspaceSwitcher}</div>

      <div className="flex shrink-0 items-center gap-2">
        {notifications}
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
