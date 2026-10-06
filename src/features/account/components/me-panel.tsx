'use client';

import { useState, useTransition } from 'react';

import { BellIcon, HelpIcon, LogoutIcon, ShieldIcon } from '@/components/icons/ui-icons';
import { Avatar } from '@/components/ui/avatar';
import { Modal, ModalContent } from '@/components/ui/modal';
import { RoleBadge } from '@/components/ui/role-badge';
import type { Role } from '@/config/constants';
import { WorkspaceSwitcher } from '@/features/workspace/components/workspace-switcher';
import type { WorkspaceSummary } from '@/features/workspace/api/workspaces';
import { cn } from '@/utils/cn';

import { logoutAction } from '../actions/logout';
import type { NotificationItem } from '../api/notifications';
import { AccountSettingsDialog, type AccountSettingsTab } from './account-settings-dialog';
import { HelpDialog } from './help-dialog';
import { NotificationList } from './notification-panel';

/**
 * P09「我的」（移动端底部导航第三格；桌面端也可以直接访问 `/app/me`）。
 *
 * **每一行都落到已经存在的画面上**，这一页自己没有新造任何设置项：
 * 账号卡 → 账号设置弹层（个人信息 / 账号与安全两个 Tab）、当前工作区 → 复用侧栏那个切换器
 * （真切换，写 Cookie）、消息通知 → 通知列表、帮助与反馈 → 帮助弹层、退出登录 → 真退出。
 *
 * 「成员与角色权限」刻意不在这里给入口：设计稿写的是「手机上只读查看，避免误操作」，
 * 而这一版连只读查看都没有做 —— 所以宁可不画那一行，也不做一个点了没反应的入口。
 */
export function MePanel({
  userName,
  userEmail,
  role,
  passwordUpdatedAtLabel,
  activeSessionCount,
  workspaces,
  activeWorkspaceId,
  questionnaireCount,
  memberCount,
  notifications,
  unreadCount,
}: {
  userName: string;
  userEmail: string;
  /** 当前工作区里的角色（`RoleBadge` 自己把枚举翻成「所有者」这类文案） */
  role: Role;
  passwordUpdatedAtLabel: string | null;
  activeSessionCount: number;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  questionnaireCount: number;
  memberCount: number;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [settings, setSettings] = useState<{ open: boolean; tab: AccountSettingsTab }>({
    open: false,
    tab: 'profile',
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const openSettings = (tab: AccountSettingsTab) => setSettings({ open: true, tab });

  return (
    <>
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => openSettings('profile')}
          className="border-ink-200 hover:border-ink-300 flex w-full items-center gap-3 rounded-[16px] border bg-white p-4 text-left transition-colors duration-150"
        >
          <Avatar name={userName} size="md" tone="soft" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-ink-900 truncate text-[15px] font-semibold">{userName}</span>
              <RoleBadge role={role} />
            </span>
            <span className="text-ink-400 mt-0.5 block truncate text-[11.5px]">{userEmail}</span>
          </span>
          <Chevron />
        </button>
      </div>

      <div className="px-5 pb-4">
        <div className="text-ink-400 mb-2 text-[11px] font-semibold tracking-wide">当前工作区</div>
        {/* 直接复用侧栏那个切换器：它本来就有「当前工作区 + 完整列表 + 新建」 */}
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
        <p className="text-ink-400 mt-2 px-1 text-[11px]">
          {questionnaireCount} 份问卷 · {memberCount} 位成员
        </p>
      </div>

      <div className="px-5">
        <div className="divide-ink-100 border-ink-200 divide-y overflow-hidden rounded-[14px] border bg-white">
          <Row
            icon={<BellIcon className="size-[18px]" />}
            label="消息通知"
            badge={unreadCount > 0 ? String(unreadCount) : null}
            onClick={() => setNotificationsOpen(true)}
          />
          <Row
            icon={<ShieldIcon className="size-[18px]" />}
            label="账号与安全"
            onClick={() => openSettings('security')}
            chevron
          />
          <Row
            icon={<HelpIcon className="size-[18px]" />}
            label="帮助与反馈"
            onClick={() => setHelpOpen(true)}
            chevron
          />
        </div>
      </div>

      <div className="mt-8 px-5">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void logoutAction())}
          className="text-ink-700 border-ink-200 hover:bg-ink-50 flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] border bg-white text-[14px] font-medium transition-colors duration-150 disabled:opacity-60"
        >
          <LogoutIcon className="size-4" />
          {pending ? '退出中…' : '退出登录'}
        </button>
      </div>

      <AccountSettingsDialog
        open={settings.open}
        onOpenChange={(next) => setSettings((prev) => ({ ...prev, open: next }))}
        tab={settings.tab}
        onTabChange={(tab) => setSettings((prev) => ({ ...prev, tab }))}
        userName={userName}
        userEmail={userEmail}
        passwordUpdatedAtLabel={passwordUpdatedAtLabel}
        activeSessionCount={activeSessionCount}
      />

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <Modal open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <ModalContent title="消息通知" width="md">
          {/* 与顶栏铃铛**同一份列表**：同一个通知在两处长得不一样是最容易出的错 */}
          <div className="border-ink-100 -mx-6 -mt-2 border-t">
            <NotificationList notifications={notifications} unreadCount={unreadCount} />
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}

function Row({
  icon,
  label,
  badge,
  chevron,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string | null;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-ink-50/70 flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150"
    >
      <span className="text-ink-500 shrink-0">{icon}</span>
      <span className="text-ink-800 flex-1 text-[13px]">{label}</span>
      {badge ? (
        <span className="inline-flex h-5 items-center rounded-full bg-rose-50 px-2 text-[10.5px] font-medium text-rose-600">
          {badge}
        </span>
      ) : null}
      {chevron ? <Chevron /> : null}
    </button>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('text-ink-300 size-4 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
