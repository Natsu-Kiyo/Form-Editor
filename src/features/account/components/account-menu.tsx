'use client';

import { useState, useTransition } from 'react';

import { DotsIcon, HelpIcon, LogoutIcon, ShieldIcon, UserIcon } from '@/components/icons/ui-icons';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { logoutAction } from '../actions/logout';
import { AccountSettingsDialog, type AccountSettingsTab } from './account-settings-dialog';
import { HelpDialog } from './help-dialog';

export type AccountMenuProps = {
  userName: string;
  userEmail: string;
  /** 当前工作区里的角色文案，例如「所有者」 */
  roleLabel: string;
  passwordUpdatedAtLabel: string | null;
  activeSessionCount: number;
};

/**
 * 侧栏底部的账号行 + 「⋯」菜单。
 *
 * 菜单里的「个人信息 / 账号与安全」打开的是**同一个弹层的两个 Tab**，
 * 而不是两个独立弹层 —— 设计稿如此，也让用户在一次操作里就能改完所有账号相关设置。
 */
export function AccountMenu({
  userName,
  userEmail,
  roleLabel,
  passwordUpdatedAtLabel,
  activeSessionCount,
}: AccountMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<AccountSettingsTab>('profile');
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const openSettings = (nextTab: AccountSettingsTab) => {
    setMenuOpen(false);
    setTab(nextTab);
    setSettingsOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5">
        <Avatar name={userName} size="sm" tone="soft" />

        <span className="min-w-0 flex-1">
          <span className="text-ink-800 block truncate text-[12.5px] font-medium">{userName}</span>
          <span className="text-ink-400 block text-[10.5px]">{roleLabel}</span>
        </span>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="账号菜单"
              className="text-ink-400 hover:text-ink-600 shrink-0 transition-colors duration-150"
            >
              <DotsIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="top" className="w-[240px]">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <Avatar name={userName} size="md" tone="soft" />
              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block truncate text-[12.5px] font-medium">
                  {userName}
                </span>
                <span className="text-ink-400 block truncate text-[10.5px]">{userEmail}</span>
              </span>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem icon={<UserIcon />} onSelect={() => openSettings('profile')}>
              个人信息
            </DropdownMenuItem>
            <DropdownMenuItem icon={<ShieldIcon />} onSelect={() => openSettings('security')}>
              账号与安全
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<HelpIcon />}
              onSelect={() => {
                setMenuOpen(false);
                setHelpOpen(true);
              }}
            >
              帮助与反馈
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              tone="danger"
              icon={<LogoutIcon />}
              disabled={pending}
              onSelect={() => {
                setMenuOpen(false);
                startTransition(async () => {
                  await logoutAction();
                });
              }}
            >
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tab={tab}
        onTabChange={setTab}
        userName={userName}
        userEmail={userEmail}
        passwordUpdatedAtLabel={passwordUpdatedAtLabel}
        activeSessionCount={activeSessionCount}
      />

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
